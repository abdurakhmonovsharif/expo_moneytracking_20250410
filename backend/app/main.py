from fastapi import FastAPI

from .api.routes import legacy_router


def create_app() -> FastAPI:
    app = FastAPI(title="Google → Firebase Auth Bridge", version="1.0.0")
    app.include_router(legacy_router)
    return app


app = create_app()
