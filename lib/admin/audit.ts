import type { AdminActor } from "@/lib/admin/auth";
import { logError } from "@/lib/logger";
import type { Json } from "@/types/database";

/**
 * Records one administrative action (section 24 of the phase-6 spec). Called after the actual
 * mutation succeeds, using the acting admin's own session-scoped client — the
 * "Admins can write own audit logs" RLS policy requires admin_user_id = auth.uid(), so this can
 * never be used to forge another admin's identity. Never throws: a failed audit write must not
 * undo (or appear to undo) a real action that already happened.
 */
export async function logAdminAction(
  admin: AdminActor,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Record<string, Json>,
): Promise<void> {
  const { error } = await admin.supabase.from("admin_audit_logs").insert({
    admin_user_id: admin.userId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    metadata: (metadata ?? {}) as Json,
  });
  if (error) logError("audit", `could not record "${action}" on ${entityType}${entityId ? ` ${entityId}` : ""}: ${error.message}`);
}
