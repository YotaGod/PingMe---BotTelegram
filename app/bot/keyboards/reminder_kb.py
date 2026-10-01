from telegram import InlineKeyboardMarkup, InlineKeyboardButton

def get_category_keyboard() -> InlineKeyboardMarkup:
    keyboard = [
        [InlineKeyboardButton("🏠 Pribadi", callback_data="cat_Pribadi"),
         InlineKeyboardButton("📚 Kuliah/Kerja", callback_data="cat_Kuliah/Kerja")],
        [InlineKeyboardButton("📝 Tugas", callback_data="cat_Tugas"),
         InlineKeyboardButton("🎮 Hobi", callback_data="cat_Hobi")],
        [InlineKeyboardButton("💡 Lainnya", callback_data="cat_Lainnya")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_priority_keyboard() -> InlineKeyboardMarkup:
    keyboard = [
        [InlineKeyboardButton("🔴 High", callback_data="pri_High"),
         InlineKeyboardButton("🟡 Medium", callback_data="pri_Medium"),
         InlineKeyboardButton("🟢 Low", callback_data="pri_Low")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_schedule_keyboard() -> InlineKeyboardMarkup:
    keyboard = [
        [InlineKeyboardButton("Sekali (One-time)", callback_data="sch_One-time")],
        [InlineKeyboardButton("Setiap Hari (Daily)", callback_data="sch_Daily")],
        [InlineKeyboardButton("Hari Kerja (Senin-Jumat)", callback_data="sch_Weekdays")],
        [InlineKeyboardButton("Setiap Minggu (Weekly)", callback_data="sch_Weekly")],
        [InlineKeyboardButton("Setiap Bulan (Monthly)", callback_data="sch_Monthly")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_summary_keyboard() -> InlineKeyboardMarkup:
    keyboard = [
        [InlineKeyboardButton("✅ Simpan", callback_data="sum_save")],
        [InlineKeyboardButton("📝 Ubah Detail", callback_data="sum_edit")],
        [InlineKeyboardButton("❌ Batal", callback_data="sum_cancel")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_edit_fields_keyboard() -> InlineKeyboardMarkup:
    keyboard = [
        [InlineKeyboardButton("📝 Judul", callback_data="edit_title"),
         InlineKeyboardButton("💬 Pesan", callback_data="edit_message")],
        [InlineKeyboardButton("🕐 Waktu", callback_data="edit_time"),
         InlineKeyboardButton("🏷️ Kategori", callback_data="edit_category")],
        [InlineKeyboardButton("🎯 Prioritas", callback_data="edit_priority"),
         InlineKeyboardButton("🔁 Jadwal", callback_data="edit_schedule")],
        [InlineKeyboardButton("🔙 Kembali ke Ringkasan", callback_data="edit_back")]
    ]
    return InlineKeyboardMarkup(keyboard)
