from sqlalchemy import ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    posts = relationship("Post", back_populates="author")
    ghost = relationship("Ghost")


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    author_id = mapped_column(ForeignKey("users.id"))
    author = relationship(User, back_populates="posts")
    comments = relationship(lambda: Comment)


class TimestampMixin:
    created = None
