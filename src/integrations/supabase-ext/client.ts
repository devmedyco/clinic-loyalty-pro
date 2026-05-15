// External Supabase project (user-owned account).
// URL + anon key are public (publishable) and safe to ship in the browser bundle.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bpupkgstumvgbxhdhlrx.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwdXBrZ3N0dW12Z2J4aGRobHJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODc4MzksImV4cCI6MjA5NDM2MzgzOX0.Fg2XXkCzgeJ7OqOQ-l0AvotrpRK2S2zvnArAB-DDemk";

export const SUPABASE_EXT_URL = SUPABASE_URL;
export const SUPABASE_EXT_ANON_KEY = SUPABASE_ANON_KEY;

function createSupabaseExtClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
