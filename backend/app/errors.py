from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# Pydantic-Fehlertypen → Übersetzungscodes für das Frontend.
_VALIDATION_CODES = {
    "missing": "validation.required",
    "string_too_short": "validation.too_short",
    "string_too_long": "validation.too_long",
    "string_pattern_mismatch": "validation.invalid_format",
}


class ApiError(Exception):
    """Fehler mit Code (z. B. `auth.invalid_credentials`); das Frontend übersetzt ihn."""

    def __init__(self, status_code: int, code: str) -> None:
        super().__init__(code)
        self.status_code = status_code
        self.code = code


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    def handle_api_error(request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse({"code": exc.code}, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        fields: dict[str, str] = {}
        for error in exc.errors():
            field = ".".join(str(part) for part in error["loc"][1:]) or "body"
            error_type = error["type"]
            code = (
                error_type
                if error_type.startswith("validation.")
                else _VALIDATION_CODES.get(error_type, "validation.invalid")
            )
            fields.setdefault(field, code)
        return JSONResponse({"code": "common.validation", "fields": fields}, status_code=422)
