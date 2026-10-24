from app.main import bp


@bp.route("/explore")
def explore():
    return "explore"
