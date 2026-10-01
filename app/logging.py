import logging
import sys
from app.config import LOG_LEVEL

def setup_logging():
    level = getattr(logging, LOG_LEVEL.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    # Reduce noise from apscheduler and telegram if needed
    logging.getLogger("httpx").setLevel(logging.WARNING)
