import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase-ext/client.server";

const AUTH_USERS_PAGE_SIZE = 200;

export async function listAllAuthUsers() {
  const users: User[] = [];

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: AUTH_USERS_PAGE_SIZE,
    });
    if (error) throw new Error(error.message);

    users.push(...(data.users ?? []));
    if ((data.users ?? []).length < AUTH_USERS_PAGE_SIZE) break;
  }

  return users;
}

export async function findAuthUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const users = await listAllAuthUsers();
  return users.find((user) => user.email?.toLowerCase() === normalizedEmail) ?? null;
}
