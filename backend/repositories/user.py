from models import User
# from schemas import CreateUserRequest, UpdateUserRequest
from .base import BaseRepository

class UserRepository (BaseRepository[User]): ...