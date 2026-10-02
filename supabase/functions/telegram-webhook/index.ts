import { createClient } from "npm:@supabase/supabase-js@2";
import { handleTelegramCallback, handleTelegramMessage } from "./commands.ts";

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
    const [action, occurrenceId] = String(callback.data).split("|");
    const allowed = new Set(["complete", "snooze", "skip", "disable"]);
    if (!allowed.has(action) || !/^[0-9a-f-]{36}$/i.test(occurrenceId ?? "")) {
      await telegramRequest(botToken, "answerCallbackQuery", {
        callback_query_id: callback.id,
        text: "Tindakan tidak valid.",
        show_alert: true,
      });
      return json({ ok: true });
    }
    const { error } = await db.rpc("apply_telegram_occurrence_action", {
      p_telegram_user_id: String(callback.from.id),
      p_occurrence_id: occurrenceId,
      p_action: action,
      p_snooze_minutes: 10,
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
            ? "Ditunda 10 menit untuk reminder hari ini."
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
    return json({ ok: true });
  }

  return json({ ok: true });
});
