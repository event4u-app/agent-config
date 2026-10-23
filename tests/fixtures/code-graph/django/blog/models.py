from django.db import models


class Author(models.Model):
    name = models.CharField(max_length=100)


class Post(models.Model):
    author = models.ForeignKey(Author, on_delete=models.CASCADE)
    tags = models.ManyToManyField("Tag", blank=True)
    editor = models.ForeignKey("Ghost", on_delete=models.SET_NULL, null=True)
    parent = models.ForeignKey("self", null=True, on_delete=models.CASCADE)

    class Meta:
        db_table = "blog_posts"


class Tag(models.Model):
    label = models.CharField(max_length=30)


class Profile(models.Model):
    author = models.OneToOneField("blog.Author", on_delete=models.CASCADE)


class Timestamped(models.Model):
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True


class Plain:
    author = None
