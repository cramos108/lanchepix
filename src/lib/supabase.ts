import { createClient } from "@supabase/supabase-js";

function projectUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

const url = projectUrl();
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured = Boolean(url && key);

export const supabase = createClient(url || "https://invalid.supabase.co", key || "public-anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});
