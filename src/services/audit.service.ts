import { supabase } from '@/lib/supabase';
import type { AuditLog } from '@/types/models';

/**
 * Audit writes must never break the user's action, so failures here are
 * swallowed deliberately — the operation itself already succeeded.
 */
export async function logAudit(
  action: string,
  entityType: string,
  entityId: string | null = null,
  targetLabel: string | null = null,
  changes: Record<string, unknown> | null = null,
): Promise<void> {
  try {
    await supabase.rpc('log_audit', {
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_target_label: targetLabel,
      p_changes: changes,
    });
  } catch {
    /* auditing is best-effort */
  }
}

export async function fetchAuditLogs(limit = 50): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as AuditLog[];
}
