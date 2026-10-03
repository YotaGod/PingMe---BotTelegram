import { createClient } from "npm:@supabase/supabase-js@2";
import { handleTelegramCallback, handleTelegramMessage } from "./commands.ts";
import {
  isAllowedTelegramUser as checkAllowedTelegramUser,
  SNOOZE_OPTIONS,
} from "../_shared/telegram-policy.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const hex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

async function telegramRequest(
  token: string,
  method: string,
  body: Record<string, unknown>,
) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function getTelegramOccurrenceSummary(
  db: ReturnType<typeof createClient>,
  telegramUserId: number,
  occurrenceId: string,
) {
  const { data: integration } = await db
    .from("user_integrations")
    .select("user_id")
    .eq("provider", "telegram")
    .eq("provider_user_id", String(telegramUserId))
    .maybeSingle();
  if (!integration?.user_id) return null;

  const { data: occurrence } = await db
    .from("reminder_occurrences")
    .select("reminder_id,scheduled_at,snoozed_until")
    .eq("id", occurrenceId)
    .maybeSingle();
  if (!occurrence) return null;

  const { data: reminder } = await db
    .from("reminders")
    .select("title,timezone")
    .eq("id", occurrence.reminder_id)
    .eq("user_id", integration.user_id)
    .maybeSingle();
  if (!reminder) return null;

  return { ...occurrence, ...reminder };
}

function formatSnoozedTime(timestamp: string, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
    hour12: false,
  }).format(new Date(timestamp));
}

function isAllowedTelegramUser(telegramUserId: number) {
  const configured = Deno.env.get("TELEGRAM_ALLOWED_USER_IDS")?.trim();
  const requireAllowlist = Deno.env.get("TELEGRAM_ALLOWLIST_REQUIRED") !== "false";
  return checkAllowedTelegramUser(
    String(telegramUserId),
    configured,
    requireAllowlist,
  );
}

Deno.serve(async (request) => {
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (
    !webhookSecret ||
    request.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret
  )
    return json({ error: "Unauthorized" }, 401);
  if (!botToken || !supabaseUrl || !serviceRoleKey)
    return json({ error: "Webhook secrets are incomplete" }, 500);

  const update = await request.json();
  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const message = update.message;
  if (message?.text && typeof message.from?.id === "number") {
    if (!isAllowedTelegramUser(message.from.id)) {
      await telegramRequest(botToken, "sendMessage", {
        chat_id: message.chat.id,
        text: "Bot ini bersifat privat dan hanya dapat digunakan oleh pemiliknya.",
      });
      return json({ ok: true });
    }
    const match = /^\/start(?:@\w+)?\s+link_([A-Za-z0-9_-]{20,64})$/.exec(
      message.text.trim(),
    );
    if (match) {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(match[1]),
      );
      const tokenHash = hex(digest);
      const { data: linked, error } = await db.rpc("link_telegram_account", {
        p_token_hash: tokenHash,
        p_telegram_user_id: String(message.from.id),
        p_username: message.from.username ?? null,
      });
      if (error || !linked) {
        await telegramRequest(botToken, "sendMessage", {
          chat_id: message.chat.id,
          text: "Tautan sudah kedaluwarsa. Buat tautan baru dari pengaturan PingMe.",
        });
        return json({ ok: true });
      }
      await telegramRequest(botToken, "sendMessage", {
        chat_id: message.chat.id,
        text: "Akun Telegram berhasil terhubung. Pengingat aktifmu akan dikirim ke sini.",
        reply_markup: {
          keyboard: [
            [{ text: "/reminder" }, { text: "/list" }],
            [{ text: "/today" }, { text: "/upcoming" }],
            [{ text: "/help" }, { text: "/cancel" }],
          ],
          resize_keyboard: true,
          is_persistent: true,
        },
      });
      return json({ ok: true });
    }
  }

  if (message?.text && typeof message.from?.id === "number") {
    try {
      await handleTelegramMessage(db, botToken, message);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "telegram_command_failed",
          message:
            error instanceof Error ? error.message : "Unknown command error",
        }),
      );
      await telegramRequest(botToken, "sendMessage", {
        chat_id: message.chat.id,
        text: "Fitur belum siap. Pastikan migration telegram_conversations sudah diterapkan, lalu coba lagi.",
      });
    }
    return json({ ok: true });
  }

  const callback = update.callback_query;
  if (callback?.data && typeof callback.from?.id === "number") {
    if (!isAllowedTelegramUser(callback.from.id)) {
      await telegramRequest(botToken, "answerCallbackQuery", {
        callback_query_id: callback.id,
        text: "Bot ini bersifat privat.",
        show_alert: true,
      });
      return json({ ok: true });
    }
    try {
      if (await handleTelegramCallback(db, botToken, callback))
        return json({ ok: true });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "telegram_callback_failed",
          message:
            error instanceof Error ? error.message : "Unknown callback error",
        }),
      );
      await telegramRequest(botToken, "answerCallbackQuery", {
        callback_query_id: callback.id,
        text: "Fitur belum siap. Coba lagi setelah migration database diterapkan.",
        show_alert: true,
      });
      return json({ ok: true });
    }
    const [action, occurrenceId, minutesText] = String(callback.data).split("|");
    if (action === "snooze_menu" && /^[0-9a-f-]{36}$/i.test(occurrenceId ?? "")) {
      const summary = await getTelegramOccurrenceSummary(
        db,
        callback.from.id,
        occurrenceId,
      );
      if (!summary) {
        await telegramRequest(botToken, "answerCallbackQuery", {
          callback_query_id: callback.id,
          text: "Reminder tidak ditemukan atau sudah tidak aktif.",
          show_alert: true,
        });
        return json({ ok: true });
      }
      await telegramRequest(botToken, "answerCallbackQuery", {
        callback_query_id: callback.id,
        text: "Pilih durasi tunda.",
      });
      await telegramRequest(botToken, "sendMessage", {
        chat_id: callback.message?.chat.id,
        text: `⏰ Tunda reminder\n\n📌 ${summary.title}\nPilih berapa lama reminder ini ditunda:`,
        reply_markup: {
          inline_keyboard: [
            SNOOZE_OPTIONS.slice(0, 3).map((minutes) => ({
              text: `${minutes} menit`,
              callback_data: `snooze|${occurrenceId}|${minutes}`,
            })),
            SNOOZE_OPTIONS.slice(3).map((minutes) => ({
              text: minutes === 1440 ? "Besok" : `${minutes / 60} jam`,
              callback_data: `snooze|${occurrenceId}|${minutes}`,
            })),
          ],
        },
      });
      return json({ ok: true });
    }
    const allowed = new Set(["complete", "snooze", "skip", "disable"]);
    if (!allowed.has(action) || !/^[0-9a-f-]{36}$/i.test(occurrenceId ?? "")) {
      await telegramRequest(botToken, "answerCallbackQuery", {
        callback_query_id: callback.id,
        text: "Tindakan tidak valid.",
        show_alert: true,
      });
      return json({ ok: true });
    }
    const snoozeMinutes = action === "snooze" ? Number(minutesText ?? 10) : 10;
    if (action === "snooze" && !SNOOZE_OPTIONS.includes(snoozeMinutes as (typeof SNOOZE_OPTIONS)[number])) {
      await telegramRequest(botToken, "answerCallbackQuery", {
        callback_query_id: callback.id,
        text: "Durasi tunda tidak valid.",
        show_alert: true,
      });
      return json({ ok: true });
    }
    const { error } = await db.rpc("apply_telegram_occurrence_action", {
      p_telegram_user_id: String(callback.from.id),
      p_occurrence_id: occurrenceId,
      p_action: action,
      p_snooze_minutes: snoozeMinutes,
    });
    if (error) {
      console.error(
        JSON.stringify({
          event: "telegram_occurrence_action_failed",
          action,
          occurrence_id: occurrenceId,
          telegram_user_id: String(callback.from.id),
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        }),
      );
    }
    await telegramRequest(botToken, "answerCallbackQuery", {
      callback_query_id: callback.id,
      text: error
        ? "Pengingat tidak bisa diperbarui."
        : action === "complete"
          ? "Ditandai selesai."
          : action === "snooze"
            ? `Ditunda ${snoozeMinutes} menit.`
            : action === "skip"
              ? "Jadwal ini dilewati."
              : "Pengingat dinonaktifkan.",
      show_alert: Boolean(error),
    });
    if (!error && callback.message?.message_id) {
      await telegramRequest(botToken, "editMessageReplyMarkup", {
        chat_id: callback.message.chat.id,
        message_id: callback.message.message_id,
        reply_markup: { inline_keyboard: [] },
      });
    }
    if (!error && action === "snooze" && callback.message?.chat.id) {
      const summary = await getTelegramOccurrenceSummary(
        db,
        callback.from.id,
        occurrenceId,
      );
      const nextAt = summary?.snoozed_until;
      await telegramRequest(botToken, "sendMessage", {
        chat_id: callback.message.chat.id,
        text: summary && nextAt
          ? `✅ Reminder ditunda\n\n📌 ${summary.title}\n⏰ Durasi: ${snoozeMinutes} menit\n📅 Akan dikirim: ${formatSnoozedTime(nextAt, summary.timezone)}`
          : `✅ Reminder ditunda ${snoozeMinutes} menit.`,
      });
    }
    return json({ ok: true });
  }

  return json({ ok: true });
});
