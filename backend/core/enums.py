from enum import Enum


class Role(str, Enum):
    ADMIN = "Администратор"
    MANAGER = "Менеджер"
