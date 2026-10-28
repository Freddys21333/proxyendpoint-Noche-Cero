"""P-08: informe derivado de experimentos reales, sin ciencia en frontend."""

import copy
import io

import pytest

from domain.configuration import normalize_configuration
from simulation.experiments import run_experiment
from simulation.exports import export_experiment
from simulation.report import build_report, render_pdf


def test_report_accepts_bounded_gzip(experiment, monkeypatch):
    import base64
    import gzip
    import json

    import api.report as endpoint

    event = {
        "rawPath": "/v1/reports/mayor",
        "requestContext": {"http": {"method": "POST"}},
        "headers": {"Content-Encoding": "gzip"},
        "isBase64Encoded": True,
        "body": base64.b64encode(gzip.compress(json.dumps(experiment).encode())).decode(),
    }
    assert endpoint.handler(event, None)["statusCode"] == 200
    event["body"] = base64.b64encode(b"invalid gzip").decode()
    assert endpoint.handler(event, None)["statusCode"] == 400
    monkeypatch.setattr(endpoint, "MAX_DOCUMENT_BYTES", 100)
    event["body"] = base64.b64encode(gzip.compress(b" " * 101)).decode()
    assert endpoint.handler(event, None)["statusCode"] == 413


@pytest.fixture
def experiment():
    return export_experiment(
        run_experiment(
            normalize_configuration(
                {
                    "scenario": {"populationSize": 50, "days": 3, "beta": 0},
                    "intervention": {"vaccines": 0},
                    "repetitions": 2,
                }
            ),
            include_representative_frames=False,
        )
    )


def test_report_uses_real_aggregates_and_preserves_document(experiment):
    before = copy.deepcopy(experiment)
    report = build_report(experiment)
    assert report["experimentHash"] == experiment["manifest"]["experimentHash"]
    assert report["recommendation"]["winner"] == "tie"
    assert (
        report["rows"][0]["infected"]
        == experiment["summaryByPolicy"]["none"]["cumulativeInfected"]["mean"]
    )
    assert report["rows"][1]["costPerAvoidedCents"] is None
    assert report["rows"][1]["spentCents"] is None
    assert report["comparisons"][2]["ties"] == 2
    assert experiment == before


@pytest.mark.parametrize(
    "field", ["summaryByPolicy", "recommendation", "progress", "replicates", "configuration"]
)
def test_report_rejects_tampered_or_partial_experiments(experiment, field):
    changed = copy.deepcopy(experiment)
    if field == "summaryByPolicy":
        changed[field]["none"]["cumulativeInfected"]["mean"] += 1
    elif field == "recommendation":
        changed[field]["winner"] = "targeted"
    elif field == "progress":
        changed[field]["replicatesSucceeded"] = 1
    elif field == "replicates":
        changed[field].pop()
    else:
        changed[field]["rootSeed"] += 1
    with pytest.raises(ValueError):
        build_report(changed)


def test_pdf_is_deterministic_and_contains_traceable_text(experiment):
    from pypdf import PdfReader

    report = build_report(experiment)
    pdf = render_pdf(report)
    assert pdf == render_pdf(report)
    reader = PdfReader(io.BytesIO(pdf))
    text = "\n".join(page.extract_text() for page in reader.pages)
    assert "Comité de Contención de Manta" in text
    assert "No hay evidencia suficiente" in text
    assert "fitted-not-validated" in text
    assert report["experimentHash"] in text.replace("\n", "")
    assert len(reader.pages) == 2
    assert "Resumen para decidir" in text
    assert "Anexo: configuración completa" not in text


def test_executive_pdf_stays_two_pages_with_resources_and_many_replicates():
    from pypdf import PdfReader
    from test_combined import PLAN

    configuration = normalize_configuration(
        {
            "scenario": {"populationSize": 50, "days": 3},
            "repetitions": 30,
            "intervention": {"vaccines": 10, "combined": PLAN},
        }
    )
    source = export_experiment(run_experiment(configuration, include_representative_frames=False))
    pdf = render_pdf(build_report(source))
    reader = PdfReader(io.BytesIO(pdf))
    assert len(reader.pages) == 2
    text = "\n".join(page.extract_text() for page in reader.pages)
    assert "Presupuesto" in text
    assert "empates" in text and "pérdidas" in text
    assert source["manifest"]["experimentHash"] in text.replace("\n", "")


def test_report_http_pdf_and_sane_errors(experiment):
    import base64
    import json

    from api.report import handler
    from domain.reproducibility import canonical_json

    event = dict(
        rawPath="/v1/reports/mayor",
        requestContext={"http": {"method": "POST"}},
        body=canonical_json(experiment).decode(),
        isBase64Encoded=False,
    )
    response = handler(event, None)
    assert response["statusCode"] == 200
    assert response["headers"]["Content-Type"] == "application/pdf"
    assert base64.b64decode(response["body"]).startswith(b"%PDF-")
    event["body"] = "{}"
    response = handler(event, None)
    assert response["statusCode"] == 422
    assert json.loads(response["body"])["error"]["code"] == "VALIDATION_ERROR"
    event["body"] = "{"
    assert handler(event, None)["statusCode"] == 400
    event["requestContext"]["http"]["method"] = "GET"
    assert handler(event, None)["statusCode"] == 405


@pytest.mark.parametrize("budget", [0, 10000])
def test_report_costs_match_consumption_and_not_assumed_prices(budget):
    from test_combined import PLAN

    cfg = normalize_configuration(
        {
            "scenario": {"populationSize": 50, "days": 3, "beta": 0},
            "repetitions": 2,
            "intervention": {"vaccines": 3, "combined": {**PLAN, "budgetCents": budget}},
        }
    )
    source = export_experiment(run_experiment(cfg, include_representative_frames=False))
    report = build_report(source)
    for row in report["rows"]:
        expected = (
            sum(
                rep["policies"][row["policy"]]["daily"][-1]["spentCents"]
                for rep in source["replicates"]
            )
            / 2
        )
        assert row["spentCents"] == expected
        assert row["remainingCents"] == budget - expected
        assert row["costPerAvoidedCents"] is None  # beta=0: ninguna mejora positiva
    assert report["rows"][0]["spentCents"] == 0


def test_report_keeps_bootstrap_and_all_paired_outcomes():
    cfg = normalize_configuration(
        {
            "scenario": {"populationSize": 50, "days": 3},
            "intervention": {"vaccines": 10},
            "repetitions": 30,
        }
    )
    source = export_experiment(run_experiment(cfg, include_representative_frames=False))
    report = build_report(source)
    assert report["recommendation"] == source["recommendation"]
    for comp in report["comparisons"]:
        assert comp["bootstrap"]["resamples"] == 2000
        assert comp["wins"] + comp["ties"] + comp["losses"] == 30
        assert comp["losses"] == sum(v < 0 for v in comp["values"])


def test_http_report_accepts_export_larger_than_configuration_limit(experiment):
    import importlib.util
    import threading
    import urllib.request
    from pathlib import Path

    from domain.reproducibility import canonical_json

    spec = importlib.util.spec_from_file_location(
        "serve_report", Path(__file__).resolve().parents[2] / "scripts/serve_api.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    server = module.create_server(port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        raw = canonical_json(experiment)
        raw += b" " * max(0, 65537 - len(raw))
        req = urllib.request.Request(
            f"http://127.0.0.1:{server.server_port}/v1/reports/mayor", data=raw
        )
        with urllib.request.urlopen(req, timeout=20) as response:
            assert response.headers["Content-Type"] == "application/pdf"
            assert response.read().startswith(b"%PDF-")
    finally:
        server.shutdown()
        thread.join(timeout=5)
        server.server_close()


def test_cli_generates_identical_pdf_and_rejects_replacing_source(experiment, tmp_path):
    import subprocess
    import sys
    from pathlib import Path

    from domain.reproducibility import canonical_json

    script = Path(__file__).resolve().parents[2] / "scripts/report_mayor.py"
    source = tmp_path / "experiment.json"
    output = tmp_path / "report.pdf"
    raw = canonical_json(experiment)
    source.write_bytes(raw)
    command = [sys.executable, str(script), str(source), "--output"]
    run = subprocess.run([*command, str(output)], capture_output=True, timeout=30)
    assert run.returncode == 0, run.stderr
    assert output.read_bytes() == render_pdf(build_report(experiment))
    assert subprocess.run([*command, str(source)], capture_output=True, timeout=30).returncode == 1
    assert source.read_bytes() == raw
