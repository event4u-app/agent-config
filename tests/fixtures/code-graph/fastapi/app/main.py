from fastapi import Depends, FastAPI

from app.deps import get_db

app = FastAPI()
cache = {}


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/items")
async def create_item(
    name: str,
    db=Depends(get_db),
):
    return {"name": name, "db": db}


def lookup():
    return cache.get("/health")
