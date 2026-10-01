from telegram import Update
from telegram.ext import ContextTypes, CommandHandler
from app.database.database import AsyncSessionLocal
from app.services.reminder_service import (
    get_or_create_user, get_user_active_reminders, get_user_reminders_today
)
from app.services.timezone_service import get_now_local, utc_to_local, local_to_utc
from app.config import TIMEZONE
from datetime import timedelta

def format_priority(priority: str) -> str:
    if priority == "High": return "🔴"
    if priority == "Medium": return "🟡"
    return "🟢"

async def list_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_info = update.effective_user
    async with AsyncSessionLocal() as session:
        user = await get_or_create_user(session, user_info.id, user_info.username, user_info.first_name)
        reminders = await get_user_active_reminders(session, user.id)
        
        if not reminders:
            await update.message.reply_text("Tidak ada pengingat aktif saat ini.")
            return
            
        text = "📋 **Reminder Aktif**\n\n"
        for i, r in enumerate(reminders, 1):
            local_dt = utc_to_local(r.scheduled_at, r.timezone)
            time_str = local_dt.strftime('%d %b %Y, %H:%M')
            pri = format_priority(r.priority)
            text += f"{i}. {pri} **{r.title}**\n   📅 {r.schedule_type}, {time_str}\n\n"
            
        await update.message.reply_text(text, parse_mode='Markdown')

async def today_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_info = update.effective_user
    
    # Calculate today's bounds in local time, then convert to UTC for DB query
    now_local = get_now_local(TIMEZONE)
    start_of_day_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day_local = start_of_day_local + timedelta(days=1, microseconds=-1)
    
    start_utc = local_to_utc(start_of_day_local, TIMEZONE)
    end_utc = local_to_utc(end_of_day_local, TIMEZONE)
    
    async with AsyncSessionLocal() as session:
        user = await get_or_create_user(session, user_info.id, user_info.username, user_info.first_name)
        reminders = await get_user_reminders_today(session, user.id, start_utc, end_utc)
        
        if not reminders:
            await update.message.reply_text("🎉 Tidak ada pengingat untuk hari ini.")
            return
            
        text = "📅 **Reminder Hari Ini**\n\n"
        for r in reminders:
            local_dt = utc_to_local(r.scheduled_at, r.timezone)
            time_str = local_dt.strftime('%H:%M')
            text += f"{time_str}\n{r.category.split(' ')[0]} {r.title}\n\n"
            
        await update.message.reply_text(text, parse_mode='Markdown')

async def upcoming_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_info = update.effective_user
    
    async with AsyncSessionLocal() as session:
        user = await get_or_create_user(session, user_info.id, user_info.username, user_info.first_name)
        reminders = await get_user_active_reminders(session, user.id)
        
        if not reminders:
            await update.message.reply_text("Tidak ada pengingat mendatang.")
            return
            
        text = "🔔 **Reminder Mendatang**\n\n"
        # Take up to 5 upcoming ones
        for r in reminders[:5]:
            local_dt = utc_to_local(r.scheduled_at, r.timezone)
            # Use day name + time for MVP simplicity
            time_str = local_dt.strftime('%A %H:%M')
            
            # Simple day translation mapping
            days = {"Monday": "Senin", "Tuesday": "Selasa", "Wednesday": "Rabu", "Thursday": "Kamis", "Friday": "Jumat", "Saturday": "Sabtu", "Sunday": "Minggu"}
            day_eng = local_dt.strftime('%A')
            day_id = days.get(day_eng, day_eng)
            
            time_str = time_str.replace(day_eng, day_id)
            
            text += f"{time_str}\n{r.category.split(' ')[0]} {r.title}\n\n"
            
        await update.message.reply_text(text, parse_mode='Markdown')

def get_list_handlers():
    return [
        CommandHandler("list", list_command),
        CommandHandler("today", today_command),
        CommandHandler("upcoming", upcoming_command)
    ]
