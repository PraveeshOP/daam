import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type AuditLogEntry = {
  id: string;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

const PAGE_SIZE = 30;

/** /admin/audit-log — paginated per §25. admin_audit_logs doesn't store the admin's email
 * directly (only their auth.users id), so this resolves it via the admin-only Auth Admin API
 * rather than a redundant email column that could drift from auth.users. */
export async function listAuditLog(page: number) {
  const supabase = await createServerSupabaseClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count, error } = await supabase
    .from("admin_audit_logs")
    .select("id, admin_user_id, action, entity_type, entity_id, metadata, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error || !data) return { items: [] as AuditLogEntry[], total: 0, pageSize: PAGE_SIZE };

  const service = createServiceClient();
  const emailsByUserId = new Map<string, string>();
  await Promise.all(
    [...new Set(data.map((row) => row.admin_user_id))].map(async (userId) => {
      const { data: userResult } = await service.auth.admin.getUserById(userId).catch(() => ({ data: null }) as never);
      emailsByUserId.set(userId, userResult?.user?.email || userId);
    }),
  );

  const items = data.map((row) => ({
    id: row.id,
    adminEmail: emailsByUserId.get(row.admin_user_id) || row.admin_user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: row.created_at,
  }));

  return { items, total: count ?? items.length, pageSize: PAGE_SIZE };
}
