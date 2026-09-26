from fastapi import APIRouter

from app.modules.health.router import router as health_router

# Aggregates module routers under /api/v1; endpoints live in app/modules/<name>/router.py.
router = APIRouter()
router.include_router(health_router, prefix="/health", tags=["health"])
