"""P-05: importa y verifica la serie semanal de dengue de Manabí (MSP).

La fuente son las gacetas vectoriales del Ministerio de Salud Pública. El
gráfico provincial es vectorial: cada año es una polilínea de color y el año
en curso lleva una etiqueta numérica por semana. La importación tiene tres
pasos separados para que la parte científica sea verificable sin PDF:

1. ``download``: descarga el PDF y comprueba su SHA-256.
2. ``extract``: convierte el gráfico en geometría JSON (requiere PyMuPDF).
3. ``build``: elige la polilínea, deriva la serie, ejecuta los controles de
   totales y escribe el CSV normalizado y la procedencia (solo stdlib).
4. ``verify``: recalcula todo desde la geometría versionada y compara con lo
   publicado en el repositorio.

Ejemplos, desde la raíz::

    backend/.venv/bin/python scripts/p05_import_dengue.py verify
    backend/.venv/bin/python scripts/p05_import_dengue.py download
    backend/.venv/bin/python scripts/p05_import_dengue.py extract
    backend/.venv/bin/python scripts/p05_import_dengue.py build
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend/src"))

from data.dengue import (  # noqa: E402
    PROVINCE,
    VALUE_KIND,
    ChartGeometry,
    ChartLabel,
    DengueImportError,
    PolylinePoint,
    WeeklyRow,
    apply_controls,
    check_series,
    parse_csv,
    parse_geometry,
    render_csv,
    select_series,
    text_sha256,
    validate_rows,
)

DEFAULT_SOURCES = ROOT / "data/p05/sources.json"
DEFAULT_DATA_DIR = ROOT / "data/p05"
DEFAULT_PDF_DIR = ROOT / ".tools/p05"
USER_AGENT = "zombie-management-p05/1.0 (+repositorio educativo; importacion reproducible)"
CHART_MIN_ITEMS = 20
LABEL_SIZE_RANGE = (7.5, 9.0)
YEAR_TEXT_RANGE = range(2020, 2031)


def load_sources(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except OSError as error:
        raise DengueImportError(f"no se pudo leer {path}: {error}") from error
    if not isinstance(payload, dict):
        raise DengueImportError("sources.json debe ser un objeto JSON")
    snapshots = payload.get("snapshots")
    if not isinstance(snapshots, list) or not snapshots:
        raise DengueImportError("sources.json no declara instantáneas")
    for snapshot in snapshots:
        if not isinstance(snapshot, dict):
            raise DengueImportError("cada instantánea debe ser un objeto")
        for field in ("snapshot_id", "year", "url", "sha256", "expected_weeks", "chart_page"):
            if field not in snapshot:
                raise DengueImportError(f"la instantánea no declara {field!r}")
    return payload


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_text(path: Path) -> str:
    with path.open("r", encoding="utf-8", newline="") as stream:
        return stream.read()


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as stream:
        stream.write(text)


def command_download(args: argparse.Namespace) -> int:
    sources = load_sources(args.sources)
    args.pdf_dir.mkdir(parents=True, exist_ok=True)
    for snapshot in sources["snapshots"]:
        target = args.pdf_dir / f"{snapshot['snapshot_id']}.pdf"
        request = urllib.request.Request(snapshot["url"], headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=180) as response:
            data = response.read()
        digest = sha256_bytes(data)
        if digest != snapshot["sha256"]:
            raise DengueImportError(
                f"{snapshot['snapshot_id']}: SHA-256 {digest} no coincide con "
                f"{snapshot['sha256']}; la fuente cambió y exige revisión explícita"
            )
        if len(data) != int(snapshot["byte_size"]):
            raise DengueImportError(
                f"{snapshot['snapshot_id']}: {len(data)} bytes frente a {snapshot['byte_size']}"
            )
        target.write_bytes(data)
        print(f"{snapshot['snapshot_id']}: {len(data)} bytes, sha256 {digest}")
    return 0


def _load_pymupdf() -> Any:
    try:
        import pymupdf  # type: ignore[import-not-found]
    except ImportError as error:  # pragma: no cover - depende del entorno
        raise DengueImportError(
            "falta PyMuPDF; instalar solo para el paso extract: "
            "`python -m pip install pymupdf`"
        ) from error
    return pymupdf


def _find_title(page: Any) -> dict[str, Any]:
    title = None
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 0:
            continue
        for line in block["lines"]:
            for span in line["spans"]:
                text = span["text"].strip()
                if "MANABI" in text.upper() and "HIST" in text.upper():
                    title = span
    if title is None:
        raise DengueImportError("no se encontró el gráfico provincial de MANABI")
    return dict(title)


def _find_frame(page: Any, title: dict[str, Any]) -> Any:
    bottom = float(title["bbox"][3])
    frames = [
        drawing["rect"]
        for drawing in page.get_drawings()
        if 80 <= drawing["rect"].height <= 320
        and 300 <= drawing["rect"].width <= page.rect.width - 40
        and bottom - 8 <= drawing["rect"].y0 <= bottom + 40
    ]
    if not frames:
        raise DengueImportError("no se encontró el marco del gráfico provincial")
    frames.sort(key=lambda rect: (abs(rect.y0 - (bottom + 6)), -rect.height))
    return frames[0]


def _collect_labels(pymupdf: Any, page: Any, frame: Any) -> list[ChartLabel]:
    raw: list[tuple[float, float, int]] = []
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 0:
            continue
        for line in block["lines"]:
            for span in line["spans"]:
                text = span["text"].strip()
                if not re.fullmatch(r"\d{1,4}", text):
                    continue
                if not LABEL_SIZE_RANGE[0] <= float(span["size"]) <= LABEL_SIZE_RANGE[1]:
                    continue
                x0, y0, x1, y1 = span["bbox"]
                center = pymupdf.Point((x0 + x1) / 2, (y0 + y1) / 2)
                if not frame.contains(center):
                    continue
                raw.append((center.x, center.y, int(text)))

    def is_legend(span: tuple[float, float, int]) -> bool:
        _, y, value = span
        if value not in YEAR_TEXT_RANGE:
            return False
        neighbours = {
            other[2]
            for other in raw
            if abs(other[1] - y) <= 2.0
            and other[2] in YEAR_TEXT_RANGE
            and other[2] != value
        }
        return len(neighbours) >= 2

    labels = [
        ChartLabel(x=cx, y=cy, value=value)
        for cx, cy, value in raw
        if not is_legend((cx, cy, value))
    ]
    if len(labels) < 2:
        raise DengueImportError("no se encontraron etiquetas semanales en el gráfico")
    return sorted(labels, key=lambda label: label.x)


def _vertices(drawing: dict[str, Any]) -> list[PolylinePoint]:
    points: list[PolylinePoint] = []
    for item in drawing["items"]:
        if item[0] == "l":
            first, second = item[1], item[2]
        elif item[0] == "c":
            first, second = item[1], item[4]
        else:
            continue
        if not points or abs(points[-1].x - first.x) > 0.01 or abs(points[-1].y - first.y) > 0.01:
            points.append(PolylinePoint(x=first.x, y=first.y))
        points.append(PolylinePoint(x=second.x, y=second.y))
    return points


def _collect_candidates(page: Any, frame: Any) -> dict[str, list[PolylinePoint]]:
    candidates: dict[str, list[PolylinePoint]] = {}
    for drawing in page.get_drawings():
        color = drawing.get("color")
        if not color or len(drawing["items"]) < CHART_MIN_ITEMS:
            continue
        rect = drawing["rect"]
        if not (frame.contains(rect.tl) and frame.contains(rect.br)):
            continue
        key = ",".join(f"{channel:.4f}" for channel in color)
        points = _vertices(drawing)
        if len(points) >= 2:
            candidates[key] = points
    if not candidates:
        raise DengueImportError("no se encontraron polilíneas candidatas en el marco")
    return candidates


def _round_points(points: list[PolylinePoint]) -> list[dict[str, float]]:
    return [{"x": round(point.x, 4), "y": round(point.y, 4)} for point in points]


def command_extract(args: argparse.Namespace) -> int:
    pymupdf = _load_pymupdf()
    sources = load_sources(args.sources)
    args.geometry_dir.mkdir(parents=True, exist_ok=True)
    for snapshot in sources["snapshots"]:
        if args.only and snapshot["snapshot_id"] != args.only:
            continue
        pdf_path = args.pdf_dir / f"{snapshot['snapshot_id']}.pdf"
        if not pdf_path.exists():
            raise DengueImportError(f"falta {pdf_path}; ejecutar primero el paso download")
        data = pdf_path.read_bytes()
        digest = sha256_bytes(data)
        if digest != snapshot["sha256"]:
            raise DengueImportError(
                f"{snapshot['snapshot_id']}: SHA-256 {digest} no coincide con el manifiesto"
            )
        document = pymupdf.open(pdf_path)
        page_index = int(snapshot["chart_page"]) - 1
        if not 0 <= page_index < len(document):
            raise DengueImportError(f"{pdf_path}: no existe la página {snapshot['chart_page']}")
        page = document[page_index]
        title = _find_title(page)
        frame = _find_frame(page, title)
        labels = _collect_labels(pymupdf, page, frame)
        candidates = _collect_candidates(page, frame)
        selection = select_series({key: tuple(value) for key, value in candidates.items()}, labels)
        check_series(selection.values, expected_weeks=int(snapshot["expected_weeks"]))

        payload = {
            "schema_version": "p05-chart-geometry-v1",
            "snapshot_id": snapshot["snapshot_id"],
            "year": snapshot["year"],
            "chart_page": snapshot["chart_page"],
            "chart_title": title["text"].strip(),
            "extractor": {
                "name": "pymupdf",
                "version": str(getattr(pymupdf, "__version__", "unknown")),
            },
            "frame": [round(float(value), 4) for value in frame],
            "labels": [
                {"x": round(label.x, 4), "y": round(label.y, 4), "value": label.value}
                for label in labels
            ],
            "candidates": {
                key: _round_points(points) for key, points in sorted(candidates.items())
            },
            "selected": {
                "color": selection.key,
                "week_spacing": round(selection.week_spacing, 4),
                "slope": round(selection.scale.slope, 6),
                "intercept": round(selection.scale.intercept, 4),
                "values": list(selection.values),
                "positional_label_mismatches": [
                    {"week": week, "geometry": derived, "printed": printed}
                    for week, derived, printed in selection.positional_mismatches
                ],
            },
        }
        target = args.geometry_dir / f"{snapshot['snapshot_id']}.json"
        write_text(target, json.dumps(payload, ensure_ascii=False, indent=1) + "\n")
        print(
            f"{snapshot['snapshot_id']}: {len(selection.values)} semanas, "
            f"{len(candidates)} candidatas, color {selection.key}, total {sum(selection.values)}"
        )
    return 0


def _snapshot_provenance(
    snapshot: dict[str, Any], geometry: ChartGeometry, selection: Any, controls: list[dict]
) -> dict[str, Any]:
    mismatches = [
        {"week": week, "geometry": derived, "printed": printed}
        for week, derived, printed in selection.positional_mismatches
    ]
    return {
        "snapshot_id": snapshot["snapshot_id"],
        "year": snapshot["year"],
        "edition": snapshot["edition"],
        "cut_off_week": snapshot["cut_off_week"],
        "url": snapshot["url"],
        "sha256": snapshot["sha256"],
        "byte_size": snapshot["byte_size"],
        "pdf_pages": snapshot["pdf_pages"],
        "pdf_created_utc": snapshot["pdf_created_utc"],
        "chart_page": snapshot["chart_page"],
        "chart_title": geometry.chart_title,
        "title_note": snapshot["title_note"],
        "extraction": {
            "method": "polilínea vectorial del año en curso + etiquetas impresas",
            "labels": len(geometry.labels),
            "candidates": len(geometry.candidates),
            "selected_color": selection.key,
            "week_spacing_points": round(selection.week_spacing, 4),
            "scale_slope_px_per_case": round(selection.scale.slope, 6),
            "scale_intercept": round(selection.scale.intercept, 4),
            "weeks": len(selection.values),
            "first_week": 1,
            "last_week": len(selection.values),
            "sum_cases": sum(selection.values),
            "min_cases": min(selection.values),
            "max_cases": max(selection.values),
            "positional_label_mismatches": mismatches,
        },
        "controls": controls,
        "notes": snapshot["notes"],
    }


def _build(
    sources: dict[str, Any], geometry_dir: Path
) -> tuple[str, dict[str, Any]]:
    rows: list[WeeklyRow] = []
    provenances: list[dict[str, Any]] = []
    for snapshot in sources["snapshots"]:
        geometry_path = geometry_dir / f"{snapshot['snapshot_id']}.json"
        try:
            payload = json.loads(read_text(geometry_path))
        except OSError as error:
            raise DengueImportError(f"falta la geometría {geometry_path}") from error
        geometry = parse_geometry(payload)
        if geometry.snapshot_id != snapshot["snapshot_id"]:
            raise DengueImportError(
                f"{geometry_path}: snapshot_id {geometry.snapshot_id!r} inesperado"
            )
        if geometry.year != int(snapshot["year"]):
            raise DengueImportError(f"{geometry_path}: año {geometry.year} inesperado")
        selection = select_series(geometry.candidates, geometry.labels)
        check_series(selection.values, expected_weeks=int(snapshot["expected_weeks"]))
        controls = apply_controls(snapshot["controls"], selection.values)
        for week, cases in enumerate(selection.values, start=1):
            rows.append(
                WeeklyRow(
                    province=PROVINCE,
                    year=int(snapshot["year"]),
                    week=week,
                    cases=cases,
                    snapshot_id=snapshot["snapshot_id"],
                )
            )
        provenances.append(_snapshot_provenance(snapshot, geometry, selection, controls))

    rows.sort(key=lambda row: (row.year, row.week))
    validate_rows(rows)
    return render_csv(rows), {
        "schema_version": "manabi-dengue-provenance-v1",
        "dataset_id": sources["dataset_id"],
        "generated_by": "scripts/p05_import_dengue.py",
        "csv_path": "data/p05/manabi-dengue-weekly.csv",
        "row_count": len(rows),
        "geography": sources["geography"],
        "disease": sources["disease"],
        "unit": sources["unit"],
        "value_kind": VALUE_KIND,
        "is_cumulative": sources["is_cumulative"],
        "publisher": sources["publisher"],
        "publisher_unit": sources["publisher_unit"],
        "series_name": sources["series_name"],
        "case_definition": sources["case_definition"],
        "data_status": sources["data_status"],
        "terms": sources["terms"],
        "usage": {
            "wired_into_simulator": False,
            "note": (
                "Datos reales de vigilancia. No se mezclan con posiciones OSM ni con los "
                "casos sintéticos del motor SEIR; esta versión solo los normaliza y audita."
            ),
        },
        "snapshots": provenances,
        "known_limits": sources["known_limits"],
    }


def command_build(args: argparse.Namespace) -> int:
    sources = load_sources(args.sources)
    csv_text, provenance = _build(sources, args.geometry_dir)
    provenance["imported_at_utc"] = args.imported_at or datetime.now(timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    provenance["csv_sha256"] = text_sha256(csv_text)
    csv_path = args.data_dir / "manabi-dengue-weekly.csv"
    provenance_path = args.data_dir / "manabi-dengue-provenance.json"
    write_text(csv_path, csv_text)
    write_text(provenance_path, json.dumps(provenance, ensure_ascii=False, indent=1) + "\n")
    print(
        json.dumps(
            {
                "status": "built",
                "csv": str(csv_path.relative_to(ROOT)),
                "csv_sha256": provenance["csv_sha256"],
                "rows": provenance["row_count"],
                "snapshots": [
                    {
                        "snapshot_id": item["snapshot_id"],
                        "weeks": item["extraction"]["weeks"],
                        "sum_cases": item["extraction"]["sum_cases"],
                        "controls": len(item["controls"]),
                    }
                    for item in provenance["snapshots"]
                ],
            },
            ensure_ascii=False,
        )
    )
    return 0


def _svg_chart(rows: list[WeeklyRow], provenance: dict[str, Any]) -> str:
    """Dibuja la serie normalizada como SVG determinista (sin dependencias)."""

    width, height = 900, 380
    left, right, top, bottom = 64, 24, 44, 64
    plot_width = width - left - right
    plot_height = height - top - bottom
    max_week = max(row.week for row in rows)
    max_cases = max(row.cases for row in rows)
    step = 100 if max_cases <= 1000 else 200
    y_max = ((max_cases // step) + 1) * step

    def x_of(week: int) -> float:
        return left + (week - 1) / (max_week - 1) * plot_width

    def y_of(cases: int) -> float:
        return top + plot_height - cases / y_max * plot_height

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" role="img" '
        'aria-label="Casos semanales de dengue notificados en Manabí">',
        '<rect width="100%" height="100%" fill="#0b1220"/>',
        f'<text x="{left}" y="26" fill="#e8eef7" font-family="Segoe UI, sans-serif" '
        'font-size="15">Dengue notificado en Manabí por semana epidemiológica</text>',
    ]
    tick = 0
    while tick <= y_max:
        y = y_of(tick)
        parts.append(
            f'<line x1="{left}" y1="{y:.1f}" x2="{left + plot_width}" y2="{y:.1f}" '
            'stroke="#243244" stroke-width="1"/>'
        )
        parts.append(
            f'<text x="{left - 8}" y="{y + 4:.1f}" fill="#8fa3bf" text-anchor="end" '
            f'font-family="Segoe UI, sans-serif" font-size="10">{tick}</text>'
        )
        tick += step
    for week in range(1, max_week + 1):
        if week % 5 and week not in {1, max_week}:
            continue
        parts.append(
            f'<text x="{x_of(week):.1f}" y="{top + plot_height + 18}" fill="#8fa3bf" '
            f'text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="10">'
            f"{week}</text>"
        )
    parts.append(
        f'<text x="{left + plot_width / 2:.1f}" y="{height - 10}" fill="#8fa3bf" '
        'text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="11">'
        "Semana epidemiológica</text>"
    )

    palette = {2025: "#4a86c8", 2026: "#c9662f"}
    for index, snapshot in enumerate(provenance["snapshots"]):
        year = int(snapshot["year"])
        series = [row for row in rows if row.year == year]
        points = " ".join(f"{x_of(row.week):.1f},{y_of(row.cases):.1f}" for row in series)
        color = palette.get(year, "#7f8fa6")
        parts.append(
            f'<polyline points="{points}" fill="none" stroke="{color}" stroke-width="2.2" '
            'stroke-linejoin="round"/>'
        )
        legend_x = left + plot_width - 150 + index * 80
        parts.append(
            f'<line x1="{legend_x}" y1="26" x2="{legend_x + 18}" y2="26" stroke="{color}" '
            'stroke-width="3"/>'
        )
        parts.append(
            f'<text x="{legend_x + 24}" y="30" fill="#e8eef7" '
            f'font-family="Segoe UI, sans-serif" font-size="11">{year}</text>'
        )

    digest = provenance["csv_sha256"][:16]
    parts.append(
        f'<text x="{left}" y="{height - 28}" fill="#6f819c" '
        'font-family="Segoe UI, sans-serif" font-size="10">'
        f"Fuente: gacetas ETV del MSP · dataset {provenance['dataset_id']} · "
        f"CSV SHA-256 {digest}… · datos provinciales preliminares</text>"
    )
    parts.append("</svg>")
    return "\n".join(parts) + "\n"


def command_render(args: argparse.Namespace) -> int:
    data_dir = args.data_dir
    csv_text = read_text(data_dir / "manabi-dengue-weekly.csv")
    rows = parse_csv(csv_text)
    validate_rows(rows)
    provenance = json.loads(read_text(data_dir / "manabi-dengue-provenance.json"))
    if provenance.get("csv_sha256") != text_sha256(csv_text):
        raise DengueImportError("el CSV no coincide con la procedencia; regenerar antes de dibujar")
    write_text(args.output, _svg_chart(rows, provenance))
    print(f"SVG escrito en {args.output}")
    return 0


def command_verify(args: argparse.Namespace) -> int:
    data_dir = args.data_dir
    sources = load_sources(data_dir / "sources.json")
    csv_path = data_dir / "manabi-dengue-weekly.csv"
    provenance_path = data_dir / "manabi-dengue-provenance.json"
    csv_text = read_text(csv_path)
    rows = parse_csv(csv_text)
    validate_rows(rows)
    provenance = json.loads(read_text(provenance_path))

    if provenance.get("csv_sha256") != text_sha256(csv_text):
        raise DengueImportError("el SHA-256 del CSV no coincide con la procedencia")
    if int(provenance.get("row_count", -1)) != len(rows):
        raise DengueImportError("row_count de la procedencia no coincide con el CSV")

    expected_csv, recomputed = _build(sources, data_dir / "geometry")
    if expected_csv != csv_text:
        raise DengueImportError("el CSV publicado no es reproducible desde la geometría")
    if recomputed["snapshots"] != provenance["snapshots"]:
        raise DengueImportError("la procedencia publicada no es reproducible desde la geometría")

    summary = {
        "status": "passed",
        "dataset_id": provenance["dataset_id"],
        "csv_sha256": provenance["csv_sha256"],
        "rows": len(rows),
        "years": sorted({row.year for row in rows}),
        "weeks": len(rows),
        "total_cases": sum(row.cases for row in rows),
        "snapshots": [
            {
                "snapshot_id": item["snapshot_id"],
                "weeks": item["extraction"]["weeks"],
                "sum_cases": item["extraction"]["sum_cases"],
                "controls": [control["kind"] for control in item["controls"]],
                "positional_label_mismatches": len(
                    item["extraction"]["positional_label_mismatches"]
                ),
            }
            for item in provenance["snapshots"]
        ],
    }
    print(json.dumps(summary, ensure_ascii=False))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    download = subparsers.add_parser("download", help="descarga y verifica los PDF del MSP")
    download.add_argument("--sources", type=Path, default=DEFAULT_SOURCES)
    download.add_argument("--pdf-dir", type=Path, default=DEFAULT_PDF_DIR)
    download.set_defaults(handler=command_download)

    extract = subparsers.add_parser("extract", help="extrae la geometría del gráfico (PyMuPDF)")
    extract.add_argument("--sources", type=Path, default=DEFAULT_SOURCES)
    extract.add_argument("--pdf-dir", type=Path, default=DEFAULT_PDF_DIR)
    extract.add_argument("--geometry-dir", type=Path, default=DEFAULT_DATA_DIR / "geometry")
    extract.add_argument("--only", help="procesa solo esta instantánea")
    extract.set_defaults(handler=command_extract)

    build = subparsers.add_parser("build", help="escribe el CSV y la procedencia")
    build.add_argument("--sources", type=Path, default=DEFAULT_SOURCES)
    build.add_argument("--geometry-dir", type=Path, default=DEFAULT_DATA_DIR / "geometry")
    build.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    build.add_argument("--imported-at", help="marca temporal fija para reproducibilidad")
    build.set_defaults(handler=command_build)

    verify = subparsers.add_parser("verify", help="recalcula y compara los artefactos")
    verify.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    verify.set_defaults(handler=command_verify)

    render = subparsers.add_parser("render", help="dibuja la serie normalizada como SVG")
    render.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    render.add_argument(
        "--output",
        type=Path,
        default=ROOT / "docs/evidencia/figuras/p05-dengue-manabi.svg",
    )
    render.set_defaults(handler=command_render)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return int(args.handler(args))
    except DengueImportError as error:
        print(f"P-05: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
