from flask import Flask, render_template

from app.auth import bp as auth_bp
from app.main import bp as main_bp

app = Flask(__name__)
app.register_blueprint(auth_bp, url_prefix="/auth")
app.register_blueprint(main_bp)
registry = {}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/submit", methods=["GET", "POST"])
def submit():
    page = "index.html"
    return render_template(page)


@registry.get("/not-a-route")
def not_routed():
    return None


def lookup():
    return registry.get("/also-not-a-route")
