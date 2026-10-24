from django.urls import include, path, re_path

from blog import views
from blog.views import PostDetail

urlpatterns = [
    path("", views.index),
    path("posts/<int:pk>/", PostDetail.as_view(), name="post-detail"),
    re_path(r"^archive/(?P<year>[0-9]{4})/$", views.archive),
    path("blog/", include("blog.urls")),
    path("v2/", include(("blog.urls", "blog"), namespace="v2")),
    path("inline/", lambda request: None),
]
