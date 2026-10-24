from blog.models import Author


class PostService:
    @staticmethod
    def latest():
        return Author.objects.all()
