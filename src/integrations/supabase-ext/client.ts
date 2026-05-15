import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_EXT_SUPABASE_URL ||
  process.env.EXT_SUPABASE_URL ||
  "https://bpupkgstumvgbxhdhlrx.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_EXT_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXT_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_uOwpCHsKufUkJ6CAMWGRmw_hTB9ZR71";

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Missing external Supabase configuration");
}

export const SUPABASE_EXT_URL = SUPABASE_URL;
export const SUPABASE_EXT_PUBLISHABLE_KEY = SUPABASE_PUBLISHABLE_KEY;

function createSupabaseExtClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _client: ReturnType<typeof createSupabaseExtClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseExtClient>, {
  get(_, prop, receiver) {
    if (!_client) _client = createSupabaseExtClient();
    return Reflect.get(_client, prop, receiver);
  },
});
