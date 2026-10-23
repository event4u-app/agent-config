from django.shortcuts import render
from django.views import View


def index(request):
    return render(request, "blog/index.html")


def archive(request, year):
    return render(request, "blog/shared.html", {"year": year})


def about(request):
    return render(request, "about.html")


def gone(request):
    template = "blog/index.html"
    return render(request, template)


class PostDetail(View):
    def get(self, request, pk):
        return render(request, "blog/missing.html")
