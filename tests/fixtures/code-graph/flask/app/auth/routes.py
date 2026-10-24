from . import bp


@bp.route("/login", methods=["GET", "POST"])
def login():
    return "login"
