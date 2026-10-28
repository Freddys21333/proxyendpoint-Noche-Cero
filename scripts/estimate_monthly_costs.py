"""Estimación de planificación en USD; no consulta AWS ni acredita facturación."""

from decimal import Decimal as D


def estimate():
    rate = D("0.0000166667")
    # Invocaciones: cantidad, memoria GB, segundos facturados supuestos.
    workloads = [
        (1000, "2.9375", "3"),  # comparación
        (1000, "1", "1"),  # preview
        (200, "2", "2"),  # informe
        (8000, "0.25", "0.1"),  # health/config
        (1000, "1", "0.2"),  # API de trabajos y sondeo
        (2000, "2.9375", "2"),  # 10 trabajos × 200 lotes
        (10, "2.9375", "30"),  # agregación
        (10, "0.25", "1"),  # preparación
        (20, "0.25", "1"),  # margen de limpieza terminal
    ]
    calls = sum(n for n, _, _ in workloads)
    gb_seconds = sum(D(n) * D(gb) * D(seconds) for n, gb, seconds in workloads)
    rows = [
        (
            "Amplify",
            "1000 × 5/1024 GB × 0,15 + 0,1 GB-mes × 0,023; build AWS = 0",
            D(1000) * D(5) / D(1024) * D("0.15") + D("0.1") * D("0.023"),
        ),
        ("API Gateway HTTP", "11200 solicitudes × 0,000001", D(11200) * D("0.000001")),
        (
            "Lambda",
            f"{gb_seconds} GB-s × 0,0000166667 + {calls} solicitudes × 0,0000002",
            gb_seconds * rate + D(calls) * D("0.0000002"),
        ),
        (
            "Step Functions Standard",
            "10 × (200 × 4 + 10) transiciones × 0,000025",
            D(8100) * D("0.000025"),
        ),
        (
            "S3",
            "0,5 GB-mes × 0,023 + 5000 PUT × 0,000005 + 15000 GET × 0,0000004",
            D("0.5") * D("0.023") + D(5000) * D("0.000005") + D(15000) * D("0.0000004"),
        ),
        (
            "DynamoDB",
            "20000 WRU × 0,000000625 + 100000 RRU × 0,000000125 + 0,1 GB-mes × 0,25",
            D(20000) * D("0.000000625")
            + D(100000) * D("0.000000125")
            + D("0.1") * D("0.25"),
        ),
        (
            "CloudWatch",
            "1 GB logs × 0,50 + (7/30) GB-mes × 0,03 + 5 alarmas × 0,10",
            D("0.5") + D(7) / D(30) * D("0.03") + D("0.5"),
        ),
        ("Salida API/S3", "2 GB × 0,09 (separados del frontend)", D(2) * D("0.09")),
        ("Cost Explorer", "1 consulta de cierre × 0,01", D("0.01")),
    ]
    return rows


if __name__ == "__main__":
    rows = estimate()
    print("| Servicio | Cálculo en USD | Mensual (USD) |")
    print("|---|---|---:|")
    for name, formula, amount in rows:
        print(f"| {name} | {formula} | {amount:.4f} |")
    print(
        f"| **Total** | Suma sin redondeo intermedio | **{sum(row[2] for row in rows):.2f}** |"
    )
