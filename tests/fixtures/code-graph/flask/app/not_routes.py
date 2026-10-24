from app.helpers import bp


@bp.get("/nope")
def nope():
    return None
