from telegram import BotCommand, Update
from telegram.ext import ContextTypes, CommandHandler, Application

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    welcome_message = (
        f"Halo {user.first_name}! 👋\n\n"
        "Saya adalah Telegram Smart Reminder Bot.\n"
        "Saya bisa membantu Anda mengingat berbagai tugas dan jadwal.\n\n"
        "Gunakan /reminder untuk membuat pengingat baru.\n"
        "Gunakan /help untuk melihat panduan lengkap."
    )
    await update.message.reply_text(welcome_message)

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    help_message = (
        "🤖 **Panduan Penggunaan Bot**\n\n"
        "Perintah yang tersedia:\n"
        "/start - Memulai bot\n"
        "/help - Menampilkan panduan ini\n"
        "/reminder - Membuat pengingat baru (Interaktif)\n"
        "/list - Melihat daftar pengingat aktif\n"
        "/today - Melihat pengingat hari ini\n"
        "/upcoming - Melihat reminder mendatang\n"
        "/delete - Menghapus satu atau beberapa reminder\n"
        "/cancel - Membatalkan proses saat ini"
    )
    await update.message.reply_text(help_message, parse_mode='Markdown')

def setup_start_handlers(application: Application):
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("help", help_command))


async def setup_bot_commands(application: Application) -> None:
    await application.bot.set_my_commands([
        BotCommand("help", "Lihat semua perintah"),
        BotCommand("reminder", "Buat reminder baru"),
        BotCommand("list", "Lihat reminder aktif"),
        BotCommand("today", "Lihat reminder hari ini"),
        BotCommand("upcoming", "Lihat reminder mendatang"),
        BotCommand("delete", "Hapus satu atau beberapa reminder"),
    ])
