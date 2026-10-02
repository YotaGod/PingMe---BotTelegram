import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function equalsSecret(left: string, right: string) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  const workerSecret = Deno.env.get("WORKER_SECRET");
  if (
    !workerSecret ||
    !equalsSecret(request.headers.get("x-worker-secret") ?? "", workerSecret)
  )
    return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!supabaseUrl || !serviceRoleKey || !botToken)
    return json({ error: "Worker secrets are incomplete" }, 500);

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const startedAt = new Date().toISOString();
  await db.from("worker_health").upsert({
    id: true,
    started_at: startedAt,
    finished_at: null,
    claimed_count: 0,
    sent_count: 0,
    failed_count: 0,
    last_error: null,
    updated_at: startedAt,
  });
  console.log(
    JSON.stringify({
      event: "worker_started",
      at: new Date().toISOString(),
      batch_limit: 40,
    }),
  );
  const { data: claimed, error: claimError } = await db.rpc(
    "claim_due_occurrences",
    { p_batch_size: 40 },
  );
  if (claimError) {
    await db.from("worker_health").upsert({
      id: true,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      claimed_count: 0,
      sent_count: 0,
      failed_count: 1,
      last_error: claimError.message.slice(0, 500),
      updated_at: new Date().toISOString(),
    });
    console.error(
      JSON.stringify({
        event: "worker_claim_failed",
        message: claimError.message,
      }),
    );
    return json({ error: "Could not claim due reminders" }, 500);
  }

  console.log(
    JSON.stringify({
      event: "worker_claimed_batch",
      count: claimed?.length ?? 0,
    }),
  );

  let sent = 0;
  let failed = 0;
  for (const occurrence of claimed ?? []) {
    console.log(
      JSON.stringify({
        event: "occurrence_claimed",
        occurrence_id: occurrence.id,
        attempt: occurrence.attempt_count,
      }),
    );
    const { data: reminder, error: reminderError } = await db
      .from("reminders")
      .select(
        "id,user_id,title,message,category,timezone,schedule_type,status,profiles!reminders_user_id_fkey(display_name)",
      )
      .eq("id", occurrence.reminder_id)
      .maybeSingle();
    if (reminderError || !reminder || reminder.status !== "active") {
      await db
        .from("reminder_occurrences")
        .update({ status: "cancelled", claimed_at: null })
        .eq("id", occurrence.id);
      failed += 1;
      continue;
    }

    const { data: integration } = await db
      .from("user_integrations")
      .select("provider_user_id")
      .eq("user_id", reminder.user_id)
      .eq("provider", "telegram")
      .maybeSingle();
    const { data: channel } = await db
      .from("notification_channels")
      .select("id")
      .eq("name", "telegram")
      .eq("enabled", true)
      .maybeSingle();
    const { data: preference } = channel
      ? await db
          .from("reminder_channels")
          .select("enabled")
          .eq("reminder_id", reminder.id)
          .eq("channel_id", channel.id)
          .maybeSingle()
      : { data: null };
    const attempt = Number(occurrence.attempt_count);
    if (!integration || !channel || !preference?.enabled) {
      if (channel) {
        await db.from("notification_logs").insert({
          occurrence_id: occurrence.id,
          channel_id: channel.id,
          status: "failed",
          attempt_number: attempt,
          error_message: "Telegram account or reminder channel is not enabled",
        });
      }
      await db
        .from("reminder_occurrences")
        .update({
          status: "pending",
          claimed_at: null,
          last_error: "Telegram account or reminder channel is not enabled",
        })
        .eq("id", occurrence.id);
      failed += 1;
      continue;
    }

    const { data: log } = await db
      .from("notification_logs")
      .insert({
        occurrence_id: occurrence.id,
        channel_id: channel.id,
        status: "sending",
        attempt_number: attempt,
      })
      .select("id")
      .single();
    const scheduled = new Date(occurrence.scheduled_at);
    const late = Date.now() - scheduled.getTime() > 60_000;
    const profile = Array.isArray(reminder.profiles)
      ? reminder.profiles[0]
      : reminder.profiles;
    const displayName = profile?.display_name
      ? `, ${escapeHtml(profile.display_name)}`
      : "";
    const lines = [
      late ? "<b>⚠️ Reminder terlewat</b>" : "<b>🔔 REMINDER</b>",
      "",
      `<b>${escapeHtml(reminder.title)}</b>`,
    ];
    if (reminder.message) lines.push("", escapeHtml(reminder.message));
    lines.push(
      "",
      `🕐 ${new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: reminder.timezone, hour12: false }).format(scheduled)} · ${escapeHtml(reminder.timezone)}`,
    );
    if (late)
      lines.splice(
        2,
        0,
        `Diproses: ${new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: reminder.timezone, hour12: false }).format(new Date())}`,
        `Seharusnya: ${new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: reminder.timezone, hour12: false }).format(scheduled)}`,
      );
    if (displayName) lines.push("", `Hai${displayName},`);

    const actionButtons =
      reminder.schedule_type === "one_time"
        ? [
            [
              {
                text: "✅ Selesai",
                callback_data: `complete|${occurrence.id}`,
              },
              {
                text: "🔕 Nonaktifkan",
                callback_data: `disable|${occurrence.id}`,
              },
            ],
          ]
        : [
            [
              {
                text: "✅ Selesai",
                callback_data: `complete|${occurrence.id}`,
              },
              {
                text: "⏰ Tunda 10 mnt (hari ini)",
                callback_data: `snooze_menu|${occurrence.id}`,
              },
            ],
            [
              { text: "⏭️ Skip", callback_data: `skip|${occurrence.id}` },
              {
                text: "🔕 Nonaktifkan",
                callback_data: `disable|${occurrence.id}`,
              },
            ],
          ];

    try {
      console.log(
        JSON.stringify({
          event: "notification_started",
          occurrence_id: occurrence.id,
          channel: "telegram",
          attempt,
        }),
      );
      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: integration.provider_user_id,
            text: lines.join("\n"),
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: actionButtons },
          }),
        },
      );
      const payload = await telegramResponse.json();
      if (!telegramResponse.ok || !payload.ok)
        throw new Error(payload.description ?? "Telegram delivery failed");
      await db
        .from("notification_logs")
        .update({
          status: "sent",
          provider_message_id: String(payload.result.message_id),
          sent_at: new Date().toISOString(),
        })
        .eq("id", log?.id);
      await db
        .from("reminder_occurrences")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          claimed_at: null,
          snoozed_until: null,
          last_error: null,
        })
        .eq("id", occurrence.id);
      console.log(
        JSON.stringify({
          event: "notification_sent",
          occurrence_id: occurrence.id,
          provider_message_id: String(payload.result.message_id),
        }),
      );
      sent += 1;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Unknown Telegram error";
      await db
        .from("notification_logs")
        .update({ status: "failed", error_message: message })
        .eq("id", log?.id);
      await db
        .from("reminder_occurrences")
        .update({
          status: attempt >= 5 ? "failed" : "pending",
          claimed_at: null,
          last_error: message,
        })
        .eq("id", occurrence.id);
      console.error(
        JSON.stringify({
          event: "notification_failed",
          occurrence_id: occurrence.id,
          attempt,
          message,
        }),
      );
      failed += 1;
    }
  }

  await db.from("worker_health").upsert({
    id: true,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    claimed_count: claimed?.length ?? 0,
    sent_count: sent,
    failed_count: failed,
    last_error: failed ? "One or more notifications failed" : null,
    updated_at: new Date().toISOString(),
  });
  return json({ claimed: claimed?.length ?? 0, sent, failed });
});
