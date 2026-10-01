import logging
from telegram import InlineKeyboardMarkup, InlineKeyboardButton
from app.database.database import AsyncSessionLocal
from app.services.reminder_service import get_reminder, update_reminder_status
from app.database.models import ReminderStatus
from telegram.ext import Application

logger = logging.getLogger(__name__)

async def send_reminder_notification(application: Application, reminder_id: int):
    async with AsyncSessionLocal() as session:
        reminder = await get_reminder(session, reminder_id)
        if not reminder or reminder.status != ReminderStatus.ACTIVE:
            logger.info(f"Reminder {reminder_id} tidak aktif atau tidak ditemukan.")
            return

        user = reminder.user
        
        # Prepare message
        text = (
            f"🔔 **REMINDER**\n\n"
            f"🔴 {reminder.title}\n\n"
        )
        if reminder.message and reminder.message != "-":
            text += f"{reminder.message}\n\n"
            
        text += (
            f"🕐 {reminder.scheduled_at.strftime('%H:%M')} (UTC)\n"
            f"📚 {reminder.category}"
        )
        
        # Prepare keyboard
        keyboard = [
            [InlineKeyboardButton("✅ Sudah Dikerjakan", callback_data=f"act_complete_{reminder.id}")],
            [InlineKeyboardButton("⏰ Tunda", callback_data=f"act_snooze_{reminder.id}")],
        ]
        
        if reminder.schedule_type != "One-time":
            keyboard.append([InlineKeyboardButton("⏭️ Skip Hari Ini", callback_data=f"act_skip_{reminder.id}")])
            
        keyboard.append([InlineKeyboardButton("🔕 Nonaktifkan", callback_data=f"act_disable_{reminder.id}")])

        reply_markup = InlineKeyboardMarkup(keyboard)
        
        try:
            await application.bot.send_message(
                chat_id=user.telegram_id,
                text=text,
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
            logger.info(f"Notification sent for reminder {reminder_id}")
            
            # If one time, set to completed or handle recurring logic (simplification for MVP)
            if reminder.schedule_type == "One-time":
                await update_reminder_status(session, reminder.id, ReminderStatus.COMPLETED)
            else:
                # Calculate next run here ideally, but for MVP APScheduler will handle recurring triggers.
                pass
                
        except Exception as e:
            logger.error(f"Failed to send reminder {reminder_id}: {e}")
