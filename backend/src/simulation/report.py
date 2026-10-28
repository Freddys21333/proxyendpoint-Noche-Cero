"""P-08: proyección e informe educativo, sin ejecutar ni alterar el motor."""

import io
from statistics import mean
from typing import Any
from xml.sax.saxutils import escape

from domain.reproducibility import canonical_json
from simulation.experiments import POLICIES, aggregate
from simulation.exports import load_export

LABELS = {"none": "Sin intervención", "random": "Aleatoria", "targeted": "Dirigida"}
CONTEXTS = {
    "household": "hogares",
    "school": "colegios",
    "bus": "buses",
    "market": "mercados",
    "neighborhood": "barrios",
}
REPORT_VERSION = "mayor-report-v2"


def build_report(document: dict[str, Any]) -> dict[str, Any]:
    """Valida integridad y derivados; esto no certifica validez epidemiológica."""
    source = load_export(canonical_json(document))
    cfg = source["configuration"]
    n = cfg["repetitions"]
    if (
        source["progress"] != dict(replicatesTotal=n, replicatesSucceeded=n, replicatesFailed=0)
        or len(source["replicates"]) != n
    ):
        raise ValueError("El informe requiere todas las réplicas completas.")
    derived = aggregate(source["replicates"], cfg["rootSeed"])
    if source["representative"]["index"] != derived["representativeIndex"]:
        raise ValueError("La réplica representativa no coincide con el agregado.")
    for key in ("summaryByPolicy", "pairedComparisons", "aggregatedCurves", "recommendation"):
        if source[key] != derived[key]:
            raise ValueError("Los agregados del experimento no coinciden con sus réplicas.")
    plan = cfg["intervention"].get("combined")
    summary = source["summaryByPolicy"]
    baseline = summary["none"]["cumulativeInfected"]["mean"]
    rows = []
    adaptive = plan.get("adaptiveStrategy") if plan else None
    for policy in POLICIES:
        stats = summary[policy]
        infected = stats["cumulativeInfected"]["mean"]
        avoided = baseline - infected
        spent = (
            mean(rep["policies"][policy]["daily"][-1]["spentCents"] for rep in source["replicates"])
            if plan
            else None
        )
        rows.append(
            dict(
                policy=policy,
                label=LABELS[policy]
                + (
                    " · adaptativa v1"
                    if policy == "targeted" and adaptive and adaptive.get("enabled", True)
                    else ""
                ),
                infected=infected,
                populationPercent=100 * infected / cfg["scenario"]["populationSize"],
                p05=stats["cumulativeInfected"]["p05"],
                p95=stats["cumulativeInfected"]["p95"],
                avoided=avoided,
                reductionPercent=100 * avoided / baseline if baseline > 0 else None,
                peak=stats["peakInfectious"]["mean"],
                peakDay=stats["peakDay"]["mean"],
                doses=stats["vaccinesAssigned"]["mean"],
                unused=stats["vaccinesUnused"]["mean"],
                spentCents=spent,
                remainingCents=plan["budgetCents"] - spent if plan else None,
                costPerAvoidedCents=spent / avoided if spent is not None and avoided > 0 else None,
            )
        )
    paired = source["pairedComparisons"]
    comparisons = []
    for label, comp in (
        ("Aleatoria frente a no intervenir", paired["savedVsNone"]["random"]),
        ("Dirigida frente a no intervenir", paired["savedVsNone"]["targeted"]),
        ("Dirigida frente a aleatoria", paired["gainVsRandom"]),
    ):
        comparisons.append(
            dict(
                label=label,
                **comp,
                wins=sum(v > 0 for v in comp["values"]),
                ties=sum(v == 0 for v in comp["values"]),
                losses=sum(v < 0 for v in comp["values"]),
            )
        )
    rec = source["recommendation"]
    conclusion = (
        f"{LABELS[rec['winner']]} obtuvo la menor media de infectados acumulados, "
        "con una ventaja respaldada por estas réplicas."
        if rec["confidence"] == "supported" and rec["winner"] != "tie"
        else "No hay evidencia suficiente para recomendar una única opción. "
        + (
            "Las estrategias empatan en la menor media."
            if rec["winner"] == "tie"
            else f"{LABELS[rec['winner']]} obtuvo la menor media, pero el resultado no es concluyente."
        )
    )
    return dict(
        reportVersion=REPORT_VERSION,
        experimentHash=source["manifest"]["experimentHash"],
        configuration=cfg,
        manifest=source["manifest"],
        rows=rows,
        comparisons=comparisons,
        recommendation=rec,
        conclusion=conclusion,
        representativeIndex=source["representative"]["index"],
    )


def render_pdf(report: dict[str, Any]) -> bytes:
    """Resumen ejecutivo vectorial de dos páginas; sin alterar cifras ni hashes."""
    from reportlab.lib import colors  # type: ignore[import-untyped]
    from reportlab.lib.pagesizes import A4  # type: ignore[import-untyped]
    from reportlab.lib.styles import ParagraphStyle  # type: ignore[import-untyped]
    from reportlab.pdfgen.canvas import Canvas  # type: ignore[import-untyped]
    from reportlab.platypus import Paragraph  # type: ignore[import-untyped]

    output = io.BytesIO()
    canvas = Canvas(output, pagesize=A4, invariant=1, pageCompression=1)
    canvas.setTitle("Resumen para alcaldía - Comité de Contención de Manta")
    canvas.setAuthor("Comité de Contención de Manta")
    width, height = A4
    left, usable = 48, width - 96
    ink, muted = colors.HexColor("#202d38"), colors.HexColor("#4b5963")
    palette = [colors.HexColor(value) for value in ("#77707e", "#487aa0", "#18745e")]
    cfg, rows = report["configuration"], report["rows"]
    scenario, intervention = cfg["scenario"], cfg["intervention"]

    def num(value: float | None) -> str:
        return (
            "No aplica"
            if value is None
            else f"{value:.2f}".rstrip("0").rstrip(".").replace(".", ",")
        )

    def money(value: float | None) -> str:
        return "No configurado" if value is None else f"USD {value / 100:.2f}".replace(".", ",")

    def text(
        value: str,
        y: float,
        *,
        size: float = 10,
        bold: bool = False,
        x: float = left,
        span: float = usable,
        color: Any = ink,
    ) -> float:
        style = ParagraphStyle(
            "Executive",
            fontName="Helvetica-Bold" if bold else "Helvetica",
            fontSize=size,
            leading=size * 1.35,
            textColor=color,
        )
        paragraph = Paragraph(escape(value), style)
        _, h = paragraph.wrap(span, height)
        paragraph.drawOn(canvas, x, y - h)
        return y - float(h) - 8

    def heading(title: str, page: int) -> float:
        canvas.setFillColor(palette[2])
        canvas.rect(left, height - 49, 36, 4, fill=1, stroke=0)
        text("Comité de Contención de Manta", height - 64, size=9, bold=True)
        y = text(title, height - 88, size=25, bold=True)
        text("SIMULACIÓN EDUCATIVA / ESCENARIO FICTICIO", y, size=8, color=muted)
        canvas.setStrokeColor(colors.HexColor("#d6dedc"))
        canvas.line(left, 61, width - left, 61)
        text(f"Identificador del experimento: {report['experimentHash']}", 52, size=6.8)
        text(
            f"Informe v2 / Motor {report['manifest']['engineVersion']} / Página {page} de 2",
            36,
            size=7,
            color=muted,
        )
        return y - 31

    def table(
        headers: list[str],
        data: list[list[str]],
        y: float,
        fractions: list[float],
        row_height: int = 41,
    ) -> float:
        boundaries = [left]
        for fraction in fractions:
            boundaries.append(boundaries[-1] + usable * fraction)
        for row_number, row in enumerate([headers, *data]):
            canvas.setFillColor(colors.HexColor("#eaf1ee" if row_number == 0 else "#f6f8f7"))
            canvas.rect(left, y - row_height + 2, usable, row_height - 2, fill=1, stroke=0)
            for col, cell in enumerate(row):
                text(
                    cell,
                    y - 7,
                    x=boundaries[col] + 7,
                    span=boundaries[col + 1] - boundaries[col] - 14,
                    size=8.2,
                    bold=row_number == 0,
                )
            y -= row_height
        return y - 8

    y = heading("Resumen para decidir", 1)
    y = text(
        f"{scenario['populationSize']} personas sintéticas / {scenario['days']} días / "
        f"{cfg['repetitions']} repeticiones del mismo escenario",
        y,
        size=10,
    )
    conclusion = (
        report["conclusion"]
        .replace(
            "la menor media de infectados acumulados", "el menor promedio de personas contagiadas"
        )
        .replace("la menor media", "el menor promedio")
        .replace("réplicas", "repeticiones")
    )
    y = text("Qué nos dice el ejercicio", y - 8, size=13, bold=True)
    y = text(conclusion, y, size=12, bold=True)
    y = text(
        "Se busca reducir contagios. La opción con menos contagios no tiene por qué ser la más barata.",
        y,
        size=9,
        color=muted,
    )
    y = text("Personas contagiadas durante el brote", y - 10, size=14, bold=True)
    y = text(
        "Barras: promedio. Línea fina: variación entre repeticiones (P05-P95), no un intervalo de confianza.",
        y,
        size=8.5,
        color=muted,
    )
    bar_x, bar_width = left + 124, usable - 210
    for index, row in enumerate(rows):
        text(row["label"], y - 2, x=left, span=116, size=9, bold=True)
        center = y - 13
        canvas.setFillColor(colors.HexColor("#edf1ef"))
        canvas.rect(bar_x, center - 7, bar_width, 14, fill=1, stroke=0)
        canvas.setFillColor(palette[index])
        canvas.rect(
            bar_x,
            center - 7,
            bar_width * row["infected"] / scenario["populationSize"],
            14,
            fill=1,
            stroke=0,
        )
        low, high = [
            bar_x + bar_width * row[key] / scenario["populationSize"] for key in ("p05", "p95")
        ]
        canvas.setStrokeColor(ink)
        canvas.setLineWidth(1)
        canvas.line(low, center, high, center)
        for endpoint in (low, high):
            canvas.line(endpoint, center - 10, endpoint, center + 10)
        text(num(row["infected"]), y, x=bar_x + bar_width + 12, span=74, size=12, bold=True)
        y -= 48
    text("0", y + 9, x=bar_x, span=40, size=8, color=muted)
    text(
        f"{scenario['populationSize']} personas",
        y + 9,
        x=bar_x + bar_width - 65,
        span=100,
        size=8,
        color=muted,
    )
    y = text("Impacto y vacunas, de un vistazo", y - 15, size=14, bold=True)
    y = table(
        ["Estrategia", "Contagios evitados*", "Pico simultáneo", "Dosis usadas"],
        [
            [
                row["label"],
                "Referencia" if row["policy"] == "none" else num(row["avoided"]),
                num(row["peak"]),
                num(row["doses"]),
            ]
            for row in rows
        ],
        y,
        [0.25, 0.27, 0.24, 0.24],
    )
    text(
        "* Frente a no intervenir. Un valor negativo significa más contagios. Son promedios: los decimales no representan partes de una persona. Pico: mayor cantidad infecciosa a la vez. Una dosis usada puede fallar.",
        y,
        size=8.5,
        color=muted,
    )
    canvas.showPage()

    y = heading("Recursos y confianza", 2)
    y = text("Qué recursos supone este escenario", y, size=13, bold=True)
    y = text(
        f"{intervention['vaccines']} dosis iniciales; protección supuesta del "
        f"{num(100 * intervention['vaccineEfficacy'])}%; inicio de intervención en el día {intervention['interventionDay']}.",
        y,
        size=9,
    )
    plan = intervention.get("combined")
    if plan:
        y = text(
            f"Presupuesto máximo por estrategia: {money(plan['budgetCents'])}. Importes educativos, no precios sanitarios reales.",
            y,
            size=9,
        )
        y = table(
            ["Estrategia", "Gasto medio", "Saldo medio", "Costo por evitado"],
            [
                [
                    row["label"],
                    money(row["spentCents"]),
                    money(row["remainingCents"]),
                    "No aplica"
                    if row["costPerAvoidedCents"] is None
                    else money(row["costPerAvoidedCents"]),
                ]
                for row in rows
            ],
            y,
            [0.25, 0.24, 0.24, 0.27],
            row_height=35,
        )
    else:
        y = text(
            "No se configuró presupuesto monetario. Esto no significa que vacunar sea gratis; este ejercicio solo compara dosis y contagios.",
            y,
            size=9,
        )
    adaptive = plan.get("adaptiveStrategy") if plan else None
    if adaptive:
        y = text(
            "La variante adaptativa ajusta las acciones día a día según el brote y los recursos disponibles."
            if adaptive.get("enabled", True)
            else "La variante adaptativa está deshabilitada en este ejercicio.",
            y,
            size=8.5,
        )
    y = text("¿La ventaja se repitió siempre?", y - 4, size=13, bold=True)
    y = text(
        "De izquierda a derecha: mejor (menos contagios), igual (empates) y peor (pérdidas).",
        y,
        size=8.5,
    )
    for comparison in report["comparisons"]:
        text(comparison["label"], y, size=8.5, bold=True, span=usable * 0.62)
        text(
            f"{comparison['wins']} mejor / {comparison['ties']} igual / {comparison['losses']} peor",
            y,
            x=left + usable * 0.64,
            span=usable * 0.36,
            size=8,
        )
        y -= 22
        x = left
        for count, color in zip(
            (comparison["wins"], comparison["ties"], comparison["losses"]),
            (palette[2], colors.HexColor("#a2adb1"), colors.HexColor("#c57943")),
            strict=True,
        ):
            canvas.setFillColor(color)
            segment = usable * count / cfg["repetitions"]
            canvas.rect(x, y - 8, segment, 8, fill=1, stroke=0)
            x += segment
        y -= 16
    y = text("Qué tan segura es la diferencia", y - 3, size=12, bold=True)
    for comparison in report["comparisons"]:
        interval = comparison["bootstrap"]
        if interval:
            y = text(
                f"{comparison['label']}: diferencia media {num(comparison['mean'])}; intervalo del 95% "
                f"{num(interval['lower'])} a {num(interval['upper'])} personas (IC bootstrap).",
                y,
                size=8,
            )
    if not report["comparisons"][0]["bootstrap"]:
        y = text(
            "No hay evidencia suficiente para una conclusión estadística: se requieren al menos 30 repeticiones para el intervalo. El resultado actual es descriptivo.",
            y,
            size=8.5,
        )
    y = text("Antes de tomar una decisión real", y - 3, size=12, bold=True)
    text(
        "No predice un brote real ni representa pacientes por barrio. Más repeticiones no eliminan los límites del modelo. Revise recursos y condiciones reales antes de usar estas conclusiones. Parámetros, versiones y límites completos se conservan en el JSON del experimento.",
        y,
        size=8.5,
    )
    text(
        "Referencia separada: manabi-dengue-2025-v1, fitted-not-validated (ajustado, no validado). No acredita predicción de dengue ni aprobación científica T-22.",
        92,
        size=7,
        color=muted,
    )
    canvas.save()
    return output.getvalue()
