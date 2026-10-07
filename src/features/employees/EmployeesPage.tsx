import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Filter, Pencil, Plus, Search, Trash2, UserPlus, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { useDebounce } from '@/hooks/useDebounce';
import { useDepartments, useEmployeeOptions } from '@/hooks/useOrganization';
import { PERMISSIONS } from '@/lib/permissions';
import { deleteEmployee, fetchEmployees, type EmployeeFilters } from '@/services/employees.service';
import { PageHeader } from '@/components/common/PageHeader';
import { PermissionGate } from '@/components/common/PermissionGate';
import { EmployeeIdentity } from '@/components/common/EmployeeIdentity';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Pill } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Field';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/Modal';
import { EmployeeFormModal } from './EmployeeFormModal';
import { formatDate } from '@/lib/format';
import type { Employee, EmploymentStatus, Gender } from '@/types/models';

const PAGE_SIZE = 15;

export function EmployeesPage() {
  const { t, localized, language } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can } = useAuth();

  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('all');
  const [managerId, setManagerId] = useState<string>('all');
  const [gender, setGender] = useState<Gender | 'all'>('all');
  const [status, setStatus] = useState<EmploymentStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const [editing, setEditing] = useState<Employee | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Employee | null>(null);

  const debouncedSearch = useDebounce(search);
  const { data: departments = [] } = useDepartments();
  const { data: managers = [] } = useEmployeeOptions();

  const filters: EmployeeFilters = useMemo(
    () => ({
      search: debouncedSearch,
      departmentId,
      managerId,
      gender,
      status,
      page,
      pageSize: PAGE_SIZE,
    }),
    [debouncedSearch, departmentId, managerId, gender, status, page],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ['employees', filters],
    queryFn: () => fetchEmployees(filters),
  });

  const removeMutation = useMutation({
    mutationFn: (employee: Employee) => deleteEmployee(employee.id, employee.full_name_en),
    onSuccess: () => {
      toast.success(t('employees.deleted'));
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      setPendingDelete(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const canEdit = can(PERMISSIONS.employees.editAll) || can(PERMISSIONS.employees.editTeam);
  const activeFilterCount = [departmentId, managerId, gender, status].filter((v) => v !== 'all').length;

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: t('employees.title'),
      render: (row) => (
        <Link to={`/employees/${row.id}`} className="block">
          <EmployeeIdentity employee={row} subtitle={row.employee_code} />
        </Link>
      ),
    },
    {
      key: 'job',
      header: t('employees.jobTitle'),
      hideOnMobile: true,
      render: (row) => <span className="text-sm text-content-muted">{row.job_title || '—'}</span>,
    },
    {
      key: 'department',
      header: t('employees.department'),
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm text-content-muted">
          {localized(row.department?.name_en, row.department?.name_ar) || '—'}
        </span>
      ),
    },
    {
      key: 'manager',
      header: t('employees.manager'),
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm text-content-muted">
          {localized(row.manager?.full_name_en, row.manager?.full_name_ar) || '—'}
        </span>
      ),
    },
    {
      key: 'joined',
      header: t('employees.joiningDate'),
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm text-content-muted">{formatDate(row.joining_date, language)}</span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <Pill tone={row.employment_status === 'active' ? 'success' : 'neutral'}>
          {row.employment_status === 'active' ? t('common.active') : t('common.inactive')}
        </Pill>
      ),
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-end',
      className: 'text-end',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {canEdit && (
            <Button
              size="icon"
              variant="ghost"
              aria-label={t('common.edit')}
              onClick={() => {
                setEditing(row);
                setFormOpen(true);
              }}
            >
              <Pencil size={15} />
            </Button>
          )}
          <PermissionGate permission={PERMISSIONS.employees.delete}>
            <Button
              size="icon"
              variant="ghost"
              aria-label={t('common.delete')}
              className="text-danger"
              onClick={() => setPendingDelete(row)}
            >
              <Trash2 size={15} />
            </Button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('employees.title')}
        subtitle={t('employees.subtitle')}
        actions={
          <PermissionGate permission={PERMISSIONS.employees.create}>
            <Button
              leftIcon={<Plus size={16} />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              {t('employees.newEmployee')}
            </Button>
          </PermissionGate>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('common.search')}
            icon={<Search size={16} />}
            wrapperClassName="min-w-[12rem] flex-1"
          />
          <Button
            variant={showFilters ? 'primary' : 'secondary'}
            leftIcon={<Filter size={15} />}
            onClick={() => setShowFilters((o) => !o)}
          >
            {t('common.filter')}
            {activeFilterCount > 0 && (
              <span className="ms-1 rounded-full bg-white/25 px-1.5 text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {showFilters && (
          <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label={t('employees.department')}
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">{t('common.all')}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {localized(d.name_en, d.name_ar)}
                </option>
              ))}
            </Select>
            <Select
              label={t('employees.manager')}
              value={managerId}
              onChange={(e) => {
                setManagerId(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">{t('common.all')}</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {localized(m.full_name_en, m.full_name_ar)}
                </option>
              ))}
            </Select>
            <Select
              label={t('common.gender')}
              value={gender}
              onChange={(e) => {
                setGender(e.target.value as Gender | 'all');
                setPage(1);
              }}
            >
              <option value="all">{t('common.all')}</option>
              <option value="male">{t('common.male')}</option>
              <option value="female">{t('common.female')}</option>
            </Select>
            <Select
              label={t('common.status')}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as EmploymentStatus | 'all');
                setPage(1);
              }}
            >
              <option value="all">{t('common.all')}</option>
              <option value="active">{t('common.active')}</option>
              <option value="inactive">{t('common.inactive')}</option>
            </Select>
            {activeFilterCount > 0 && (
              <div className="sm:col-span-2 lg:col-span-4">
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<X size={14} />}
                  onClick={() => {
                    setDepartmentId('all');
                    setManagerId('all');
                    setGender('all');
                    setStatus('all');
                    setPage(1);
                  }}
                >
                  {t('common.clear')}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {isLoading ? (
        <Card>
          <SkeletonTable />
        </Card>
      ) : isError ? (
        <Card>
          <EmptyState title={t('common.somethingWrong')} />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={data?.rows ?? []}
          rowKey={(row) => row.id}
          emptyState={
            <EmptyState
              icon={<UserPlus size={24} />}
              title={t('employees.noEmployees')}
              description={t('employees.noEmployeesBody')}
              action={
                <PermissionGate permission={PERMISSIONS.employees.create}>
                  <Button
                    leftIcon={<Plus size={16} />}
                    onClick={() => {
                      setEditing(null);
                      setFormOpen(true);
                    }}
                  >
                    {t('employees.newEmployee')}
                  </Button>
                </PermissionGate>
              }
            />
          }
          footer={
            (data?.total ?? 0) > PAGE_SIZE ? (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={data?.total ?? 0}
                onPageChange={setPage}
              />
            ) : undefined
          }
        />
      )}

      <EmployeeFormModal
        open={formOpen}
        employee={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t('employees.deleteConfirm', { name: pendingDelete?.full_name_en ?? '' })}
        description={t('employees.deleteConfirmBody')}
        confirmLabel={t('common.delete')}
        loading={removeMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && removeMutation.mutate(pendingDelete)}
      />
    </>
  );
}
