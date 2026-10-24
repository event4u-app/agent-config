from blog.models import Post
from blog.services import PostService


def feed(request):
    return PostService.latest()


def count(request):
    return Post.objects.count()


def build(request):
    return PostService()
