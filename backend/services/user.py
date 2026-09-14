import bcrypt

from repositories import UserRepository
from models import User
from schemas import CreateUserRequest
from core.ws_manager import manager


class UserService:
    def __init__(self, repository: UserRepository) -> None:
        self.repository = repository

    async def create_user(self, data: CreateUserRequest) -> User:
        hashed = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
        user = User(username=data.username, hashed_password=hashed, api_key=data.api_key, secret=data.secret)
        await self.repository.save(user)
        await self.repository.session.commit()
        return user

    async def authenticate(self, username: str, password: str) -> User | None:
        user = await self.repository.get_by_username(username)
        if not user or not bcrypt.checkpw(password.encode(), user.hashed_password.encode()):
            return None
        return user

    async def set_active(self, user: User, is_active: bool) -> User:
        user.is_active = is_active
        await self.repository.session.commit()
        await self.repository.session.refresh(user)
        return user

    async def update_currencies(self, user: User, xml_codes: list[str]) -> User:
        await self.repository.set_currencies(user, xml_codes)
        await self.repository.session.commit()
        await self.repository.session.refresh(user)
        # Open sockets captured the currency list when they connected. Push the new
        # one, otherwise the merchant keeps missing live deals for a newly assigned
        # currency until they reload the page.
        manager.update_user_xml_codes(user.id, {c.xml for c in user.currencies})
        return user
