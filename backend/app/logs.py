"""Protokoll der App (Anmeldungen, abgelehnte Anfragen) auf stderr, neben den uvicorn-Logs.

Passwörter, PINs und Tokens werden nie protokolliert; E-Mail-Adressen nur auf Stufe debug.
"""

import logging

logger = logging.getLogger("famquest")


def configure_logging(level: str) -> None:
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(levelname)-9s %(name)s: %(message)s"))
        logger.addHandler(handler)
        logger.propagate = False
    logger.setLevel(level.upper())
