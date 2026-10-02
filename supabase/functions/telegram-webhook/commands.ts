import { parseIndonesianSchedule } from "../_shared/schedule-parser.ts";

const commandKeyboard = {
  keyboard: [
    [{ text: "➕ Buat reminder" }, { text: "📋 Reminder aktif" }],
    [{ text: "📅 Hari ini" }, { text: "🔭 Mendatang" }],
    [{ text: "❓ Bantuan" }, { text: "✖ Batalkan" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

const categories = [
  [
    { text: "🏠 Personal", callback_data: "wizard|category|Personal" },
    { text: "📚 Kuliah/Kerja", callback_data: "wizard|category|Kuliah%2FKerja" },
  ],
  [
    { text: "📝 Task", callback_data: "wizard|category|Task" },
    { text: "🎮 Hobby", callback_data: "wizard|category|Hobby" },
  ],
  [{ text: "💡 Other", callback_data: "wizard|category|Other" }],
];

const priorities = [
  [
    { text: "🔴 High", callback_data: "wizard|priority|high" },
    { text: "🟡 Medium", callback_data: "wizard|priority|medium" },
    { text: "🟢 Low", callback_data: "wizard|priority|low" },
  ],
];

const repeats = [
  [
    { text: "Sekali saja", callback_data: "wizard|repeat|once" },
    { text: "Setiap hari", callback_data: "wizard|repeat|daily" },
  ],
  [
    { text: "Weekdays · Sen–Jum", callback_data: "wizard|repeat|weekdays" },
    { text: "Setiap minggu", callback_data: "wizard|repeat|weekly" },
  ],
  [{ text: "Batal", callback_data: "wizard|cancel" }],
];

type TelegramUser = { id: number; username?: string };
type TelegramMessage = {
  chat: { id: number };
  from?: TelegramUser;
  text?: string;
};
type TelegramCallback = {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: { message_id: number; chat: { id: number } };
};
type WizardDraft = {
  title?: string;
  message?: string | null;
  start_at?: string;
  timezone?: string;
  category?: string;
  priority?: "low" | "medium" | "high";
  repeat?: "once" | "daily" | "weekdays" | "weekly";
};
type WizardState = {
  telegram_user_id: string;
  user_id: string;
  chat_id: number;
  step: "title" | "message" | "schedule";
  draft: WizardDraft;
};

type TelegramDatabase = {
  from(table: string): any;
};

async function sendMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: Record<string, unknown>,
) {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (replyMarkup) body.reply_markup = replyMarkup;
  return fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function answerCallback(
  botToken: string,
  callback: TelegramCallback,
  text = "",
  showAlert = false,
) {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callback.id,
      text,
      show_alert: showAlert,
    }),
  });
}

function localDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function localTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function displayDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatRecurrence(draft: WizardDraft) {
  switch (draft.repeat) {
    case "daily":
      return {
        schedule_type: "daily",
        recurrence_rule: {
          frequency: "daily",
          time: localTime(draft.start_at!, draft.timezone!),
        },
      };
    case "weekdays":
      return {
        schedule_type: "weekly",
        recurrence_rule: {
          frequency: "weekly",
          days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
          time: localTime(draft.start_at!, draft.timezone!),
        },
      };
    case "weekly": {
      const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: draft.timezone,
        weekday: "long",
      })
        .format(new Date(draft.start_at!))
        .toLowerCase();
      return {
        schedule_type: "weekly",
        recurrence_rule: {
          frequency: "weekly",
          days: [weekday],
          time: localTime(draft.start_at!, draft.timezone!),
        },
      };
    }
    default:
      return { schedule_type: "one_time", recurrence_rule: null };
  }
}

async function getConversation(db: TelegramDatabase, telegramUserId: string) {
  const { data, error } = await db
    .from("telegram_conversations")
    .select("telegram_user_id,user_id,chat_id,step,draft,expires_at")
    .eq("telegram_user_id", telegramUserId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error("TELEGRAM_CONVERSATION_STORAGE_UNAVAILABLE");
  return data as (WizardState & { expires_at: string }) | null;
}

async function saveConversation(db: TelegramDatabase, state: WizardState) {
  const now = new Date().toISOString();
  const { error } = await db.from("telegram_conversations").upsert({
    ...state,
    updated_at: now,
    expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
  });
  if (error) throw new Error("TELEGRAM_CONVERSATION_STORAGE_UNAVAILABLE");
}

async function clearConversation(db: TelegramDatabase, telegramUserId: string) {
  await db
    .from("telegram_conversations")
    .delete()
    .eq("telegram_user_id", telegramUserId);
}

async function promptCategory(
  botToken: string,
  chatId: number,
  draft: WizardDraft,
) {
  await sendMessage(
    botToken,
    chatId,
    `⏰ Waktu: ${displayDate(draft.start_at!, draft.timezone!)} pukul ${localTime(draft.start_at!, draft.timezone!)}\n\nPilih kategori reminder:`,
    { inline_keyboard: categories },
  );
}

async function startReminder(
  db: TelegramDatabase,
  botToken: string,
  chatId: number,
  telegramUserId: string,
  userId: string,
) {
  const { data: profile } = await db
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  const state: WizardState = {
    telegram_user_id: telegramUserId,
    user_id: userId,
    chat_id: chatId,
    step: "title",
    draft: { timezone: profile?.timezone ?? "Asia/Jakarta" },
  };
  await saveConversation(db, state);
  await sendMessage(
    botToken,
    chatId,
    "📝 Mari buat reminder baru.\n\nApa judul reminder ini? (maks. 100 karakter)\n\nKetik /cancel atau tekan ✖ Batalkan kapan saja.",
  );
}

async function handleConversationText(
  db: TelegramDatabase,
  botToken: string,
  state: WizardState,
  text: string,
) {
  if (state.step === "title") {
    const title = text.trim();
    if (!title || title.length > 100) {
      await sendMessage(
        botToken,
        state.chat_id,
        "Judul harus berisi 1–100 karakter. Coba tulis judul yang lebih singkat:",
      );
      return;
    }
    state.draft.title = title;
    state.step = "message";
    await saveConversation(db, state);
    await sendMessage(
      botToken,
      state.chat_id,
      "Bagus! ✅\n\nSekarang masukkan detail atau pesan reminder.\nKetik - jika tidak ada catatan tambahan.",
    );
    return;
  }

  if (state.step === "message") {
    state.draft.message =
      text.trim() === "-" ? null : text.trim().slice(0, 1000);
    state.step = "schedule";
    await saveConversation(db, state);
    await sendMessage(
      botToken,
      state.chat_id,
      "⏰ Kapan reminder ini harus dikirim?\n\nKetik waktu seperti:\n• besok jam 08:00\n• Jumat jam 19:00\n• 30 menit lagi\n\nAtau pilih salah satu tombol waktu cepat di bawah.",
      {
        inline_keyboard: [
          [
            { text: "⏱ 30 menit lagi", callback_data: "wizard|quick|30m" },
            { text: "⏱ 1 jam lagi", callback_data: "wizard|quick|1h" },
          ],
          [
            {
              text: "🌅 Besok jam 08:00",
              callback_data: "wizard|quick|tomorrow",
            },
          ],
        ],
      },
    );
    return;
  }

  const schedule = parseIndonesianSchedule(
    text,
    state.draft.timezone ?? "Asia/Jakarta",
  );
  if (!schedule) {
    await sendMessage(
      botToken,
      state.chat_id,
      "⚠️ Waktu belum terbaca atau sudah lewat.\n\nCoba lagi, misalnya: besok jam 08:00, Jumat jam 19:00, atau 30 menit lagi.",
    );
    return;
  }
  state.draft.start_at = schedule.toISOString();
  await saveConversation(db, state);
  await promptCategory(botToken, state.chat_id, state.draft);
}

async function advanceWizard(
  db: TelegramDatabase,
  botToken: string,
  callback: TelegramCallback,
  userId: string,
  action: string,
  value: string,
) {
  const telegramUserId = String(callback.from.id);
  const state = await getConversation(db, telegramUserId);
  const chatId = callback.message?.chat.id;
  if (!state || state.user_id !== userId || !chatId) {
    await answerCallback(
      botToken,
      callback,
      "Sesi pembuatan pengingat sudah berakhir.",
      true,
    );
    return;
  }
  state.chat_id = chatId;

  if (action === "cancel") {
    await clearConversation(db, telegramUserId);
    await answerCallback(botToken, callback, "Pembuatan pengingat dibatalkan.");
    await sendMessage(
      botToken,
      chatId,
      "Pengingat dibatalkan. Ketik /reminder untuk mulai lagi.",
      commandKeyboard,
    );
    return;
  }

  if (action === "quick") {
    const now = new Date();
    const timezone = state.draft.timezone ?? "Asia/Jakarta";
    const expression =
      value === "30m"
        ? "30 menit lagi"
        : value === "1h"
          ? "1 jam lagi"
          : "besok jam 08:00";
    const schedule = parseIndonesianSchedule(expression, timezone, now);
    if (!schedule) {
      await answerCallback(
        botToken,
        callback,
        "Waktu cepat gagal dipilih.",
        true,
      );
      return;
    }
    state.draft.start_at = schedule.toISOString();
    await saveConversation(db, state);
    await answerCallback(botToken, callback, "Waktu dipilih.");
    await promptCategory(botToken, chatId, state.draft);
    return;
  }

  if (action === "category") {
    state.draft.category = decodeURIComponent(value);
    await saveConversation(db, state);
    await answerCallback(
      botToken,
      callback,
      `Kategori: ${state.draft.category}`,
    );
    await sendMessage(botToken, chatId, `Kategori: ${state.draft.category} ✅\n\nPilih prioritas:`, {
      inline_keyboard: priorities,
    });
    return;
  }

  if (action === "priority") {
    if (!["low", "medium", "high"].includes(value)) {
      await answerCallback(botToken, callback, "Prioritas tidak valid.", true);
      return;
    }
    state.draft.priority = value as WizardDraft["priority"];
    await saveConversation(db, state);
    await answerCallback(botToken, callback, `Prioritas: ${value}`);
    await sendMessage(botToken, chatId, `Prioritas: ${value} ✅\n\nPilih pola pengulangan:`, {
      inline_keyboard: repeats,
    });
    return;
  }

  if (action === "repeat") {
    if (!["once", "daily", "weekdays", "weekly"].includes(value)) {
      await answerCallback(
        botToken,
        callback,
        "Pilihan pengulangan tidak valid.",
        true,
      );
      return;
    }
    state.draft.repeat = value as WizardDraft["repeat"];
    await saveConversation(db, state);
    await answerCallback(botToken, callback, "Jadwal dipilih.");
    const repeatLabel =
      value === "once"
        ? "Sekali saja"
        : value === "daily"
          ? "Setiap hari"
          : value === "weekdays"
            ? "Senin–Jumat"
            : "Setiap minggu";
    const message = [
      "✅ Periksa reminder sebelum disimpan:",
      `• ${state.draft.title}`,
      `• ${state.draft.message ?? "Tanpa catatan tambahan"}`,
      `• ${displayDate(state.draft.start_at!, state.draft.timezone!)} pukul ${localTime(state.draft.start_at!, state.draft.timezone!)}`,
      `• ${state.draft.category} · prioritas ${state.draft.priority}`,
      `• ${repeatLabel}`,
    ].join("\n");
    await sendMessage(botToken, chatId, `${message}\n\nSimpan pengingat ini?`, {
      inline_keyboard: [
        [
          { text: "✅ Simpan", callback_data: "wizard|save" },
          { text: "✖ Batal", callback_data: "wizard|cancel" },
        ],
      ],
    });
    return;
  }

  if (action === "save") {
    if (!state.draft.start_at || !state.draft.title || !state.draft.repeat) {
      await answerCallback(
        botToken,
        callback,
        "Data pengingat belum lengkap.",
        true,
      );
      return;
    }
    const recurrence = formatRecurrence(state.draft);
    const { error } = await db.from("reminders").insert({
      user_id: userId,
      title: state.draft.title,
      message: state.draft.message ?? null,
      category: state.draft.category ?? "Personal",
      priority: state.draft.priority ?? "medium",
      timezone: state.draft.timezone ?? "Asia/Jakarta",
      start_at: state.draft.start_at,
      schedule_type: recurrence.schedule_type,
      recurrence_rule: recurrence.recurrence_rule,
      status: "active",
    });
    if (error) {
      await answerCallback(
        botToken,
        callback,
        "Gagal menyimpan pengingat.",
        true,
      );
      await sendMessage(
        botToken,
        chatId,
        `Pengingat belum tersimpan: ${error.message}`,
      );
      return;
    }
    await clearConversation(db, telegramUserId);
    await answerCallback(botToken, callback, "Pengingat tersimpan.");
    await sendMessage(
      botToken,
      chatId,
      "✅ Reminder berhasil disimpan dan dijadwalkan!\n\nGunakan tombol di bawah untuk melihat atau membuat reminder berikutnya.",
      commandKeyboard,
    );
  }
}

async function listReminders(
  db: TelegramDatabase,
  botToken: string,
  chatId: number,
  userId: string,
  mode: "list" | "today" | "upcoming" | "delete",
  timezone: string,
) {
  const { data: reminders, error } = await db
    .from("reminders")
    .select("id,title,category,priority,schedule_type,timezone,start_at,status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("start_at", { ascending: true })
    .limit(50);
  if (error || !reminders?.length) {
    await sendMessage(
      botToken,
      chatId,
      mode === "delete"
        ? "Tidak ada pengingat aktif untuk dihapus."
        : "Belum ada pengingat aktif. Ketik /reminder untuk membuat yang baru.",
      commandKeyboard,
    );
    return;
  }

  if (mode === "delete") {
    await sendMessage(botToken, chatId, "Pilih pengingat yang ingin dihapus:", {
      inline_keyboard: reminders
        .slice(0, 20)
        .map((reminder: Record<string, any>) => [
          {
            text: `🗑 ${String(reminder.title).slice(0, 45)}`,
            callback_data: `delete-reminder|${reminder.id}`,
          },
        ]),
    });
    return;
  }

  const { data: occurrences } = await db
    .from("reminder_occurrences")
    .select("reminder_id,scheduled_at,snoozed_until,status")
    .in(
      "reminder_id",
      reminders.map((reminder: Record<string, any>) => reminder.id),
    )
    .in("status", ["pending", "sent", "snoozed", "failed"])
    .order("scheduled_at", { ascending: true });
  const now = new Date();
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const nextByReminder = new Map<string, Record<string, any>>();
  for (const occurrence of occurrences ?? []) {
    const existing = nextByReminder.get(occurrence.reminder_id);
    if (
      !existing ||
      new Date(occurrence.snoozed_until ?? occurrence.scheduled_at) <
        new Date(existing.snoozed_until ?? existing.scheduled_at)
    )
      nextByReminder.set(occurrence.reminder_id, occurrence);
  }
  let rows = reminders.flatMap((reminder: Record<string, any>) => {
    const occurrence = nextByReminder.get(reminder.id);
    if (!occurrence) return [];
    const scheduledAt =
      occurrence.status === "snoozed"
        ? occurrence.snoozed_until ?? occurrence.scheduled_at
        : occurrence.scheduled_at;
    return [{ reminder, occurrence, scheduledAt }];
  });
  if (mode === "today")
    rows = rows.filter(
      ({ reminder, scheduledAt }) =>
        localDate(scheduledAt, reminder.timezone ?? timezone) === todayKey,
    );
  if (mode === "upcoming")
    rows = rows.filter(({ scheduledAt }) => new Date(scheduledAt) >= now);
  rows = rows.slice(0, 15);
  if (!rows.length) {
    await sendMessage(
      botToken,
      chatId,
      mode === "today"
        ? "Tidak ada pengingat untuk hari ini."
        : "Tidak ada pengingat mendatang.",
      commandKeyboard,
    );
    return;
  }

  const heading =
    mode === "today"
      ? "📅 Reminder Hari Ini"
      : mode === "upcoming"
        ? "🔭 Reminder Mendatang"
        : "📋 Reminder Aktif";
  const lines = rows.map(({ reminder, scheduledAt }, index) => {
    const priority =
      reminder.priority === "high"
        ? "🔴"
        : reminder.priority === "medium"
          ? "🟡"
          : "🟢";
    return `${index + 1}. ${priority} ${reminder.title}\n   📅 ${displayDate(scheduledAt, reminder.timezone ?? timezone)} · ${localTime(scheduledAt, reminder.timezone ?? timezone)}\n   🏷 ${reminder.category}`;
  });
  await sendMessage(
    botToken,
    chatId,
    `${heading}\n\n${lines.join("\n\n")}`,
    commandKeyboard,
  );
}

export async function handleTelegramMessage(
  db: TelegramDatabase,
  botToken: string,
  message: TelegramMessage,
) {
  if (!message.from || !message.text) return;
  const telegramUserId = String(message.from.id);
  const text = message.text.trim();
  const command = text.split(/\s+/)[0].split("@")[0].toLowerCase();
  const aliases: Record<string, string> = {
    "➕": "/reminder",
    "📋": "/list",
    "📅": "/today",
    "🔭": "/upcoming",
    "❓": "/help",
    "✖": "/cancel",
  };
  const normalizedCommand = aliases[command] ?? command;
  const { data: integration } = await db
    .from("user_integrations")
    .select("user_id")
    .eq("provider", "telegram")
    .eq("provider_user_id", telegramUserId)
    .maybeSingle();

  if (normalizedCommand === "/help") {
    await sendMessage(
      botToken,
      message.chat.id,
      "🤖 Panduan Penggunaan Bot\n\nPerintah yang tersedia:\n/start - Memulai bot\n/help - Menampilkan panduan ini\n/reminder - Membuat pengingat baru (Interaktif)\n/list - Melihat daftar pengingat aktif\n/today - Melihat pengingat hari ini\n/upcoming - Melihat reminder mendatang\n/delete - Menghapus satu atau beberapa reminder\n/cancel - Membatalkan proses saat ini",
      { ...commandKeyboard, one_time_keyboard: false },
    );
    return;
  }

  if (normalizedCommand === "/start") {
    await sendMessage(
      botToken,
      message.chat.id,
      integration
        ? "👋 Bot PingMee siap membantu. Ketik /help untuk melihat perintah atau /reminder untuk membuat pengingat."
        : "👋 Selamat datang di PingMee. Hubungkan Telegram dari Settings di aplikasi terlebih dahulu, lalu buka kembali bot dan tekan Start.",
      integration ? commandKeyboard : undefined,
    );
    return;
  }

  if (!integration) {
    await sendMessage(
      botToken,
      message.chat.id,
      "Akun Telegram belum terhubung. Buka Settings di Smart Reminder, tekan Connect Telegram, lalu tekan Start dari tautan yang diberikan.",
    );
    return;
  }

  const userId = integration.user_id as string;
  if (normalizedCommand === "/cancel") {
    await clearConversation(db, telegramUserId);
    await sendMessage(
      botToken,
      message.chat.id,
      "Proses dibatalkan. Ketik /reminder jika ingin mulai lagi.",
      commandKeyboard,
    );
    return;
  }
  if (
    normalizedCommand === "/reminder" ||
    normalizedCommand === "➕ reminder"
  ) {
    await startReminder(db, botToken, message.chat.id, telegramUserId, userId);
    return;
  }
  if (["/list", "/today", "/upcoming", "/delete"].includes(normalizedCommand)) {
    const { data: profile } = await db
      .from("profiles")
      .select("timezone")
      .eq("id", userId)
      .maybeSingle();
    const mode = normalizedCommand.slice(1) as
      | "list"
      | "today"
      | "upcoming"
      | "delete";
    await listReminders(
      db,
      botToken,
      message.chat.id,
      userId,
      mode,
      profile?.timezone ?? "Asia/Jakarta",
    );
    return;
  }

  const state = await getConversation(db, telegramUserId);
  if (!state) {
    await sendMessage(
      botToken,
      message.chat.id,
      "Perintah belum dikenali. Ketik /help untuk melihat perintah yang tersedia.",
      commandKeyboard,
    );
    return;
  }
  if (text.startsWith("/")) {
    await sendMessage(
      botToken,
      message.chat.id,
      "Perintah itu tidak bisa dipakai di langkah ini. Ketik /cancel untuk membatalkan atau lanjutkan jawaban.",
    );
    return;
  }
  await handleConversationText(db, botToken, state, text);
}

export async function handleTelegramCallback(
  db: TelegramDatabase,
  botToken: string,
  callback: TelegramCallback,
) {
  if (!callback.data) return false;
  const [action, value = ""] = callback.data.split("|");
  const telegramUserId = String(callback.from.id);
  const { data: integration } = await db
    .from("user_integrations")
    .select("user_id")
    .eq("provider", "telegram")
    .eq("provider_user_id", telegramUserId)
    .maybeSingle();

  if (action === "wizard") {
    if (!integration) {
      await answerCallback(
        botToken,
        callback,
        "Akun Telegram belum terhubung.",
        true,
      );
      return true;
    }
    const detail = callback.data.split("|");
    await advanceWizard(
      db,
      botToken,
      callback,
      integration.user_id,
      detail[1] ?? "",
      detail[2] ?? "",
    );
    return true;
  }

  if (action === "delete-reminder") {
    if (!integration || !/^[0-9a-f-]{36}$/i.test(value)) {
      await answerCallback(
        botToken,
        callback,
        "Pengingat tidak ditemukan.",
        true,
      );
      return true;
    }
    const { data, error } = await db
      .from("reminders")
      .delete()
      .eq("id", value)
      .eq("user_id", integration.user_id)
      .select("id")
      .maybeSingle();
    await answerCallback(
      botToken,
      callback,
      error || !data
        ? "Tidak dapat menghapus pengingat."
        : "Pengingat dihapus.",
      Boolean(error || !data),
    );
    if (!error && data && callback.message?.chat.id)
      await sendMessage(
        botToken,
        callback.message.chat.id,
        "🗑 Pengingat berhasil dihapus.",
        commandKeyboard,
      );
    return true;
  }

  return false;
}
