import { createClient } from "@supabase/supabase-js";

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!rawSupabaseUrl) {
  throw new Error("VITE_SUPABASE_URL is missing.");
}

if (!supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_ANON_KEY is missing.");
}

const supabaseUrl = rawSupabaseUrl
  .trim()
  .replace(/\/+$/, "");

const parsedUrl = new URL(supabaseUrl);

if (
  parsedUrl.protocol !== "https:" ||
  !parsedUrl.hostname.endsWith(".supabase.co") ||
  (parsedUrl.pathname !== "" && parsedUrl.pathname !== "/")
) {
  throw new Error(
    "Invalid Supabase URL. It must look like https://PROJECT-REFERENCE.supabase.co"
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey.trim()
);