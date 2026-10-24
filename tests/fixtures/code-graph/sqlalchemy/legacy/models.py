class Post:
    title = ""


def configure():
    __tablename__ = "not_a_table"
    return __tablename__
