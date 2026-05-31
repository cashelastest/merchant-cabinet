from passlib.context import CryptContext

from repositories import UserRepository
from models import User
from schemas import CreateUserRequest

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserService:
    def __init__(self, repository: UserRepository) -> None:
        self.repository = repository

    async def create_user(self, data: CreateUserRequest) -> User:
        user = User(
            username=data.username,
            hashed_password=pwd_context.hash(data.password),
        )
        await self.repository.save(user)
        await self.repository.session.commit()
        return user

    async def authenticate(self, username: str, password: str) -> User | None:
        user = await self.repository.get_by_username(username)
        if not user or not pwd_context.verify(password, user.hashed_password):
            return None
        return user
