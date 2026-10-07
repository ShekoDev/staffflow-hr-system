import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, UserMinus, UserPlus, UsersRound } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useToast } from '@/providers/ToastProvider';
import { useDepartments, useEmployeeOptions, useTeams } from '@/hooks/useOrganization';
import { PERMISSIONS } from '@/lib/permissions';
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  fetchTeamMembers,
  removeTeamMember,
  updateTeam,
  type TeamInput,
} from '@/services/teams.service';
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
import type { Team } from '@/types/models';

const EMPTY: TeamInput = {
  name_en: '',
  name_ar: '',
  department_id: null,
  manager_id: null,
  description: '',
  is_active: true,
};

export function TeamsPage() {
  const { t, localized } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: teams = [], isLoading } = useTeams();
  const { data: departments = [] } = useDepartments();
  const { data: employees = [] } = useEmployeeOptions();

  const [editing, setEditing] = useState<Team | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TeamInput>(EMPTY);
  const [pendingDelete, setPendingDelete] = useState<Team | null>(null);
  const [membersOf, setMembersOf] = useState<Team | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      editing
        ? {
            name_en: editing.name_en,
            name_ar: editing.name_ar ?? '',
            department_id: editing.department_id,
            manager_id: editing.manager_id,
            description: editing.description ?? '',
            is_active: editing.is_active,
          }
        : EMPTY,
    );
  }, [open, editing]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: TeamInput = {
        ...form,
        name_ar: form.name_ar || null,
        description: form.description || null,
      };
      return editing ? updateTeam(editing.id, payload) : createTeam(payload);
    },
    onSuccess: () => {
      toast.success(editing ? t('teams.updated') : t('teams.created'));
      void queryClient.invalidateQueries({ queryKey: ['teams'] });
      setOpen(false);
      setEditing(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (team: Team) => deleteTeam(team.id, team.name_en),
    onSuccess: () => {
      toast.success(t('teams.deleted'));
      void queryClient.invalidateQueries({ queryKey: ['teams'] });
      setPendingDelete(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  return (
    <>
      <PageHeader
        title={t('teams.title')}
        subtitle={t('teams.subtitle')}
        actions={
          <PermissionGate permission={PERMISSIONS.organization.teams}>
            <Button
              leftIcon={<Plus size={16} />}
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              {t('teams.newTeam')}
            </Button>
          </PermissionGate>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-4 h-9 w-full" />
            </Card>
          ))}
        </div>
      ) : teams.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<UsersRound size={24} />}
            title={t('teams.noTeams')}
            description={t('teams.noTeamsBody')}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <Card key={team.id} className="animate-fade-up">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-content">
                    {localized(team.name_en, team.name_ar)}
                  </h3>
                  <p className="mt-0.5 text-xs text-content-muted">
                    {localized(team.department?.name_en, team.department?.name_ar) ||
                      t('common.notAssigned')}
                  </p>
                </div>
                <PermissionGate permission={PERMISSIONS.organization.teams}>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t('common.edit')}
                      onClick={() => {
                        setEditing(team);
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
                      onClick={() => setPendingDelete(team)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </PermissionGate>
              </div>

              <div className="mt-4 border-t border-line pt-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-content-muted">
                  {t('teams.manager')}
                </p>
                {team.manager ? (
                  <EmployeeIdentity employee={team.manager} size="xs" />
                ) : (
                  <p className="text-sm text-content-muted">{t('common.notAssigned')}</p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <Pill tone="primary">
                  {team.member_count ?? 0} {t('teams.members')}
                </Pill>
                <Button size="sm" variant="secondary" onClick={() => setMembersOf(team)}>
                  {t('teams.manageMembers')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t('teams.editTeam') : t('teams.newTeam')}
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
            label={t('teams.nameEn')}
            value={form.name_en}
            onChange={(e) => setForm({ ...form, name_en: e.target.value })}
            required
          />
          <Input
            label={t('teams.nameAr')}
            value={form.name_ar ?? ''}
            onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
            dir="rtl"
          />
          <Select
            label={t('teams.department')}
            value={form.department_id ?? ''}
            onChange={(e) => setForm({ ...form, department_id: e.target.value || null })}
          >
            <option value="">{t('common.notAssigned')}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {localized(d.name_en, d.name_ar)}
              </option>
            ))}
          </Select>
          <Select
            label={t('teams.manager')}
            value={form.manager_id ?? ''}
            onChange={(e) => setForm({ ...form, manager_id: e.target.value || null })}
          >
            <option value="">{t('common.notAssigned')}</option>
            {employees.map((m) => (
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

      <TeamMembersModal team={membersOf} onClose={() => setMembersOf(null)} />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`${t('common.delete')} — ${pendingDelete ? localized(pendingDelete.name_en, pendingDelete.name_ar) : ''}`}
        description={t('departments.deleteConfirmBody')}
        confirmLabel={t('common.delete')}
        loading={removeMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && removeMutation.mutate(pendingDelete)}
      />
    </>
  );
}

function TeamMembersModal({ team, onClose }: { team: Team | null; onClose: () => void }) {
  const { t, localized } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState('');

  const { data: members = [], refetch } = useQuery({
    queryKey: ['team-members', team?.id],
    queryFn: () => fetchTeamMembers(team?.id as string),
    enabled: Boolean(team?.id),
  });

  const { data: employees = [] } = useEmployeeOptions();
  const memberIds = new Set(members.map((m) => m.id));
  const candidates = employees.filter((e) => !memberIds.has(e.id));

  const refresh = () => {
    void refetch();
    void queryClient.invalidateQueries({ queryKey: ['teams'] });
  };

  const addMutation = useMutation({
    mutationFn: (employeeId: string) => addTeamMember(team?.id as string, employeeId),
    onSuccess: () => {
      toast.success(t('teams.memberAdded'));
      setSelected('');
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (employeeId: string) => removeTeamMember(team?.id as string, employeeId),
    onSuccess: () => {
      toast.success(t('teams.memberRemoved'));
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  return (
    <Modal
      open={Boolean(team)}
      onClose={onClose}
      title={team ? localized(team.name_en, team.name_ar) : ''}
      description={t('teams.manageMembers')}
    >
      <PermissionGate permission={PERMISSIONS.organization.teams}>
        <div className="mb-5 flex items-end gap-2">
          <Select
            label={t('teams.addMember')}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            wrapperClassName="flex-1"
          >
            <option value="">{t('common.select')}</option>
            {candidates.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {localized(employee.full_name_en, employee.full_name_ar)} — {employee.employee_code}
              </option>
            ))}
          </Select>
          <Button
            leftIcon={<UserPlus size={15} />}
            disabled={!selected}
            loading={addMutation.isPending}
            onClick={() => selected && addMutation.mutate(selected)}
          >
            {t('common.add')}
          </Button>
        </div>
      </PermissionGate>

      {members.length === 0 ? (
        <EmptyState title={t('teams.noTeams')} />
      ) : (
        <ul className="divide-y divide-line">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 py-2.5">
              <EmployeeIdentity employee={member} subtitle={member.job_title} size="xs" />
              <PermissionGate permission={PERMISSIONS.organization.teams}>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-danger"
                  aria-label={t('common.delete')}
                  onClick={() => removeMutation.mutate(member.id)}
                >
                  <UserMinus size={15} />
                </Button>
              </PermissionGate>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
