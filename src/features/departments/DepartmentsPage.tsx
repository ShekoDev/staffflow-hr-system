import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useToast } from '@/providers/ToastProvider';
import { useDepartments, useEmployeeOptions } from '@/hooks/useOrganization';
import { PERMISSIONS } from '@/lib/permissions';
import {
  createDepartment,
  deleteDepartment,
  updateDepartment,
  type DepartmentInput,
} from '@/services/departments.service';
import { PageHeader } from '@/components/common/PageHeader';
import { PermissionGate } from '@/components/common/PermissionGate';
import { EmployeeIdentity } from '@/components/common/EmployeeIdentity';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Input, Select, Switch, Textarea } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Pill } from '@/components/ui/Badge';
import type { Department } from '@/types/models';

const EMPTY: DepartmentInput = {
  name_en: '',
  name_ar: '',
  code: '',
  description: '',
  manager_id: null,
  is_active: true,
};

export function DepartmentsPage() {
  const { t, localized } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: departments = [], isLoading } = useDepartments();
  const { data: managers = [] } = useEmployeeOptions();

  const [editing, setEditing] = useState<Department | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<DepartmentInput>(EMPTY);
  const [pendingDelete, setPendingDelete] = useState<Department | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      editing
        ? {
            name_en: editing.name_en,
            name_ar: editing.name_ar,
            code: editing.code ?? '',
            description: editing.description ?? '',
            manager_id: editing.manager_id,
            is_active: editing.is_active,
          }
        : EMPTY,
    );
  }, [open, editing]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['departments'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: DepartmentInput = {
        ...form,
        code: form.code || null,
        description: form.description || null,
      };
      return editing ? updateDepartment(editing.id, payload) : createDepartment(payload);
    },
    onSuccess: () => {
      toast.success(editing ? t('departments.updated') : t('departments.created'));
      invalidate();
      setOpen(false);
      setEditing(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (department: Department) => deleteDepartment(department.id, department.name_en),
    onSuccess: () => {
      toast.success(t('departments.deleted'));
      invalidate();
      setPendingDelete(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  return (
    <>
      <PageHeader
        title={t('departments.title')}
        subtitle={t('departments.subtitle')}
        actions={
          <PermissionGate permission={PERMISSIONS.organization.departments}>
            <Button
              leftIcon={<Plus size={16} />}
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              {t('departments.newDepartment')}
            </Button>
          </PermissionGate>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-3 h-4 w-1/2" />
              <Skeleton className="mt-6 h-9 w-full" />
            </Card>
          ))}
        </div>
      ) : departments.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<Building2 size={24} />}
            title={t('departments.noDepartments')}
            description={t('departments.noDepartmentsBody')}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {departments.map((department, index) => (
            <Card
              key={department.id}
              className="animate-fade-up"
            >
              <div style={{ animationDelay: `${index * 40}ms` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-content">
                      {localized(department.name_en, department.name_ar)}
                    </h3>
                    {department.code && (
                      <p className="mt-0.5 text-xs text-content-muted">{department.code}</p>
                    )}
                  </div>
                  <PermissionGate permission={PERMISSIONS.organization.departments}>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t('common.edit')}
                        onClick={() => {
                          setEditing(department);
                          setOpen(true);
                        }}
                      >
                        <Pencil size={15} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t('common.delete')}
                        className="text-danger"
                        onClick={() => setPendingDelete(department)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </PermissionGate>
                </div>

                {department.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-content-muted">{department.description}</p>
                )}

                <div className="mt-4 border-t border-line pt-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-content-muted">
                    {t('departments.manager')}
                  </p>
                  {department.manager ? (
                    <EmployeeIdentity employee={department.manager} size="xs" />
                  ) : (
                    <p className="text-sm text-content-muted">{t('common.notAssigned')}</p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <Pill tone="primary" icon={<Users size={12} />}>
                    {department.employee_count ?? 0} {t('departments.headcount')}
                  </Pill>
                  <Pill tone={department.is_active ? 'success' : 'neutral'}>
                    {department.is_active ? t('common.active') : t('common.inactive')}
                  </Pill>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t('departments.editDepartment') : t('departments.newDepartment')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('departments.nameEn')}
            value={form.name_en}
            onChange={(e) => setForm({ ...form, name_en: e.target.value })}
            required
          />
          <Input
            label={t('departments.nameAr')}
            value={form.name_ar}
            onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
            dir="rtl"
            required
          />
          <Input
            label={t('departments.code')}
            value={form.code ?? ''}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            dir="ltr"
          />
          <Select
            label={t('departments.manager')}
            value={form.manager_id ?? ''}
            onChange={(e) => setForm({ ...form, manager_id: e.target.value || null })}
          >
            <option value="">{t('common.notAssigned')}</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {localized(m.full_name_en, m.full_name_ar)}
              </option>
            ))}
          </Select>
          <Textarea
            label={t('departments.description')}
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            wrapperClassName="sm:col-span-2"
          />
          <div className="sm:col-span-2">
            <Switch
              checked={form.is_active}
              onChange={(next) => setForm({ ...form, is_active: next })}
              label={t('common.active')}
            />
          </div>
          {error && (
            <p className="sm:col-span-2 rounded-theme-sm border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t('departments.deleteConfirm', { name: pendingDelete?.name_en ?? '' })}
        description={t('departments.deleteConfirmBody')}
        confirmLabel={t('common.delete')}
        loading={removeMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && removeMutation.mutate(pendingDelete)}
      />
    </>
  );
}
