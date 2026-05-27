import { supabaseAdmin } from "@/integrations/supabase-ext/client.server";

type OperationalEventInput = {
  tenantId?: string | null;
  actorUserId?: string | null;
  scope?: "platform" | "tenant" | "billing" | "auth" | "support";
  level?: "info" | "warning" | "error";
  eventType: string;
  title: string;
  detail?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordOperationalEvent(input: OperationalEventInput) {
  try {
    await supabaseAdmin.from("operational_events").insert({
      tenant_id: input.tenantId ?? null,
      actor_user_id: input.actorUserId ?? null,
      scope: input.scope ?? "platform",
      level: input.level ?? "info",
      event_type: input.eventType,
      title: input.title,
      detail: input.detail ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    console.error("Failed to record operational event", error);
  }
}
