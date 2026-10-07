import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plane, Plus, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { useEmployeeOptions } from '@/hooks/useOrganization';
import { PERMISSIONS } from '@/lib/permissions';
import {
  cancelLeaveRequest,
  createLeaveRequest,
  fetchLeaveRequests,
  fetchLeaveTypes,
  reviewLeaveRequest,
  type LeaveInput,
} from '@/services/leaves.service';
import { PageHeader } from '@/components/common/PageHeader';
import { EmployeeIdentity } from '@/components/common/EmployeeIdentity';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { DataTable, type Column } from '@/components/ui/Table';
import { Pill, type BadgeTone } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/format';
import type { LeaveRequest, LeaveStatus } from '@/types/models';

const STATUS_TONE: Record<LeaveStatus, BadgeTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
};

export function LeavesPage() {
  const { t, localized, language } = useI18n();
  const { can, profile } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<LeaveStatus | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [reviewing, setReviewing] = useState<LeaveRequest | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['leaves', status],
    queryFn: () => fetchLeaveRequests({ status }),
  });

  const canReview =
    can(PERMISSIONS.leaves.manage) || can(PERMISSIONS.leaves.approveTeam);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['leaves'] });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelLeaveRequest(id),
    onSuccess: () => {
      toast.success(t('leaves.reviewed'));
      void invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const statusLabel = (value: LeaveStatus) =>
    ({
      pending: t('leaves.pending'),
      approved: t('leaves.approved'),
      rejected: t('leaves.rejected'),
      cancelled: t('leaves.cancelled'),
    })[value];

  const columns: Column<LeaveRequest>[] = [
    {
      key: 'employee',
      header: t('leaves.requestedBy'),
      render: (row) => <EmployeeIdentity employee={row.employee} size="xs" />,
    },
    {
      key: 'type',
      header: t('leaves.leaveType'),
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm text-content-muted">
          {localized(row.leave_type?.name_en, row.leave_type?.name_ar) || '—'}
        </span>
      ),
    },
    {
      key: 'range',
      header: t('reports.dateRange'),
      render: (row) => (
        <span className="text-sm text-content">
          {formatDate(row.start_date, language)} → {formatDate(row.end_date, language)}
        </span>
      ),
    },
    {
      key: 'days',
      header: t('leaves.days'),
      render: (row) => <Pill tone="primary">{row.days_count}</Pill>,
    },
    {
      key: 'reason',
      header: t('leaves.reason'),
      hideOnMobile: true,
      render: (row) => <span className="text-xs text-content-muted">{row.reason || '—'}</span>,
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <Pill tone={STATUS_TONE[row.status]}>{statusLabel(row.status)}</Pill>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-end',
      render: (row) => {
        if (row.status !== 'pending') return null;
        const isOwn = row.employee_id === profile?.employee?.id;
        return (
          <div className="flex items-center justify-end gap-1">
            {canReview && (
              <Button size="sm" variant="secondary" onClick={() => setReviewing(row)}>
                {t('common.actions')}
              </Button>
            )}
            {isOwn && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => cancelMutation.mutate(row.id)}
                loading={cancelMutation.isPending}
              >
                {t('common.cancel')}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={t('leaves.title')}
        subtitle={t('leaves.subtitle')}
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => setFormOpen(true)}>
            {t('leaves.newRequest')}
          </Button>
        }
      />

      <Tabs
        className="mb-4 max-w-xl"
        value={status}
        onChange={(key) => setStatus(key as LeaveStatus | 'all')}
        items={[
          { key: 'all', label: t('common.all') },
          { key: 'pending', label: t('leaves.pending') },
          { key: 'approved', label: t('leaves.approved') },
          { key: 'rejected', label: t('leaves.rejected') },
        ]}
      />

      {isLoading ? (
        <Card>
          <SkeletonTable />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={requests}
          rowKey={(row) => row.id}
          emptyState={
            <EmptyState
              icon={<Plane size={24} />}
              title={t('leaves.noLeaves')}
              description={t('leaves.noLeavesBody')}
            />
          }
        />
      )}

      <LeaveFormModal open={formOpen} onClose={() => setFormOpen(false)} />
      <ReviewModal request={reviewing} onClose={() => setReviewing(null)} />
    </>
  );
}

function LeaveFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, localized } = useI18n();
  const { can, profile } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: types = [] } = useQuery({ queryKey: ['leave-types'], queryFn: fetchLeaveTypes });
  const { data: employees = [] } = useEmployeeOptions();
  const canPickEmployee = can(PERMISSIONS.leaves.manage);

  const [form, setForm] = useState<LeaveInput>({
    employee_id: profile?.employee?.id ?? '',
    leave_type_id: null,
    start_date: '',
    end_date: '',
    reason: '',
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      if (!form.employee_id) throw new Error(t('common.required'));
      if (!form.start_date || !form.end_date) throw new Error(t('common.required'));
      if (form.end_date < form.start_date) throw new Error(t('leaves.invalidRange'));
      return createLeaveRequest({ ...form, reason: form.reason || null });
    },
    onSuccess: () => {
      toast.success(t('leaves.submitted'));
      void queryClient.invalidateQueries({ queryKey: ['leaves'] });
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('leaves.newRequest')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {canPickEmployee && (
          <Select
            label={t('leaves.requestedBy')}
            value={form.employee_id}
            onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
            wrapperClassName="sm:col-span-2"
          >
            <option value="">{t('common.select')}</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {localized(employee.full_name_en, employee.full_name_ar)}
              </option>
            ))}
          </Select>
        )}
        <Select
          label={t('leaves.leaveType')}
          value={form.leave_type_id ?? ''}
          onChange={(e) => setForm({ ...form, leave_type_id: e.target.value || null })}
          wrapperClassName="sm:col-span-2"
        >
          <option value="">{t('common.select')}</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {localized(type.name_en, type.name_ar)} —{' '}
              {type.is_paid ? t('leaves.paid') : t('leaves.unpaid')}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          label={t('leaves.startDate')}
          value={form.start_date}
          onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          required
        />
        <Input
          type="date"
          label={t('leaves.endDate')}
          value={form.end_date}
          onChange={(e) => setForm({ ...form, end_date: e.target.value })}
          required
        />
        <Textarea
          label={t('leaves.reason')}
          value={form.reason ?? ''}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          wrapperClassName="sm:col-span-2"
        />
        {error && (
          <p className="rounded-theme-sm border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger sm:col-span-2">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function ReviewModal({
  request,
  onClose,
}: {
  request: LeaveRequest | null;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') =>
      reviewLeaveRequest(request?.id as string, decision, note || null),
    onSuccess: () => {
      toast.success(t('leaves.reviewed'));
      void queryClient.invalidateQueries({ queryKey: ['leaves'] });
      setNote('');
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  return (
    <Modal
      open={Boolean(request)}
      onClose={onClose}
      size="sm"
      title={t('leaves.title')}
      description={
        request
          ? `${formatDate(request.start_date, language)} → ${formatDate(request.end_date, language)} · ${request.days_count} ${t('leaves.days')}`
          : ''
      }
      footer={
        <>
          <Button
            variant="danger"
            leftIcon={<X size={15} />}
            loading={mutation.isPending}
            onClick={() => mutation.mutate('rejected')}
          >
            {t('leaves.reject')}
          </Button>
          <Button
            leftIcon={<Check size={15} />}
            loading={mutation.isPending}
            onClick={() => mutation.mutate('approved')}
          >
            {t('leaves.approve')}
          </Button>
        </>
      }
    >
      {request?.reason && (
        <p className="mb-4 rounded-theme-sm bg-surface-alt p-3 text-sm text-content-muted">
          {request.reason}
        </p>
      )}
      <Textarea
        label={t('leaves.reviewNote')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
    </Modal>
  );
}
