from sqlalchemy import Table, Column, ForeignKey
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):...


user_currencies_table = Table(
    "user_currencies",
    Base.metadata,
    Column("user_id", ForeignKey("users.id"), primary_key=True),
    Column("currency_id", ForeignKey("currencies.id"), primary_key=True)
)