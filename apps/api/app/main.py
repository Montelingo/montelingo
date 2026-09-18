from fastapi import FastAPI

from app.api.v1.router import api_router


def create_app() -> FastAPI:
    app = FastAPI(title="Montelingo API", version="0.1.0")
    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()
from fastapi import FastAPI, Request

from app.api.v1.router import router as v1_router
from app.core.exception_handlers import register_exception_handlers
from app.core.request_id import get_request_id


app = FastAPI(title="Montelingo API", version="1.0.0")


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = get_request_id(request)
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    return response


register_exception_handlers(app)
app.include_router(v1_router, prefix="/api/v1")
