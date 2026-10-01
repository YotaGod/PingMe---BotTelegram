import logging
from datetime import timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.memory import MemoryJobStore

logger = logging.getLogger(__name__)

jobstores = {
    'default': MemoryJobStore()
}

scheduler = AsyncIOScheduler(jobstores=jobstores, timezone=timezone.utc)

def start_scheduler():
    if not scheduler.running:
        scheduler.start()
        logger.info("Scheduler started.")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped.")


def cancel_reminder(reminder_id: int):
    job_id = f"reminder_{reminder_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        logger.info(f"Cancelled job {job_id}")

def schedule_reminder(application, reminder_id: int, run_date, schedule_type: str):
    from app.scheduler.jobs import send_reminder_notification
    
    job_id = f"reminder_{reminder_id}"
    
    if schedule_type == "One-time":
        scheduler.add_job(
            send_reminder_notification,
            'date',
            run_date=run_date,
            args=[application, reminder_id],
            id=job_id,
            replace_existing=True
        )
    elif schedule_type == "Daily":
        scheduler.add_job(
            send_reminder_notification,
            'interval',
            days=1,
            start_date=run_date,
            args=[application, reminder_id],
            id=job_id,
            replace_existing=True
        )
    elif schedule_type == "Weekdays":
        scheduler.add_job(
            send_reminder_notification,
            "cron",
            day_of_week="mon-fri",
            hour=run_date.hour,
            minute=run_date.minute,
            start_date=run_date,
            args=[application, reminder_id],
            id=job_id,
            replace_existing=True,
        )
    elif schedule_type == "Weekly":
        scheduler.add_job(
            send_reminder_notification,
            "cron",
            day_of_week=run_date.weekday(),
            hour=run_date.hour,
            minute=run_date.minute,
            start_date=run_date,
            args=[application, reminder_id],
            id=job_id,
            replace_existing=True,
        )
    elif schedule_type == "Monthly":
        scheduler.add_job(
            send_reminder_notification,
            "cron",
            day=run_date.day,
            hour=run_date.hour,
            minute=run_date.minute,
            start_date=run_date,
            args=[application, reminder_id],
            id=job_id,
            replace_existing=True,
        )
    else:
        # Fallback to one-time
        scheduler.add_job(
            send_reminder_notification,
            'date',
            run_date=run_date,
            args=[application, reminder_id],
            id=job_id,
            replace_existing=True
        )
        
    logger.info(f"Scheduled job {job_id} for {run_date}")
