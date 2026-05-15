// Server-fn middleware: validates Bearer token and exposes a user-scoped client.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_EXT_URL, SUPABASE_EXT_PUBLISHABLE_KEY } from "./client";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    const authHeader = request?.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Unauthorized: missing bearer token");
    }
    const token = authHeader.slice("Bearer ".length);

    const supabase = createClient(SUPABASE_EXT_URL, SUPABASE_EXT_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new Error("Unauthorized: invalid token");
    }

    return next({
      context: { supabase, userId: data.user.id, user: data.user },
    });
  },
);
