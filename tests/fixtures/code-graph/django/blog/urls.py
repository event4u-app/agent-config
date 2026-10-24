from django.urls import include, path

from . import api_urls, views

urlpatterns = [
    path("about/", views.about),
    path("api/", include(api_urls)),
]
