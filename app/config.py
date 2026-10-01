import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///data.db")
APP_ENV = os.getenv("APP_ENV", "development")
TIMEZONE = os.getenv("TIMEZONE", "Asia/Jakarta")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
BOT_MODE = os.getenv("BOT_MODE", "polling")
