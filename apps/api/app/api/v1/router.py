from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.content.router import router as content_router
from app.modules.health.router import router as health_router
from app.modules.progress.router import router as progress_router

# Aggregates module routers under /api/v1; endpoints live in app/modules/<name>/router.py.
router = APIRouter()
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(health_router, prefix="/health", tags=["health"])
# Content owns two top-level resources, /regions and /locations, so its routes carry their paths.
router.include_router(content_router, tags=["content"])
router.include_router(progress_router, prefix="/progress", tags=["progress"])
