import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@db:5432/bizon")
REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379")
SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production")
ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin")
