"""Configuración inmutable con nombres Python y serialización camelCase."""

from dataclasses import asdict, dataclass
from typing import Any, Literal

Policy = Literal["none", "random", "targeted"]
OriginKind = Literal["random", "household", "school", "bus", "market", "neighborhood", "node"]


def _camelize(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            name.split("_")[0] + "".join(part.title() for part in name.split("_")[1:]): _camelize(
                item
            )
            for name, item in value.items()
        }
    if isinstance(value, (tuple, list)):
        return [_camelize(item) for item in value]
    return value


@dataclass(frozen=True, slots=True)
class Origin:
    kind: OriginKind
    value: int | None


@dataclass(frozen=True, slots=True)
class Scenario:
    population_size: int
    days: int
    beta: float
    sigma: float
    gamma: float
    initial_infectious: int
    origin: Origin


@dataclass(frozen=True, slots=True)
class Intervention:
    vaccines: int
    intervention_day: int
    vaccine_efficacy: float


@dataclass(frozen=True, slots=True)
class Weights:
    household: float
    school: float
    bus: float
    market: float
    neighborhood: float


@dataclass(frozen=True, slots=True)
class Network:
    generator_version: Literal["synthetic-manta-v1"]
    day_zero: Literal["monday"]
    weights: Weights


@dataclass(frozen=True, slots=True)
class Configuration:
    root_seed: int
    network_mode: Literal["fixed"]
    repetitions: int
    scenario: Scenario
    intervention: Intervention
    policies: tuple[Policy, Policy, Policy]
    network: Network

    def to_dict(self) -> dict[str, Any]:
        """Copia completa del contrato; modificarla no cambia este objeto."""
        data: dict[str, Any] = _camelize(asdict(self))
        return data


@dataclass(frozen=True, slots=True)
class PreviewRequest:
    schema_version: Literal["1.0"]
    configuration: Configuration


@dataclass(frozen=True, slots=True)
class CompareRequest(PreviewRequest):
    expected_graph_hash: str
    include_representative_frames: bool
