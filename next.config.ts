import type { NextConfig } from "next";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.project_url;
const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.publishable_key ??
  process.env.anon_key;

const nextConfig: NextConfig = {
  env: {
    ...(supabaseUrl ? { NEXT_PUBLIC_SUPABASE_URL: supabaseUrl } : {}),
    ...(supabasePublicKey
      ? { NEXT_PUBLIC_SUPABASE_ANON_KEY: supabasePublicKey }
      : {}),
  },
};

export default nextConfig;
