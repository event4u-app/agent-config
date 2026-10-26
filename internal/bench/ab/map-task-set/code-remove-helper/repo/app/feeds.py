import utils.text as text


def feed_key(feed):
    return text.legacy_slugify(feed.name)
