from fastapi import FastAPI

from app.api.routes import router as forensic_router
from app.core.config import settings
from app.core.db import Base, engine
from app.models import db_models  # noqa: F401

app = FastAPI(title=settings.app_name, version=settings.app_version)
app.include_router(forensic_router)


@app.on_event("startup")
def startup() -> None:
	Base.metadata.create_all(bind=engine)
