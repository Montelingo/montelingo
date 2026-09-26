from fastapi import FastAPI

from app.api.v1.router import router as v1_router
from app.core.exception_handlers import register_exception_handlers
from app.core.request_id import request_id_middleware


def create_app() -> FastAPI:
    app = FastAPI(title="Montelingo API", version="1.0.0")
    app.middleware("http")(request_id_middleware)
    register_exception_handlers(app)
    app.include_router(v1_router, prefix="/api/v1")
    return app


app = create_app()
