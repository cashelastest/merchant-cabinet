from repositories import UserRepository
from models import User
from schemas import CreateUserRequest


class UserService:
    def __init__(self, repository: UserRepository) -> None:
        self.repository = repository

    async def create_user(self, data: CreateUserRequest):
        user = User(**data.model_dump())
        await self.repository.save(user)
        return user
    