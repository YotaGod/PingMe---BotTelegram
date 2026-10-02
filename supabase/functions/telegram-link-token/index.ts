import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken)
    return json({ error: "A signed-in user session is required" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const botUsername = Deno.env.get("TELEGRAM_BOT_USERNAME");
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceKey ||
    !botUsername ||
    !botToken ||
    !webhookSecret
  )
    return json({ error: "Linking is not configured" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser(accessToken);
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const webhookSetup = await fetch(
    `https://api.telegram.org/bot${botToken}/setWebhook`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: `${supabaseUrl}/functions/v1/telegram-webhook`,
        secret_token: webhookSecret,
        allowed_updates: ["message", "callback_query"],
      }),
    },
  );
  const webhookResult = await webhookSetup.json();
  if (!webhookSetup.ok || !webhookResult.ok)
    return json({ error: "Telegram webhook could not be configured" }, 502);

  const commandSetup = await fetch(
    `https://api.telegram.org/bot${botToken}/setMyCommands`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        commands: [
          { command: "start", description: "Memulai bot" },
          { command: "help", description: "Panduan penggunaan" },
          { command: "reminder", description: "Buat pengingat baru" },
          { command: "list", description: "Lihat pengingat aktif" },
          { command: "today", description: "Lihat pengingat hari ini" },
          { command: "upcoming", description: "Lihat reminder mendatang" },
          { command: "delete", description: "Hapus pengingat" },
          { command: "cancel", description: "Batalkan proses saat ini" },
        ],
      }),
    },
  );
  const commandResult = await commandSetup.json();
  if (!commandSetup.ok || !commandResult.ok)
    return json(
      { error: "Telegram command menu could not be configured" },
      502,
    );

  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const token = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  const tokenHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const { error } = await db.from("telegram_link_tokens").insert({
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (error) return json({ error: "Could not create a Telegram link" }, 500);
  return json({
    url: `https://t.me/${botUsername}?start=link_${token}`,
    expiresInSeconds: 600,
  });
});
