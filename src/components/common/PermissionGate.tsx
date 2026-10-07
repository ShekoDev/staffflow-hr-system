import type { ReactNode } from 'react';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Renders children only when the user holds the permission.
 *
 * This is a convenience for the UI — the database enforces the same rules
 * through RLS, so hiding a button is never the only line of defence.
 */
export function PermissionGate({
  permission,
  anyOf,
  fallback = null,
  children,
}: {
  permission?: string;
  anyOf?: string[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can, canAny } = useAuth();
  const allowed = permission ? can(permission) : anyOf ? canAny(anyOf) : true;
  return <>{allowed ? children : fallback}</>;
}
