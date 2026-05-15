// SERVER-ONLY admin client for the external Supabase project.
// Uses service_role key — bypasses RLS. Never import from client code.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_EXT_URL =
  process.env.EXT_SUPABASE_URL ||
  import.meta.env.VITE_EXT_SUPABASE_URL ||
  "https://bpupkgstumvgbxhdhlrx.supabase.co";

function createSupabaseAdmin() {
  const key = process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Missing EXT_SUPABASE_SERVICE_ROLE_KEY env var");
  }
  return createClient(SUPABASE_EXT_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let _admin: ReturnType<typeof createSupabaseAdmin> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdmin>, {
  get(_, prop, receiver) {
    if (!_admin) _admin = createSupabaseAdmin();
    return Reflect.get(_admin, prop, receiver);
  },
});
