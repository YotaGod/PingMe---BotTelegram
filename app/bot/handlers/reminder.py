from telegram import Update, ReplyKeyboardRemove
from telegram.ext import (
    ContextTypes, CommandHandler, MessageHandler, CallbackQueryHandler,
    ConversationHandler, filters
)
from app.bot.keyboards.reminder_kb import (
    get_category_keyboard, get_priority_keyboard,
    get_schedule_keyboard, get_summary_keyboard, get_edit_fields_keyboard
)
from app.services.parsing_service import parse_time
from app.services.timezone_service import utc_to_local
from app.config import TIMEZONE

TITLE, MESSAGE, TIME, CATEGORY, PRIORITY, SCHEDULE, SUMMARY, EDIT = range(8)

async def cancel_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Pembuatan pengingat dibatalkan.", reply_markup=ReplyKeyboardRemove())
    context.user_data.clear()
    return ConversationHandler.END

async def reminder_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data.clear()
    await update.message.reply_text(
        "Mari buat pengingat baru!\n\n"
        "Apa judul pengingat ini? (Maks 100 karakter)\n"
        "Ketik /cancel kapan saja untuk membatalkan."
    )
    return TITLE

async def receive_title(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    title = update.message.text.strip()
    if not title:
        await update.message.reply_text("Judul tidak boleh kosong. Silakan masukkan judul pengingat:")
        return TITLE
    
    context.user_data['title'] = title
    
    if context.user_data.get('is_editing'):
        return await show_summary(update, context)
        
    await update.message.reply_text(
        "Bagus! Sekarang masukkan detail/pesan untuk pengingat ini.\n"
        "Atau ketik '-' jika tidak ada pesan tambahan."
    )
    return MESSAGE

async def receive_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    msg = update.message.text.strip()
    context.user_data['message'] = "" if msg == "-" else msg
    
    if context.user_data.get('is_editing'):
        return await show_summary(update, context)
        
    await update.message.reply_text(
        "Kapan waktu untuk pengingat ini?\n\n"
        "(Catatan: Masukkan **jam/waktu pertama kali** saja. Pilihan berulang/rutin seperti 'setiap hari' akan ditanyakan di langkah selanjutnya.)\n\n"
        "Contoh: 'jam 16:00', 'besok jam 8 pagi', '30 menit lagi'",
        parse_mode='Markdown'
    )
    return TIME

async def receive_time(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    time_text = update.message.text.strip()
    
    # We will use the default TIMEZONE from config for MVP
    # Later we can get from DB user settings
    utc_dt, error = parse_time(time_text, TIMEZONE)
    
    if error:
        await update.message.reply_text(f"{error}\nSilakan masukkan waktu lain:")
        return TIME
        
    context.user_data['scheduled_at'] = utc_dt
    context.user_data['timezone'] = TIMEZONE
    
    if context.user_data.get('is_editing'):
        return await show_summary(update, context)
        
    await update.message.reply_text(
        "Pilih kategori pengingat:",
        reply_markup=get_category_keyboard()
    )
    return CATEGORY

async def receive_category(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    category = query.data.removeprefix("cat_")
    context.user_data['category'] = category
    
    await query.edit_message_text(f"Kategori terpilih: {category}")
    
    if context.user_data.get('is_editing'):
        return await show_summary(update, context)
        
    await query.message.reply_text(
        "Pilih prioritas pengingat:",
        reply_markup=get_priority_keyboard()
    )
    return PRIORITY

async def receive_priority(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    priority = query.data.removeprefix("pri_")
    context.user_data['priority'] = priority
    
    await query.edit_message_text(f"Prioritas terpilih: {priority}")
    
    if context.user_data.get('is_editing'):
        return await show_summary(update, context)
        
    await query.message.reply_text(
        "Pilih jadwal pengingat:",
        reply_markup=get_schedule_keyboard()
    )
    return SCHEDULE

async def receive_schedule(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    schedule = query.data.removeprefix("sch_")
    context.user_data['schedule_type'] = schedule
    
    await query.edit_message_text(f"Jadwal terpilih: {schedule}")
    
    return await show_summary(update, context)

async def show_summary(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data['is_editing'] = False
    
    data = context.user_data
    local_dt = utc_to_local(data['scheduled_at'], data['timezone'])
    time_str = local_dt.strftime('%d %B %Y, %H:%M')
    
    summary = (
        "📋 **Ringkasan Reminder**\n\n"
        f"📝 Judul: {data['title']}\n"
        f"💬 Pesan: {data.get('message', '-')}\n"
        f"🕐 Waktu: {time_str}\n"
        f"🏷️ Kategori: {data['category']}\n"
        f"🔴 Prioritas: {data['priority']}\n"
        f"🔁 Jadwal: {data['schedule_type']}\n"
        f"🌏 Timezone: {data['timezone']}\n\n"
        "Pilih tindakan:"
    )
    
    # Check if this is from a callback or direct message
    if update.callback_query:
        await update.callback_query.message.reply_text(summary, parse_mode='Markdown', reply_markup=get_summary_keyboard())
    else:
        await update.message.reply_text(summary, parse_mode='Markdown', reply_markup=get_summary_keyboard())
        
    return SUMMARY

async def handle_summary_action(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    action = query.data.split('_')[1]
    
    if action == "save":
        from app.database.database import AsyncSessionLocal
        from app.services.reminder_service import get_or_create_user, create_reminder
        from app.scheduler.scheduler import schedule_reminder
        
        user_info = update.effective_user
        data = context.user_data
        
        async with AsyncSessionLocal() as session:
            user = await get_or_create_user(
                session, 
                telegram_id=user_info.id,
                username=user_info.username,
                first_name=user_info.first_name
            )
            
            reminder = await create_reminder(
                session=session,
                user_id=user.id,
                title=data['title'],
                message=data.get('message', ''),
                category=data['category'],
                priority=data['priority'],
                schedule_type=data['schedule_type'],
                scheduled_at=data['scheduled_at'],
                timezone=data['timezone']
            )
            
            # Application instance is needed to send messages later in scheduler
            schedule_reminder(context.application, reminder.id, reminder.scheduled_at, reminder.schedule_type)
            
        await query.edit_message_text("✅ Reminder berhasil disimpan dan dijadwalkan!")
        context.user_data.clear()
        return ConversationHandler.END
        
    elif action == "cancel":
        await query.edit_message_text("❌ Pembuatan reminder dibatalkan.")
        context.user_data.clear()
        return ConversationHandler.END
        
    elif action == "edit":
        await query.edit_message_text("Pilih bagian yang ingin diubah:", reply_markup=get_edit_fields_keyboard())
        return EDIT

async def handle_edit_selection(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    field = query.data.split('_')[1]
    
    if field == "back":
        await query.message.delete()
        return await show_summary(update, context)
        
    context.user_data['is_editing'] = True
    
    if field == "title":
        await query.edit_message_text("Masukkan judul baru:")
        return TITLE
    elif field == "message":
        await query.edit_message_text("Masukkan pesan baru (atau '-' untuk kosong):")
        return MESSAGE
    elif field == "time":
        await query.edit_message_text("Masukkan waktu baru (cth: 'besok jam 10'):")
        return TIME
    elif field == "category":
        await query.edit_message_text("Pilih kategori baru:", reply_markup=get_category_keyboard())
        return CATEGORY
    elif field == "priority":
        await query.edit_message_text("Pilih prioritas baru:", reply_markup=get_priority_keyboard())
        return PRIORITY
    elif field == "schedule":
        await query.edit_message_text("Pilih jadwal baru:", reply_markup=get_schedule_keyboard())
        return SCHEDULE

def get_reminder_conversation_handler() -> ConversationHandler:
    return ConversationHandler(
        entry_points=[CommandHandler("reminder", reminder_start)],
        states={
            TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_title)],
            MESSAGE: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_message)],
            TIME: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_time)],
            CATEGORY: [CallbackQueryHandler(receive_category, pattern="^cat_")],
            PRIORITY: [CallbackQueryHandler(receive_priority, pattern="^pri_")],
            SCHEDULE: [CallbackQueryHandler(receive_schedule, pattern="^sch_")],
            SUMMARY: [CallbackQueryHandler(handle_summary_action, pattern="^sum_")],
            EDIT: [CallbackQueryHandler(handle_edit_selection, pattern="^edit_")],
        },
        fallbacks=[CommandHandler("cancel", cancel_command)],
    )
