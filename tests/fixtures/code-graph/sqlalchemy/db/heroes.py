from sqlmodel import Field, SQLModel


class HeroBase(SQLModel):
    name: str


class Hero(HeroBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
