from datetime import datetime
import pytz
from app.config import TIMEZONE

DEFAULT_TZ = pytz.timezone(TIMEZONE)
UTC_TZ = pytz.utc

def get_now_utc() -> datetime:
    return datetime.utcnow().replace(tzinfo=UTC_TZ)

def get_now_local(tz_name: str = None) -> datetime:
    tz = pytz.timezone(tz_name) if tz_name else DEFAULT_TZ
    return get_now_utc().astimezone(tz)

def local_to_utc(dt: datetime, tz_name: str = None) -> datetime:
    tz = pytz.timezone(tz_name) if tz_name else DEFAULT_TZ
    if dt.tzinfo is None:
        dt = tz.localize(dt)
    return dt.astimezone(UTC_TZ)

def utc_to_local(dt: datetime, tz_name: str = None) -> datetime:
    tz = pytz.timezone(tz_name) if tz_name else DEFAULT_TZ
    if dt.tzinfo is None:
        dt = UTC_TZ.localize(dt)
    return dt.astimezone(tz)
