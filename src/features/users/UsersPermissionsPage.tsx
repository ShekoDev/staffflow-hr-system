import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Users } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useToast } from '@/providers/ToastProvider';
import { useAuth } from '@/providers/AuthProvider';
import { usePermissionCatalog, useRoles } from '@/hooks/useOrganization';
import { PERMISSIONS } from '@/lib/permissions';
import {
  fetchRolePermissions,
  fetchUserPermissions,
  fetchUsers,
  setRolePermission,
  setUserActive,
  setUserPermission,
  updateUserRole,
} from '@/services/users.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/ui/Table';
import { Select, Switch } from '@/components/ui/Field';
import { Pill } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/format';
import type { AppUser, Permission } from '@/types/models';

export function UsersPermissionsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'users' | 'roles'>('users');

  return (
    <>
      <PageHeader title={t('users.title')} subtitle={t('users.subtitle')} />
      <Tabs
        className="mb-4 max-w-md"
        value={tab}
        onChange={(key) => setTab(key as 'users' | 'roles')}
        items={[
          { key: 'users', label: t('users.tabUsers'), icon: <Users size={15} /> },
          { key: 'roles', label: t('users.tabRoles'), icon: <ShieldCheck size={15} /> },
        ]}
      />
      {tab === 'users' ? <UsersTab /> : <RolePermissionsTab />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

function UsersTab() {
  const { t, localized, language } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can, profile } = useAuth();

  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const { data: roles = [] } = useRoles();
  const [overridesFor, setOverridesFor] = useState<AppUser | null>(null);

  const canManage = can(PERMISSIONS.users.manage);

  const roleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      updateUserRole(userId, roleId),
    onSuccess: () => {
      toast.success(t('users.roleUpdated'));
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const activeMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      setUserActive(userId, isActive),
    onSuccess: () => {
      toast.success(t('users.statusUpdated'));
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const columns: Column<AppUser>[] = [
    {
      key: 'user',
      header: t('users.user'),
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-content">{row.username || row.email}</p>
          <p className="truncate text-xs text-content-muted">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: t('users.role'),
      render: (row) =>
        canManage && row.id !== profile?.user.id ? (
          <Select
            value={row.role_id ?? ''}
            className="h-9 py-0 text-xs"
            onChange={(e) => roleMutation.mutate({ userId: row.id, roleId: e.target.value })}
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {localized(role.name_en, role.name_ar)}
              </option>
            ))}
          </Select>
        ) : (
          <Pill tone="primary">{localized(row.role?.name_en, row.role?.name_ar) || '—'}</Pill>
        ),
    },
    {
      key: 'status',
      header: t('users.accountStatus'),
      render: (row) =>
        canManage && row.id !== profile?.user.id ? (
          <Switch
            checked={row.is_active}
            onChange={(next) => activeMutation.mutate({ userId: row.id, isActive: next })}
          />
        ) : (
          <Pill tone={row.is_active ? 'success' : 'neutral'}>
            {row.is_active ? t('common.active') : t('common.inactive')}
          </Pill>
        ),
    },
    {
      key: 'lastLogin',
      header: t('users.lastLogin'),
      hideOnMobile: true,
      render: (row) => (
        <span className="text-xs text-content-muted">
          {row.last_login_at ? formatDateTime(row.last_login_at, language) : t('users.never')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-end',
      render: (row) =>
        can(PERMISSIONS.users.permissions) ? (
          <Button size="sm" variant="secondary" onClick={() => setOverridesFor(row)}>
            {t('users.overrides')}
          </Button>
        ) : null,
    },
  ];

  if (isLoading) {
    return (
      <Card>
        <SkeletonTable />
      </Card>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        rows={users}
        rowKey={(row) => row.id}
        emptyState={<EmptyState title={t('users.noUsers')} />}
      />
      <UserOverridesModal user={overridesFor} onClose={() => setOverridesFor(null)} />
    </>
  );
}

function UserOverridesModal({ user, onClose }: { user: AppUser | null; onClose: () => void }) {
  const { t, localized } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: permissions = [] } = usePermissionCatalog();
  const { data: overrides = [], refetch } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: () => fetchUserPermissions(user?.id as string),
    enabled: Boolean(user?.id),
  });

  const overrideMap = new Map(overrides.map((row) => [row.permission_id, row.granted]));
  const grouped = useMemo(() => groupByModule(permissions), [permissions]);

  const mutation = useMutation({
    mutationFn: ({ permissionId, mode }: { permissionId: string; mode: 'inherit' | 'allow' | 'deny' }) =>
      setUserPermission(user?.id as string, permissionId, mode),
    onSuccess: () => {
      toast.success(t('users.permissionsUpdated'));
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      size="lg"
      title={user?.username || user?.email}
      description={t('users.overridesHint')}
    >
      <div className="space-y-5">
        {Object.entries(grouped).map(([module, list]) => (
          <section key={module}>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-content-muted">
              {module}
            </h4>
            <div className="space-y-1.5">
              {list.map((permission) => {
                const current = overrideMap.has(permission.id)
                  ? overrideMap.get(permission.id)
                    ? 'allow'
                    : 'deny'
                  : 'inherit';
                return (
                  <div
                    key={permission.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-theme-sm border border-line px-3 py-2"
                  >
                    <span className="min-w-0 text-sm text-content">
                      {localized(permission.name_en, permission.name_ar)}
                      <span className="ms-2 text-[10px] text-content-muted">{permission.key}</span>
                    </span>
                    <div className="flex gap-1">
                      {(['inherit', 'allow', 'deny'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => mutation.mutate({ permissionId: permission.id, mode })}
                          className={[
                            'rounded-full px-2.5 py-1 text-[11px] font-bold transition',
                            current === mode
                              ? mode === 'deny'
                                ? 'bg-danger text-white'
                                : mode === 'allow'
                                  ? 'bg-success text-white'
                                  : 'bg-content-muted/20 text-content'
                              : 'text-content-muted hover:bg-surface-alt',
                          ].join(' ')}
                        >
                          {mode === 'inherit'
                            ? t('users.inheritFromRole')
                            : mode === 'allow'
                              ? t('users.allow')
                              : t('users.deny')}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Role permission matrix                                              */
/* ------------------------------------------------------------------ */

function RolePermissionsTab() {
  const { t, localized } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can } = useAuth();

  const { data: roles = [] } = useRoles();
  const { data: permissions = [] } = usePermissionCatalog();
  const { data: matrix = [], isLoading } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: fetchRolePermissions,
  });

  const [roleId, setRoleId] = useState<string>('');
  const activeRoleId = roleId || roles.find((r) => r.key === 'hr')?.id || roles[0]?.id || '';
  const canEdit = can(PERMISSIONS.users.permissions);

  const assigned = new Set(
    matrix.filter((row) => row.role_id === activeRoleId).map((row) => row.permission_id),
  );
  const grouped = useMemo(() => groupByModule(permissions), [permissions]);

  const mutation = useMutation({
    mutationFn: ({ permissionId, enabled }: { permissionId: string; enabled: boolean }) =>
      setRolePermission(activeRoleId, permissionId, enabled),
    onSuccess: () => {
      toast.success(t('users.permissionsUpdated'));
      void queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  if (isLoading) {
    return (
      <Card>
        <SkeletonTable rows={8} cols={2} />
      </Card>
    );
  }

  const activeRole = roles.find((r) => r.id === activeRoleId);

  return (
    <Card>
      <CardHeader
        title={t('users.tabRoles')}
        subtitle={t('users.rolePermissionsHint')}
        action={
          <Select
            value={activeRoleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="h-9 py-0 text-sm"
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {localized(role.name_en, role.name_ar)}
              </option>
            ))}
          </Select>
        }
      />

      {activeRole?.key === 'admin' && (
        <p className="mb-4 rounded-theme-sm border border-primary/30 bg-primary/8 px-3 py-2 text-xs text-content-muted">
          {t('users.rolePermissionsHint')}
        </p>
      )}

      <div className="space-y-5">
        {Object.entries(grouped).map(([module, list]) => (
          <section key={module}>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-content-muted">
              {module}
            </h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {list.map((permission) => (
                <label
                  key={permission.id}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-theme-sm border border-line px-3 py-2 transition hover:border-primary/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-content">
                      {localized(permission.name_en, permission.name_ar)}
                    </span>
                    <span className="block text-[10px] text-content-muted">{permission.key}</span>
                  </span>
                  <Switch
                    checked={assigned.has(permission.id)}
                    disabled={!canEdit || activeRole?.key === 'admin'}
                    onChange={(next) =>
                      mutation.mutate({ permissionId: permission.id, enabled: next })
                    }
                  />
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Card>
  );
}

function groupByModule(permissions: Permission[]): Record<string, Permission[]> {
  return permissions.reduce<Record<string, Permission[]>>((acc, permission) => {
    (acc[permission.module] ??= []).push(permission);
    return acc;
  }, {});
}
