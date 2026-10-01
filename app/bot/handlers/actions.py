from telegram import Update
from telegram.ext import ContextTypes, CallbackQueryHandler
from app.database.database import AsyncSessionLocal
from app.services.reminder_service import get_reminder, update_reminder_status
from app.database.models import ReminderStatus

async def handle_action(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    data = query.data.split('_')
    action = data[1]
    reminder_id = int(data[2])
    
    async with AsyncSessionLocal() as session:
        reminder = await get_reminder(session, reminder_id)
        if not reminder:
            await query.edit_message_text("❌ Reminder tidak ditemukan di database.")
            return

        if action == "complete":
            if reminder.schedule_type == "One-time":
                await update_reminder_status(session, reminder_id, ReminderStatus.COMPLETED)
                await query.edit_message_reply_markup(reply_markup=None)
                await query.edit_message_text(f"{query.message.text}\n\n✅ **Selesai dikerjakan**", parse_mode='Markdown')
            else:
                await query.edit_message_reply_markup(reply_markup=None)
                await query.edit_message_text(f"{query.message.text}\n\n✅ **Selesai untuk saat ini**", parse_mode='Markdown')
                
        elif action == "disable":
            await update_reminder_status(session, reminder_id, ReminderStatus.DISABLED)
            await query.edit_message_reply_markup(reply_markup=None)
            await query.edit_message_text(f"{query.message.text}\n\n🔕 **Dinonaktifkan**", parse_mode='Markdown')
            
        elif action == "snooze":
            # For MVP, snooze 10 mins explicitly
            # Advanced snooze would need a conversation handler
            from datetime import timedelta
            from app.services.timezone_service import get_now_utc
            from app.scheduler.scheduler import schedule_reminder
            
            new_time = get_now_utc() + timedelta(minutes=10)
            schedule_reminder(context.application, reminder_id, new_time, "One-time")
            
            await query.edit_message_reply_markup(reply_markup=None)
            await query.edit_message_text(f"{query.message.text}\n\n⏰ **Ditunda 10 menit**", parse_mode='Markdown')

def get_action_handlers():
    return CallbackQueryHandler(handle_action, pattern="^act_")
