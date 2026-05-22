from pydantic import BaseModel
from typing import Optional, List


class CreateUserRequest(BaseModel):
    username: str
    password: str

class UpdateUserRequest(BaseModel):
    username: Optional[str]
    password: Optional[str]
    currencies: Optional[List[str]]
