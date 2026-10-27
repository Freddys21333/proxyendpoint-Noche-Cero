"""P-05: serie semanal de dengue de Manabí publicada por el MSP.

Este módulo contiene solo lógica pura: selección de la polilínea correcta en
un gráfico vectorial, ajuste de escala, derivación de la serie, controles de
totales y (de)serialización del CSV y la geometría. No descarga archivos ni
usa PyMuPDF; la adaptación al PDF vive en ``scripts/p05_import_dengue.py``.

La regla central es que **toda cifra publicada como etiqueta debe ser
reproducida por la geometría**. Si una polilínea candidata no reproduce
exactamente el multiconjunto de etiquetas, se descarta. Así la selección del
año no depende del título (que en las gacetas es inconsistente) ni de la
posición de la leyenda.
"""

from __future__ import annotations

import csv
import hashlib
import io
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

CSV_COLUMNS = ("province", "year", "week", "cases", "snapshot_id")
PROVINCE = "MANABI"
VALUE_KIND = "weekly_cases"


class DengueImportError(ValueError):
    """La fuente no permite una extracción o un control defendible."""


@dataclass(frozen=True, slots=True)
class ChartLabel:
    """Etiqueta numérica impresa junto a un punto del gráfico."""

    x: float
    y: float
    value: int


@dataclass(frozen=True, slots=True)
class PolylinePoint:
    """Vértice de una polilínea del gráfico, en puntos PDF."""

    x: float
    y: float


@dataclass(frozen=True, slots=True)
class Scale:
    """Recta ``y = intercept + slope * value`` ajustada con los extremos."""

    slope: float
    intercept: float
    top_y: float
    bottom_y: float
    max_value: int
    min_value: int

    @property
    def pixels_per_case(self) -> float:
        return abs(self.slope)


@dataclass(frozen=True, slots=True)
class SeriesSelection:
    """Polilínea elegida y valores derivados de su geometría."""

    key: str
    points: tuple[PolylinePoint, ...]
    values: tuple[int, ...]
    scale: Scale
    week_spacing: float
    positional_mismatches: tuple[tuple[int, int, int], ...]


@dataclass(frozen=True, slots=True)
class ChartGeometry:
    """Geometría extraída de un gráfico, antes de derivar la serie."""

    snapshot_id: str
    year: int
    chart_page: int
    chart_title: str
    frame: tuple[float, ...]
    labels: tuple[ChartLabel, ...]
    candidates: Mapping[str, tuple[PolylinePoint, ...]]


@dataclass(frozen=True, slots=True)
class WeeklyRow:
    """Una observación semanal normalizada."""

    province: str
    year: int
    week: int
    cases: int
    snapshot_id: str


@dataclass(frozen=True, slots=True)
class RateReconciliation:
    """Control indirecto de totales a partir de tasas por 100 000 habitantes."""

    implied_population: float
    component_cases: tuple[int, ...]
    component_rates: tuple[float, ...]
    reconstructed_total: int
    total_cases: int
    total_rate: float


def _as_float(value: Any, name: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as error:
        raise DengueImportError(f"{name} no es numérico: {value!r}") from error


def _as_int(value: Any, name: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError) as error:
        raise DengueImportError(f"{name} no es entero: {value!r}") from error


def parse_geometry(payload: Any) -> ChartGeometry:
    """Valida y convierte el JSON de geometría cruda."""

    if not isinstance(payload, dict):
        raise DengueImportError("la geometría debe ser un objeto JSON")
    raw_frame = payload.get("frame")
    if not isinstance(raw_frame, list) or len(raw_frame) != 4:
        raise DengueImportError("el marco debe tener cuatro coordenadas")
    frame = tuple(_as_float(value, "frame") for value in raw_frame)

    raw_labels = payload.get("labels")
    if not isinstance(raw_labels, list) or not raw_labels:
        raise DengueImportError("faltan las etiquetas del gráfico")
    labels = []
    for raw in raw_labels:
        if not isinstance(raw, dict):
            raise DengueImportError("cada etiqueta debe ser un objeto")
        labels.append(
            ChartLabel(
                x=_as_float(raw.get("x"), "label.x"),
                y=_as_float(raw.get("y"), "label.y"),
                value=_as_int(raw.get("value"), "label.value"),
            )
        )

    raw_candidates = payload.get("candidates")
    if not isinstance(raw_candidates, dict) or not raw_candidates:
        raise DengueImportError("faltan las polilíneas candidatas")
    candidates: dict[str, tuple[PolylinePoint, ...]] = {}
    for key, raw_points in raw_candidates.items():
        if not isinstance(raw_points, list) or len(raw_points) < 2:
            raise DengueImportError(f"la polilínea {key!r} no tiene puntos suficientes")
        points = []
        for raw in raw_points:
            if not isinstance(raw, dict):
                raise DengueImportError(f"punto inválido en la polilínea {key!r}")
            points.append(
                PolylinePoint(
                    x=_as_float(raw.get("x"), "point.x"),
                    y=_as_float(raw.get("y"), "point.y"),
                )
            )
        candidates[str(key)] = tuple(points)

    return ChartGeometry(
        snapshot_id=str(payload.get("snapshot_id", "")),
        year=_as_int(payload.get("year"), "year"),
        chart_page=_as_int(payload.get("chart_page"), "chart_page"),
        chart_title=str(payload.get("chart_title", "")),
        frame=frame,
        labels=tuple(labels),
        candidates=candidates,
    )


def check_uniform_spacing(points: Sequence[PolylinePoint], *, tolerance: float = 0.02) -> float:
    """Exige un eje de semanas estrictamente creciente y equiespaciado."""

    if len(points) < 3:
        raise DengueImportError("se necesitan al menos tres puntos")
    deltas = [later.x - earlier.x for earlier, later in zip(points, points[1:], strict=False)]
    if min(deltas) <= 0:
        raise DengueImportError("el eje de semanas no es estrictamente creciente")
    ordered = sorted(deltas)
    median = ordered[len(ordered) // 2]
    if median <= 0:
        raise DengueImportError("el espaciado semanal no es positivo")
    for delta in deltas:
        if abs(delta - median) > median * tolerance:
            raise DengueImportError(
                f"espaciado semanal irregular: {delta:.4f} frente a {median:.4f}"
            )
    return median


def fit_scale(points: Sequence[PolylinePoint], labels: Sequence[ChartLabel]) -> Scale:
    """Ajusta la recta usando el máximo y el mínimo de las etiquetas.

    Los extremos son los puntos con menor riesgo de solapamiento: el valor
    máximo se dibuja en el vértice más alto y el mínimo en el más bajo.
    """

    if len(labels) < 2:
        raise DengueImportError("se necesitan al menos dos etiquetas para escalar")
    values = {label.value for label in labels}
    if len(values) < 2:
        raise DengueImportError("todas las etiquetas tienen el mismo valor")
    max_value = max(values)
    min_value = min(values)
    top_y = min(point.y for point in points)
    bottom_y = max(point.y for point in points)
    if bottom_y - top_y <= 0:
        raise DengueImportError("la polilínea no tiene altura")
    slope = (top_y - bottom_y) / (max_value - min_value)
    if slope >= 0:
        raise DengueImportError("la escala no es descendente")
    return Scale(
        slope=slope,
        intercept=top_y - slope * max_value,
        top_y=top_y,
        bottom_y=bottom_y,
        max_value=max_value,
        min_value=min_value,
    )


def derive_values(points: Sequence[PolylinePoint], scale: Scale) -> list[int]:
    """Convierte cada vértice en un número entero de casos."""

    derived = []
    for point in points:
        raw = (point.y - scale.intercept) / scale.slope
        if raw < -0.5:
            raise DengueImportError(f"valor negativo no explicable: {raw:.3f}")
        derived.append(round(max(0.0, raw)))
    return derived


def select_series(
    candidates: Mapping[str, Sequence[PolylinePoint]], labels: Sequence[ChartLabel]
) -> SeriesSelection:
    """Elige la única polilínea que reproduce todas las etiquetas impresas."""

    ordered_labels = sorted(labels, key=lambda label: label.x)
    label_values = [label.value for label in ordered_labels]
    expected = Counter(label_values)
    matches: list[SeriesSelection] = []
    diagnostics: list[str] = []

    for key, raw_points in candidates.items():
        if len(raw_points) != len(label_values):
            diagnostics.append(f"{key}: {len(raw_points)} puntos != {len(label_values)} etiquetas")
            continue
        points = tuple(sorted(raw_points, key=lambda point: point.x))
        try:
            spacing = check_uniform_spacing(points)
            scale = fit_scale(points, ordered_labels)
            values = derive_values(points, scale)
        except DengueImportError as error:
            diagnostics.append(f"{key}: {error}")
            continue
        if Counter(values) != expected:
            missing = sum((expected - Counter(values)).values())
            diagnostics.append(f"{key}: {missing} etiquetas no reproducidas")
            continue
        mismatches = tuple(
            (index + 1, derived, printed)
            for index, (derived, printed) in enumerate(zip(values, label_values, strict=False))
            if derived != printed
        )
        matches.append(
            SeriesSelection(
                key=key,
                points=points,
                values=tuple(values),
                scale=scale,
                week_spacing=spacing,
                positional_mismatches=mismatches,
            )
        )

    if len(matches) != 1:
        detail = "; ".join(diagnostics) or "sin candidatos evaluables"
        raise DengueImportError(
            f"se esperaba exactamente una polilínea con todas las etiquetas; {detail}"
        )
    return matches[0]


def check_series(values: Sequence[int], *, expected_weeks: int) -> None:
    """Comprueba que la serie cubre todas las semanas y no tiene huecos."""

    if len(values) != expected_weeks:
        raise DengueImportError(
            f"se esperaban {expected_weeks} semanas y se obtuvieron {len(values)}"
        )
    for week, cases in enumerate(values, start=1):
        if cases < 0:
            raise DengueImportError(f"semana {week}: casos negativos")
    if sum(values) <= 0:
        raise DengueImportError("la serie no tiene casos")


def reconcile_official_total(values: Sequence[int], official_total: int) -> int:
    """Control directo: la suma semanal debe igualar la tabla provincial."""

    total = sum(values)
    if total != official_total:
        raise DengueImportError(
            f"el total semanal {total} no coincide con la tabla oficial {official_total}"
        )
    return total


def reconcile_rate_components(
    values: Sequence[int],
    component_rates: Sequence[float],
    total_rate: float,
    *,
    tolerance: int = 0,
) -> RateReconciliation:
    """Control indirecto cuando la tabla solo publica tasas por 100 000.

    Las tasas por componente deben sumar la tasa total; con la población
    implícita, cada componente reconstruye un entero de casos y la suma debe
    volver a dar el total semanal.
    """

    if not component_rates:
        raise DengueImportError("faltan las tasas por componente")
    if total_rate <= 0:
        raise DengueImportError("la tasa total debe ser positiva")
    rate_sum = sum(component_rates)
    if abs(rate_sum - total_rate) > 0.01:
        raise DengueImportError(
            f"las tasas por componente suman {rate_sum:.2f} y la total es {total_rate:.2f}"
        )
    total = sum(values)
    if total <= 0:
        raise DengueImportError("la serie no tiene casos")
    implied_population = total / total_rate * 100_000
    component_cases = tuple(round(rate / 100_000 * implied_population) for rate in component_rates)
    reconstructed = sum(component_cases)
    if abs(reconstructed - total) > tolerance:
        raise DengueImportError(
            f"las tasas reconstruyen {reconstructed} casos y la serie suma {total}"
        )
    return RateReconciliation(
        implied_population=implied_population,
        component_cases=component_cases,
        component_rates=tuple(component_rates),
        reconstructed_total=reconstructed,
        total_cases=total,
        total_rate=total_rate,
    )


def reconcile_case_components(
    values: Sequence[int], components: Mapping[str, int]
) -> dict[str, int]:
    """Control directo por clasificación: los componentes suman el total."""

    if not components:
        raise DengueImportError("faltan los componentes de casos")
    if any(cases < 0 for cases in components.values()):
        raise DengueImportError("hay componentes con casos negativos")
    total = sum(values)
    component_total = sum(components.values())
    if component_total != total:
        raise DengueImportError(f"los componentes suman {component_total} y la serie suma {total}")
    return dict(components)


def apply_control(control: Mapping[str, Any], values: Sequence[int]) -> dict[str, Any]:
    """Ejecuta un control declarado en el manifiesto de fuentes."""

    kind = control.get("kind")
    if kind == "official-total":
        official_total = _as_int(control.get("official_total"), "official_total")
        total = reconcile_official_total(values, official_total)
        return {
            "kind": kind,
            "official_total": official_total,
            "weekly_total": total,
            "passed": True,
        }
    if kind == "case-components":
        raw_components = control.get("components")
        if not isinstance(raw_components, list):
            raise DengueImportError("components debe ser una lista")
        components = {}
        for raw in raw_components:
            if not isinstance(raw, dict):
                raise DengueImportError("cada componente debe ser un objeto")
            label = str(raw.get("label", "")).strip()
            if not label:
                raise DengueImportError("cada componente necesita etiqueta")
            components[label] = _as_int(raw.get("cases"), "component.cases")
        checked = reconcile_case_components(values, components)
        return {
            "kind": kind,
            "components": checked,
            "component_total": sum(checked.values()),
            "weekly_total": sum(values),
            "passed": True,
        }
    if kind == "rate-components":
        raw_rates = control.get("component_rates")
        if not isinstance(raw_rates, list):
            raise DengueImportError("component_rates debe ser una lista")
        rates = tuple(_as_float(rate, "component_rate") for rate in raw_rates)
        total_rate = _as_float(control.get("total_rate"), "total_rate")
        reconciliation = reconcile_rate_components(values, rates, total_rate)
        labels = control.get("component_labels")
        return {
            "kind": kind,
            "component_labels": list(labels) if isinstance(labels, list) else [],
            "component_rates": list(reconciliation.component_rates),
            "total_rate": reconciliation.total_rate,
            "implied_population": round(reconciliation.implied_population, 3),
            "component_cases": list(reconciliation.component_cases),
            "reconstructed_total": reconciliation.reconstructed_total,
            "weekly_total": reconciliation.total_cases,
            "passed": True,
        }
    raise DengueImportError(f"control desconocido: {kind!r}")


def apply_controls(
    controls: Sequence[Mapping[str, Any]], values: Sequence[int]
) -> list[dict[str, Any]]:
    """Ejecuta todos los controles de una fuente y devuelve su evidencia."""

    if not controls:
        raise DengueImportError("la fuente no declara controles de totales")
    return [apply_control(control, values) for control in controls]


def validate_rows(rows: Sequence[WeeklyRow]) -> None:
    """Control de duplicados, orden y valores del CSV normalizado."""

    if not rows:
        raise DengueImportError("el conjunto normalizado está vacío")
    seen: set[tuple[int, int]] = set()
    previous: tuple[int, int] | None = None
    for row in rows:
        if row.province != PROVINCE:
            raise DengueImportError(f"provincia inesperada: {row.province!r}")
        if not 2000 <= row.year <= 2100:
            raise DengueImportError(f"año fuera de rango: {row.year}")
        if not 1 <= row.week <= 53:
            raise DengueImportError(f"semana fuera de rango: {row.week}")
        if row.cases < 0:
            raise DengueImportError(f"casos negativos en {row.year}-S{row.week}")
        key = (row.year, row.week)
        if key in seen:
            raise DengueImportError(
                f"semana duplicada {row.year}-S{row.week}: no se suman acumulados"
            )
        seen.add(key)
        if previous is not None and key <= previous:
            raise DengueImportError("las filas deben estar ordenadas por año y semana")
        previous = key


def render_csv(rows: Sequence[WeeklyRow]) -> str:
    """Serializa las filas con terminador LF para que el hash sea estable."""

    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(CSV_COLUMNS)
    for row in rows:
        writer.writerow([row.province, row.year, row.week, row.cases, row.snapshot_id])
    return buffer.getvalue()


def parse_csv(text: str) -> list[WeeklyRow]:
    """Lee el CSV normalizado y rechaza encabezados o celdas inválidas."""

    reader = csv.DictReader(io.StringIO(text))
    if tuple(reader.fieldnames or ()) != CSV_COLUMNS:
        raise DengueImportError(
            f"encabezado inesperado: {reader.fieldnames!r}; se esperaba {CSV_COLUMNS!r}"
        )
    rows = []
    for raw in reader:
        rows.append(
            WeeklyRow(
                province=str(raw.get("province") or ""),
                year=_as_int(raw.get("year"), "year"),
                week=_as_int(raw.get("week"), "week"),
                cases=_as_int(raw.get("cases"), "cases"),
                snapshot_id=str(raw.get("snapshot_id") or ""),
            )
        )
    return rows


def text_sha256(text: str) -> str:
    """SHA-256 hexadecimal del texto en UTF-8."""

    return hashlib.sha256(text.encode("utf-8")).hexdigest()
