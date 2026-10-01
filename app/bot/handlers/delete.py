from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import CallbackQueryHandler, CommandHandler, ContextTypes

from app.database.database import AsyncSessionLocal
from app.scheduler.scheduler import cancel_reminder
from app.services.reminder_service import (
    cancel_user_reminders,
    get_or_create_user,
    get_user_active_reminders,
)


def get_delete_keyboard(reminders, selected):
    rows = []
    for reminder in reminders:
        marker = "✅" if reminder.id in selected else "⬜"
        rows.append([
            InlineKeyboardButton(
                f"{marker} {reminder.title[:40]}",
                callback_data=f"del_toggle_{reminder.id}",
            )
        ])
    rows.append([
        InlineKeyboardButton("🗑️ Hapus Terpilih", callback_data="del_confirm"),
        InlineKeyboardButton("Batal", callback_data="del_cancel"),
    ])
    return InlineKeyboardMarkup(rows)


async def delete_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_info = update.effective_user
    async with AsyncSessionLocal() as session:
        user = await get_or_create_user(
            session, user_info.id, user_info.username, user_info.first_name
        )
        reminders = await get_user_active_reminders(session, user.id)

    if not reminders:
        await update.message.reply_text("Tidak ada pengingat aktif untuk dihapus.")
        return

    context.user_data["delete_reminders"] = reminders
    context.user_data["delete_selected"] = set()
    await update.message.reply_text(
        "Pilih satu atau beberapa reminder yang ingin dihapus:",
        reply_markup=get_delete_keyboard(reminders, set()),
    )


async def delete_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    action = query.data
    reminders = context.user_data.get("delete_reminders", [])
    selected = context.user_data.setdefault("delete_selected", set())

    if action == "del_confirm" and not selected:
        await query.answer("Pilih minimal satu reminder.", show_alert=True)
        return

    await query.answer()

    if action == "del_cancel":
        context.user_data.pop("delete_reminders", None)
        context.user_data.pop("delete_selected", None)
        await query.edit_message_text("Penghapusan dibatalkan.")
        return

    if action.startswith("del_toggle_"):
        reminder_id = int(action.removeprefix("del_toggle_"))
        if reminder_id in selected:
            selected.remove(reminder_id)
        else:
            selected.add(reminder_id)
        await query.edit_message_reply_markup(
            reply_markup=get_delete_keyboard(reminders, selected)
        )
        return

    if action == "del_confirm":
        user_info = update.effective_user
        async with AsyncSessionLocal() as session:
            user = await get_or_create_user(
                session, user_info.id, user_info.username, user_info.first_name
            )
            deleted_count = await cancel_user_reminders(
                session, user.id, list(selected)
            )

        for reminder_id in selected:
            cancel_reminder(reminder_id)

        context.user_data.pop("delete_reminders", None)
        context.user_data.pop("delete_selected", None)
        await query.edit_message_text(
            f"✅ {deleted_count} reminder berhasil dihapus."
        )


def get_delete_handlers():
    return [
        CommandHandler("delete", delete_command),
        CallbackQueryHandler(delete_callback, pattern=r"^del_"),
    ]
