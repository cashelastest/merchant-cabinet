from pydantic import BaseModel
from typing import Optional, List


class LoginRequest(BaseModel):
    username: str
    password: str


class CreateUserRequest(BaseModel):
    username: str
    password: str
    api_key: str
    secret: str


class UpdateUserRequest(BaseModel):
    username: Optional[str]
    password: Optional[str]
    currencies: Optional[List[str]]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
