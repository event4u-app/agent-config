from flask import Blueprint, render_template

bp = Blueprint("admin", __name__, url_prefix="/admin", template_folder="admin_templates")


@bp.get("/dash")
def dash():
    return render_template("dash.html")


@bp.post("/shared")
def shared():
    return render_template("shared.html")


@bp.delete("/gone")
def gone():
    return render_template("missing.html")
