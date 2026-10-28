"""Publica dist en una app Amplify existente sin mostrar la URL firmada."""

import argparse
import json
import shutil
import subprocess
import urllib.request
import zipfile
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app-id", required=True)
    parser.add_argument("--branch", default="staging")
    parser.add_argument("--region", default="us-east-2")
    args = parser.parse_args()
    aws = shutil.which("aws") or r"C:\Program Files\Amazon\AWSCLIV2\aws.exe"
    root = Path(__file__).resolve().parents[1]
    archive = root / ".tools/build/frontend.zip"
    archive.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as output:
        for path in sorted((root / "frontend/dist").rglob("*")):
            if path.is_file():
                output.write(path, path.relative_to(root / "frontend/dist").as_posix())
    command = [aws, "amplify", "create-deployment", "--app-id", args.app_id,
               "--branch-name", args.branch, "--region", args.region, "--output", "json"]
    deployment = json.loads(subprocess.check_output(command))
    request = urllib.request.Request(deployment["zipUploadUrl"], data=archive.read_bytes(), method="PUT",
                                     headers={"Content-Type": "application/zip"})
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            assert response.status == 200
    except Exception:
        raise SystemExit("Falló la carga del ZIP; no se muestra la URL firmada.") from None
    subprocess.run([aws, "amplify", "start-deployment", "--app-id", args.app_id,
                    "--branch-name", args.branch, "--region", args.region,
                    "--job-id", deployment["jobId"], "--query", "jobSummary.{id:jobId,status:status}"], check=True)


if __name__ == "__main__":
    main()
