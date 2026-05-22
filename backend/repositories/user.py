from models import User, Currency
from schemas import CreateUserRequest, UpdateUserRequest
from sqlalchemy.ext.asyncio import AsyncSession


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def save(self, user: User):
        self.session.add(user)
        await self.session.commit()
    