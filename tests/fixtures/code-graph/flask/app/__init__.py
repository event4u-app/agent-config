from flask import Flask, render_template

app = Flask(__name__)
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
