"""P-05: importación verificable de la serie semanal de dengue de Manabí.

Las pruebas usan la geometría real extraída de las gacetas del MSP y las
funciones puras del módulo: no descargan nada ni necesitan PyMuPDF.
"""

import json
from pathlib import Path

import pytest

from data.dengue import (
    ChartLabel,
    DengueImportError,
    PolylinePoint,
    WeeklyRow,
    apply_controls,
    parse_csv,
    parse_geometry,
    reconcile_case_components,
    reconcile_official_total,
    reconcile_rate_components,
    render_csv,
    select_series,
    text_sha256,
    validate_rows,
)

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data/p05"
GEOMETRY = DATA / "geometry"

EXPECTED_2025 = [
    31, 86, 95, 112, 94, 85, 141, 138, 153, 143, 189, 235, 213, 279, 256, 215, 264, 212,
    275, 228, 232, 200, 263, 200, 163, 164, 113, 107, 125, 102, 127, 97, 60, 66, 52, 57,
    67, 56, 75, 52, 36, 52, 53, 37, 30, 28, 29, 41, 27, 28, 63, 49, 18,
]  # fmt: skip
EXPECTED_2026 = [
    64, 51, 70, 71, 84, 89, 87, 196, 151, 209, 186, 171, 178, 169, 226, 255, 274, 289,
    303, 319, 271, 279, 314, 323, 366, 413, 476, 517, 421, 463, 449, 400, 432, 402, 467,
    401, 470, 462, 449, 365, 364,
]  # fmt: skip
EXPECTED_CSV_SHA256 = "e51b0858624ccd32349e86fcee57777bc1834579b80416e21ce54b1b11d1913a"


def load_geometry(snapshot_id: str):
    payload = json.loads((GEOMETRY / f"{snapshot_id}.json").read_text(encoding="utf-8"))
    return parse_geometry(payload)


def load_sources() -> dict:
    return json.loads((DATA / "sources.json").read_text(encoding="utf-8"))


def read_csv_text() -> str:
    with (DATA / "manabi-dengue-weekly.csv").open("r", encoding="utf-8", newline="") as stream:
        return stream.read()


def synthetic_geometry(values: list[int]) -> tuple[list[PolylinePoint], list[ChartLabel]]:
    """Serie pequeña con escala exacta: y = 200 - 3 * valor."""

    points = [
        PolylinePoint(x=10.0 * index, y=200.0 - 3.0 * value) for index, value in enumerate(values)
    ]
    labels = [
        ChartLabel(x=10.0 * index, y=200.0 - 3.0 * value, value=value)
        for index, value in enumerate(values)
    ]
    return points, labels


def test_select_series_requires_exactly_one_candidate() -> None:
    points, labels = synthetic_geometry([10, 30, 20, 40])
    selection = select_series({"a": points}, labels)
    assert list(selection.values) == [10, 30, 20, 40]
    assert selection.scale.slope < 0
    assert selection.positional_mismatches == ()

    with pytest.raises(DengueImportError, match="exactamente una"):
        select_series({"a": points, "b": list(points)}, labels)


def test_select_series_rejects_series_that_do_not_reproduce_labels() -> None:
    points, labels = synthetic_geometry([10, 30, 20, 40])
    wrong = list(points)
    wrong[1] = PolylinePoint(x=points[1].x, y=points[1].y - 20.0)
    with pytest.raises(DengueImportError, match="no reproducidas"):
        select_series({"a": wrong}, labels)


def test_select_series_rejects_irregular_week_axis() -> None:
    points, labels = synthetic_geometry([10, 30, 20, 40])
    irregular = [points[0], points[1], PolylinePoint(x=25.0, y=points[2].y), points[3]]
    with pytest.raises(DengueImportError, match="irregular"):
        select_series({"a": irregular}, labels)


def test_2026_geometry_reproduces_all_labels_and_the_official_total() -> None:
    geometry = load_geometry("msp-etv-se41-2026")
    assert len(geometry.candidates) == 6
    assert len(geometry.labels) == 41
    selection = select_series(geometry.candidates, geometry.labels)
    assert list(selection.values) == EXPECTED_2026
    assert selection.positional_mismatches == ()
    assert sum(selection.values) == 11946
    assert 17.0 < selection.week_spacing < 17.3


def test_2025_geometry_reproduces_all_labels_and_the_published_rates() -> None:
    geometry = load_geometry("msp-etv-se53-2025")
    assert len(geometry.candidates) == 5
    assert len(geometry.labels) == 53
    selection = select_series(geometry.candidates, geometry.labels)
    assert list(selection.values) == EXPECTED_2025
    # Semanas 26 y 27: las etiquetas impresas se solapan y salen desordenadas.
    assert selection.positional_mismatches == ((26, 164, 113), (27, 113, 164))
    assert sum(selection.values) == 6313


def test_declared_controls_pass_on_the_real_series() -> None:
    sources = load_sources()
    for snapshot in sources["snapshots"]:
        geometry = load_geometry(snapshot["snapshot_id"])
        selection = select_series(geometry.candidates, geometry.labels)
        results = apply_controls(snapshot["controls"], selection.values)
        assert results and all(result["passed"] for result in results)
        assert snapshot["sha256"] == snapshot["sha256"].lower()
        assert len(snapshot["sha256"]) == 64
        assert snapshot["url"].startswith("https://www.salud.gob.ec/")


def test_2025_rate_control_reconstructs_integer_cases() -> None:
    reconciliation = reconcile_rate_components(EXPECTED_2025, [64.4, 2.77, 311.72, 1.08], 379.97)
    assert reconciliation.component_cases == (1070, 46, 5179, 18)
    assert reconciliation.reconstructed_total == 6313
    assert 1_660_000 < reconciliation.implied_population < 1_663_000


def test_controls_reject_inconsistent_numbers() -> None:
    with pytest.raises(DengueImportError, match="tabla oficial"):
        reconcile_official_total(EXPECTED_2026, 11947)
    with pytest.raises(DengueImportError, match="tasas por componente"):
        reconcile_rate_components(EXPECTED_2025, [64.4, 2.77, 311.72], 379.97)
    with pytest.raises(DengueImportError, match="componentes suman"):
        reconcile_case_components(EXPECTED_2026, {"DSSA": 1, "DCSA": 1})


def test_csv_is_normalized_and_matches_provenance() -> None:
    text = read_csv_text()
    rows = parse_csv(text)
    validate_rows(rows)
    provenance = json.loads((DATA / "manabi-dengue-provenance.json").read_text(encoding="utf-8"))

    assert text_sha256(text) == EXPECTED_CSV_SHA256
    assert provenance["csv_sha256"] == EXPECTED_CSV_SHA256
    assert provenance["row_count"] == len(rows) == 94
    assert provenance["value_kind"] == "weekly_cases"
    assert provenance["is_cumulative"] is False
    assert provenance["usage"]["wired_into_simulator"] is False
    assert sorted({row.year for row in rows}) == [2025, 2026]

    for snapshot in provenance["snapshots"]:
        subset = [row for row in rows if row.snapshot_id == snapshot["snapshot_id"]]
        expected = EXPECTED_2025 if snapshot["year"] == 2025 else EXPECTED_2026
        assert [row.cases for row in subset] == expected
        assert [row.week for row in subset] == list(range(1, len(expected) + 1))
        assert sum(row.cases for row in subset) == snapshot["extraction"]["sum_cases"]


def test_csv_round_trip_is_byte_stable() -> None:
    text = read_csv_text()
    assert render_csv(parse_csv(text)) == text


def test_duplicate_weeks_are_rejected() -> None:
    rows = [
        WeeklyRow("MANABI", 2025, 1, 10, "a"),
        WeeklyRow("MANABI", 2025, 1, 20, "a"),
    ]
    with pytest.raises(DengueImportError, match="duplicada"):
        validate_rows(rows)


def test_rows_must_be_ordered_and_in_range() -> None:
    with pytest.raises(DengueImportError, match="ordenadas"):
        validate_rows(
            [
                WeeklyRow("MANABI", 2025, 2, 10, "a"),
                WeeklyRow("MANABI", 2025, 1, 20, "a"),
            ]
        )
    with pytest.raises(DengueImportError, match="fuera de rango"):
        validate_rows([WeeklyRow("MANABI", 2025, 54, 10, "a")])
    with pytest.raises(DengueImportError, match="provincia"):
        validate_rows([WeeklyRow("GUAYAS", 2025, 1, 10, "a")])


def test_geometry_payload_is_validated() -> None:
    with pytest.raises(DengueImportError, match="marco"):
        parse_geometry({"frame": [0, 0, 1], "labels": [], "candidates": {}})
    with pytest.raises(DengueImportError, match="etiquetas"):
        parse_geometry({"frame": [0, 0, 1, 1], "labels": [], "candidates": {"a": []}})
    with pytest.raises(DengueImportError, match="polilíneas"):
        parse_geometry({"frame": [0, 0, 1, 1], "labels": [{"x": 0, "y": 0, "value": 1}]})
