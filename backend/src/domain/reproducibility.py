"""Primitivas rng-v1 / canonical-v1 (CA-06/07), sin estado aleatorio global."""

import hashlib
import json
import math
import struct

from numpy.random import PCG64, Generator, SeedSequence

RNG_VERSION = "rng-v1"
CANONICAL_VERSION = "canonical-v1"
BIT_GENERATOR = "PCG64"
DOMAINS = (
    "graph",
    "initial",
    "transmission",
    "progression",
    "vaccine",
    "policy-random",
    "layout",
    "bootstrap",
    "combined-brigades-v1",
)


def seed_entropy(root_seed: int, domain: str, replicate_index: int = 0) -> tuple[int, ...]:
    """Derivación explícita independiente del orden de creación de generadores."""
    if type(root_seed) is not int or not 0 <= root_seed <= 2**32 - 1:
        raise ValueError("La raíz debe ser un entero uint32.")
    if type(replicate_index) is not int or replicate_index < 0:
        raise ValueError("El índice debe ser un entero no negativo.")
    if domain not in DOMAINS:
        raise ValueError("Dominio aleatorio desconocido.")
    index = 0 if domain in ("graph", "layout", "bootstrap") else replicate_index
    words = struct.unpack("<8I", hashlib.sha256(domain.encode("utf-8")).digest())
    return (root_seed, index, *words)


def create_rng(root_seed: int, domain: str, replicate_index: int = 0) -> Generator:
    """Cada llamada crea un flujo nuevo; el consumidor conserva su instancia."""
    return Generator(PCG64(SeedSequence(seed_entropy(root_seed, domain, replicate_index))))


def _normalize(value: object) -> object:
    if value is None or type(value) in (str, bool, int):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("JSON canónico requiere números finitos.")
        return int(value) if value.is_integer() else value
    if isinstance(value, list):
        return [_normalize(item) for item in value]
    if isinstance(value, dict):
        if any(not isinstance(key, str) for key in value):
            raise TypeError("Las claves JSON deben ser texto.")
        return {key: _normalize(item) for key, item in value.items()}
    raise TypeError("Valor incompatible con JSON.")


def canonical_json(value: object) -> bytes:
    """JSON sin BOM/salto final; no ordena listas ni descarta campos implícitamente."""
    return json.dumps(
        _normalize(value),
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def json_hash(value: object) -> str:
    """El llamador proporciona el contenido no volátil sin su propio hash."""
    return "sha256:" + hashlib.sha256(canonical_json(value)).hexdigest()
