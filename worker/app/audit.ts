import type { Env } from './env';
import { COMPANY_ID } from './env';
import { table } from './supabase';

export type AuditUser = {
  id?: string | null;
  company_id?: string | null;
};

export async function audit(
  env: Env,
  user: AuditUser | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details: unknown = {},
  userToken?: string,
) {
  await table(env, 'audit_logs', '', {
    method: 'POST',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify({
      company_id: user?.company_id || COMPANY_ID,
      user_id: user?.id || null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    }),
  }, userToken);
}
