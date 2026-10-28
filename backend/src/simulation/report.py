"""P-08: proyección e informe educativo, sin ejecutar ni alterar el motor."""

import io
import json
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
REPORT_VERSION = "mayor-report-v1"


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
    """Plantilla paginada e invariante: mismos datos y entorno, mismos bytes."""
    from reportlab.lib import colors  # type: ignore[import-untyped]
    from reportlab.lib.enums import TA_LEFT  # type: ignore[import-untyped]
    from reportlab.lib.pagesizes import A4  # type: ignore[import-untyped]
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet  # type: ignore[import-untyped]
    from reportlab.pdfgen.canvas import Canvas  # type: ignore[import-untyped]
    from reportlab.platypus import (  # type: ignore[import-untyped]
        PageBreak,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    output = io.BytesIO()
    ink = colors.HexColor("#292235")
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            "BodyES",
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=ink,
            spaceAfter=9,
            alignment=TA_LEFT,
        )
    )
    styles.add(ParagraphStyle("SmallES", parent=styles["BodyES"], fontSize=8, leading=11))
    styles.add(
        ParagraphStyle(
            "MonoES", fontName="Courier", fontSize=7, leading=10, spaceAfter=0, wordWrap="CJK"
        )
    )
    story: list[Any] = []

    def paragraph(text: str, style: str = "BodyES") -> Any:
        return Paragraph(escape(text).replace("\n", "<br/>"), styles[style])

    def add(text: str, style: str = "BodyES") -> None:
        story.append(paragraph(text, style))

    def table(headers: list[str], rows: list[list[str]], widths: list[int]) -> None:
        data = [[paragraph(cell, "SmallES") for cell in row] for row in [headers, *rows]]
        grid = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
        grid.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eee8f2")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#d5cbdc")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ]
            )
        )
        story.extend([grid, Spacer(1, 12)])

    def num(value: float | None) -> str:
        return "No aplica" if value is None else f"{value:.2f}".replace(".", ",")

    def money(value: float | None) -> str:
        return "No configurado" if value is None else f"USD {num(value / 100)}"

    cfg = report["configuration"]
    scenario = cfg["scenario"]
    plan = cfg["intervention"].get("combined")
    add("Comité de Contención de Manta", "Title")
    add("Informe para alcaldía", "Heading1")
    add(
        "Simulación educativa de una plaga ficticia. No es una predicción médica ni una estimación de riesgo real por barrio."
    )
    add("1. Qué se comparó", "Heading2")
    add(
        f"Una población sintética de {scenario['populationSize']} personas durante "
        f"{scenario['days']} días (0 a {scenario['days']}), con {cfg['repetitions']} réplicas "
        "pareadas. Se comparan no intervenir, vacunar al azar y vacunar de forma dirigida. "
        "Las políticas comparten red, brote inicial y recursos disponibles; el gasto efectivo puede diferir."
    )
    add("2. Qué indican los resultados", "Heading2")
    add(report["conclusion"])
    add(
        "Criterio: minimizar la media de personas infectadas alguna vez hasta el final del horizonte. "
        "La recomendación no optimiza automáticamente el costo. Los valores siguientes son promedios entre réplicas, no personas fraccionarias en una ejecución."
    )
    table(
        ["Estrategia", "Infectados / % población", "Evitados vs. no intervenir", "P05 a P95"],
        [
            [
                r["label"],
                f"{num(r['infected'])} / {num(r['populationPercent'])}%",
                num(r["avoided"]),
                f"{num(r['p05'])} a {num(r['p95'])}",
            ]
            for r in report["rows"]
        ],
        [111, 121, 133, 134],
    )
    add(
        "Evitados = infectados sin intervención menos infectados con la estrategia. Un valor negativo significa más infectados. P05 a P95 describe dispersión entre réplicas; no es un intervalo de confianza."
    )
    table(
        [
            "Estrategia",
            "Pico infeccioso medio",
            "Día medio del primer pico",
            "Dosis usadas / sin usar",
        ],
        [
            [
                r["label"],
                num(r["peak"]),
                num(r["peakDay"]),
                f"{num(r['doses'])} / {num(r['unused'])}",
            ]
            for r in report["rows"]
        ],
        [111, 121, 133, 134],
    )
    add(
        "El día medio del pico resume picos de réplicas individuales. No es necesariamente el día del máximo de la curva promedio.",
        "SmallES",
    )
    story.append(PageBreak())
    add("3. Recursos, presupuesto y gasto", "Heading1")
    intervention = cfg["intervention"]
    add(
        f"Vacunas iniciales: {intervention['vaccines']} dosis; eficacia supuesta: "
        f"{num(100 * intervention['vaccineEfficacy'])}%; intervención desde día {intervention['interventionDay']}."
    )
    if plan:
        add(
            f"Presupuesto por estrategia: {money(plan['budgetCents'])}. "
            f"Costos educativos: {money(plan['vaccineCostCents'])}/dosis, "
            f"{money(plan['closureCostCents'])}/día de cierre y "
            f"{money(plan['brigadeCostCents'])}/persona atendida por día."
        )
        add(
            f"Cierre de capa {CONTEXTS[plan['closureContext']]}: inicio {plan['closureStart']}, "
            f"duración {plan['closureDays']} días. Brigadas: inicio {plan['brigadeStart']}, "
            f"duración {plan['brigadeDays']} días, hasta {plan['brigadeDailyCapacity']} atenciones/día; "
            f"reducción educativa de transmisión {num(100 * plan['brigadeReduction'])}%."
        )
        table(
            ["Estrategia", "Gasto medio", "Saldo medio", "Costo por contagio evitado"],
            [
                [
                    r["label"],
                    money(r["spentCents"]),
                    money(r["remainingCents"]),
                    "No aplica"
                    if r["costPerAvoidedCents"] is None
                    else money(r["costPerAvoidedCents"]),
                ]
                for r in report["rows"]
            ],
            [111, 121, 133, 134],
        )
        add(
            "Gasto = acciones realmente ejecutadas por costo unitario; saldo = presupuesto menos gasto. "
            "El costo por contagio evitado divide gasto medio por evitados medios; si no hay mejora positiva no aplica. "
            "Se cobran dosis aunque fallen. Orden diario: vacunas, cierre y brigadas; no hay reserva automática para días futuros."
        )
        schedule = plan.get("resourceSchedule")
        if schedule:
            add(
                f"Calendario activo: capacidad de {schedule['vaccineDailyCapacity']} dosis/día, "
                f"{schedule['initialBrigadeSupplies']} insumos iniciales de brigada y "
                f"{len(schedule['deliveries'])} entregas programadas. Las entregas se detallan en el anexo; "
                "aumentan existencias, no financiación. Los recursos se cobran al usarlos."
            )
        add(
            "Son supuestos educativos editables, no tarifas sanitarias reales. No incluyen facturación ni costos AWS."
        )
    else:
        add(
            "Este experimento no configuró costos monetarios ni presupuesto combinado. "
            "No se estima gasto ni costo por contagio evitado. La ausencia de costos no significa que las intervenciones sean gratuitas."
        )
    add("4. Incertidumbre y comparación justa", "Heading2")
    for comp in report["comparisons"]:
        add(comp["label"], "Heading3")
        add(
            f"Diferencia media: {num(comp['mean'])} personas; "
            f"{comp['wins']} victorias, {comp['ties']} empates y {comp['losses']} pérdidas "
            f"en {cfg['repetitions']} réplicas."
        )
        interval = comp["bootstrap"]
        add(
            f"IC bootstrap 95%: {num(interval['lower'])} a {num(interval['upper'])}; "
            f"{interval['resamples']} remuestras."
            if interval
            else "Comparación descriptiva: sin IC bootstrap, que requiere al menos 30 réplicas."
        )
    story.append(PageBreak())
    add("5. Límites y procedencia", "Heading1")
    add(
        "Red synthetic-manta-v1: población y contactos sintéticos inspirados en Manta. "
        "El mapa OSM es una referencia visual; las posiciones no son pacientes, movilidad ni riesgo epidemiológico observado. "
        "Este informe no incorpora datos observados de dengue ni acredita el gate científico T-22."
    )
    add(
        "El recurso separado manabi-dengue-2025-v1 está etiquetado fitted-not-validated "
        "(ajustado, no validado): perdió frente a persistencia en validación. El contrato del experimento "
        "no identifica la procedencia de parámetros copiados; no se infiere que este experimento use ese preset."
    )
    for limit in report["recommendation"]["limitations"]:
        add(limit)
    add(
        f"La animación muestra la réplica de índice {report['representativeIndex']}; "
        "este informe compara los promedios de todas las réplicas. Más réplicas reducen ruido Monte Carlo, no eliminan los límites del modelo."
    )
    add("6. Trazabilidad y reproducción", "Heading2")
    add(
        f"Plantilla: {report['reportVersion']}. Motor: {report['manifest']['engineVersion']}; "
        f"esquema: {report['manifest']['schemaVersion']}; build: {report['manifest']['buildCommit']}."
    )
    add("Hash del experimento (conservar junto al JSON fuente):")
    add(report["experimentHash"], "MonoES")
    add(
        f"Semilla raíz: {cfg['rootSeed']}; modo de red: {cfg['networkMode']}. "
        "Integridad de esquema, hashes y agregados comprobada; no se volvió a ejecutar el motor para generar el PDF. "
        "Para reproducir la simulación: python scripts/reproduce.py experimento.json."
    )
    add("Anexo: configuración completa", "Heading2")
    for line in json.dumps(cfg, ensure_ascii=False, sort_keys=True, indent=2).splitlines():
        add(line, "MonoES")
    add("Versiones del entorno fuente", "Heading2")
    for line in json.dumps(
        report["manifest"], ensure_ascii=False, sort_keys=True, indent=2
    ).splitlines():
        add(line, "MonoES")

    def footer(canvas: Any, doc: Any) -> None:
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(ink)
        canvas.drawString(48, 28, "Comité de Contención de Manta | Simulación educativa")
        canvas.drawRightString(A4[0] - 48, 28, f"Página {doc.page}")
        canvas.restoreState()

    def invariant_canvas(*args: Any, **kwargs: Any) -> Any:
        kwargs["invariant"] = 1
        return Canvas(*args, **kwargs)

    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=48,
        leftMargin=48,
        topMargin=42,
        bottomMargin=46,
        title="Informe para alcaldía - Comité de Contención de Manta",
        author="Comité de Contención de Manta",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer, canvasmaker=invariant_canvas)
    return output.getvalue()
