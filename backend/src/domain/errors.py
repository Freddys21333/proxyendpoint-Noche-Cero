"""Errores de entrada saneados, independientes del transporte HTTP."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class FieldIssue:
    path: str
    reason: str


class ConfigurationError(ValueError):
    """Metadatos para que el futuro adapter construya el error de contrato."""

    def __init__(
        self, code: str, status_code: int, message: str, fields: tuple[FieldIssue, ...] = ()
    ) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.fields = fields
