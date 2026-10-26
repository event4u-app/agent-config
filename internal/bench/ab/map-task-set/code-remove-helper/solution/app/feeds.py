import utils.text as text


def feed_key(feed):
    return text.slugify(feed.name)
