import re


def slugify(value):
    value = re.sub(r"[^a-z0-9]+", "-", value.lower())
    return value.strip("-")


def legacy_slugify(value):
    return value.lower().replace(" ", "_")
