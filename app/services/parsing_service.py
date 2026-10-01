import dateparser
import re
from datetime import datetime
from app.services.timezone_service import get_now_local, local_to_utc

def preprocess_indonesian_time(text: str) -> str:
    text = text.lower().strip()
    
    # Menit/jam lagi -> in X minutes/hours
    if match := re.search(r'(\d+)\s*(menit|jam)\s*(lagi|kemudian)', text):
        num, unit, _ = match.groups()
        unit = "minutes" if unit == "menit" else "hours"
        return f"in {num} {unit}"
        
    # Replace jam -> at
    text = re.sub(r'\bjam\b', 'at', text)
    # Replace separator . with : for time (16.00 -> 16:00)
    text = re.sub(r'(\d{1,2})\.(\d{2})', r'\1:\2', text)
    
    # Replace sore/malam -> PM, pagi/siang -> AM
    # This is rough but helps dateparser
    text = text.replace('sore', 'pm').replace('malam', 'pm')
    text = text.replace('pagi', 'am').replace('siang', 'pm')
    text = text.replace('besok', 'tomorrow').replace('hari ini', 'today')
    
    return text

def parse_time(text: str, tz_name: str = "Asia/Jakarta") -> tuple[datetime | None, str]:
    """
    Parses a natural language time string.
    Returns (utc_datetime, error_message).
    If valid, error_message is empty.
    """
    now = get_now_local(tz_name)
    processed_text = preprocess_indonesian_time(text)

    # Configure dateparser to use the user's timezone as base
    settings = {
        'TIMEZONE': tz_name,
        'RETURN_AS_TIMEZONE_AWARE': True,
        'RELATIVE_BASE': now,
        'PREFER_DATES_FROM': 'future'
    }

    clock_match = re.fullmatch(
        r"(?:at\s*)?(\d{1,2}):(\d{2})(?:\s*(am|pm))?", processed_text
    )
    if clock_match:
        hour, minute, meridiem = clock_match.groups()
        hour = int(hour)
        minute = int(minute)
        if meridiem:
            if hour < 1 or hour > 12:
                return None, "Format jam tidak valid. Contoh: '16:00' atau '4 pm'."
            if meridiem == "pm" and hour != 12:
                hour += 12
            elif meridiem == "am" and hour == 12:
                hour = 0
        elif hour > 23:
            return None, "Format jam tidak valid. Contoh: '16:00' atau '4 pm'."

        if minute > 59:
            return None, "Format menit tidak valid. Contoh: '16:00'."
        parsed_dt = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    else:
        parsed_dt = dateparser.parse(processed_text, settings=settings, languages=['id', 'en'])
    
    if not parsed_dt:
        return None, "Waktu tidak dikenali. Contoh: 'besok jam 08:00', '30 menit lagi', '16:00'."
        
    # Ensure it's in the future
    if parsed_dt <= now:
        return None, "⚠️ Waktu tersebut sudah lewat. Silakan pilih waktu di masa depan."
        
    # Convert to UTC for storage
    utc_dt = local_to_utc(parsed_dt, tz_name)
    return utc_dt, ""
