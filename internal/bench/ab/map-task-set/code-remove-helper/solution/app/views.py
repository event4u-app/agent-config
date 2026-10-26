from utils.text import slugify


def article_url(article):
    return "/articles/" + slugify(article.title)
