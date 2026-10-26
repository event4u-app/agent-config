from utils.text import legacy_slugify


def article_url(article):
    return "/articles/" + legacy_slugify(article.title)
