import os

import requests


def today():
    return requests.get(
        os.environ["WEATHER_URL"] + "/today",
        headers={"Authorization": "Bearer fixturetokennotreal0000"},
        timeout=5,
    ).json()


def tomorrow():
    return requests.get(
        os.environ["WEATHER_URL"] + "/tomorrow",
        headers={"Authorization": os.environ["WEATHER_TOKEN"]},
        timeout=5,
    ).json()


def billing_totals():
    return requests.get(os.environ["BILLING_API_URL"] + "/totals", timeout=5).json()
