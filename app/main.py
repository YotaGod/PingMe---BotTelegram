import logging
import asyncio
from app.logging import setup_logging
from app.config import BOT_TOKEN, BOT_MODE
from telegram.ext import Application
from app.bot.handlers.start import setup_bot_commands, setup_start_handlers
from app.bot.handlers.reminder import get_reminder_conversation_handler
from app.bot.handlers.actions import get_action_handlers
from app.bot.handlers.delete import get_delete_handlers
from app.scheduler.scheduler import start_scheduler, stop_scheduler, schedule_reminder
from app.database.database import AsyncSessionLocal
from app.services.reminder_service import get_active_reminders
from telegram.error import NetworkError

logger = logging.getLogger(__name__)

async def restore_reminders(application):
    async with AsyncSessionLocal() as session:
        reminders = await get_active_reminders(session)
        count = 0
        for r in reminders:
            if r.schedule_type == "One-time" and r.scheduled_at:
                schedule_reminder(application, r.id, r.scheduled_at, r.schedule_type)
                count += 1
            elif r.schedule_type != "One-time":
                # For daily/weekly
                schedule_reminder(application, r.id, r.scheduled_at, r.schedule_type)
                count += 1
        logger.info(f"Restored {count} active reminders to scheduler.")

async def main():
    setup_logging()
    logger.info("Starting Telegram Smart Reminder Bot...")
    
    if not BOT_TOKEN:
        logger.error("BOT_TOKEN is missing in environment variables.")
        return

    application = Application.builder().token(BOT_TOKEN).build()
    
    # Setup handlers
    setup_start_handlers(application)
    application.add_handler(get_reminder_conversation_handler())
    application.add_handler(get_action_handlers())
    
    for handler in get_delete_handlers():
        application.add_handler(handler)
    
    from app.bot.handlers.list import get_list_handlers
    for handler in get_list_handlers():
        application.add_handler(handler)
    
    # Start scheduler & restore reminders
    start_scheduler()
    await restore_reminders(application)
    
    if BOT_MODE.lower() == "polling":
        logger.info("Starting in polling mode...")
        await application.initialize()
        await setup_bot_commands(application)
        await application.start()
        await application.updater.start_polling()
        
        # Keep application running
        try:
            while True:
                await asyncio.sleep(3600)
        except asyncio.CancelledError:
            pass
        finally:
            await application.updater.stop()
            await application.stop()
            await application.shutdown()
            stop_scheduler()
    else:
        logger.error("Only polling mode is supported in this initial version.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot stopped by user.")
    except NetworkError:
        logger.error(
            "Tidak dapat terhubung ke Telegram. Periksa internet, DNS, firewall, "
            "VPN/proxy, lalu jalankan bot kembali."
        )
