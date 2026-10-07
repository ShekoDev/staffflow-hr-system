import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n';
import { useToast } from '@/providers/ToastProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useDepartments, useEmployeeOptions, useRoles } from '@/hooks/useOrganization';
import { useFrames } from '@/hooks/useCustomization';
import {
  createEmployee,
  suggestEmployeeCode,
  updateEmployee,
  type EmployeeInput,
} from '@/services/employees.service';
import { provisionAccount } from '@/services/auth.service';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Switch, Textarea } from '@/components/ui/Field';
import type { Employee, Gender } from '@/types/models';

const EMPTY: EmployeeInput = {
  employee_code: '',
  full_name_en: '',
  full_name_ar: '',
  photo_url: '',
  email: '',
  phone: '',
  job_title: '',
  department_id: null,
  manager_id: null,
  gender: null,
  joining_date: '',
  employment_status: 'active',
  frame_id: null,
  name_color: null,
  notes: '',
};

export function EmployeeFormModal({
  open,
  employee,
  onClose,
}: {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
}) {
  const { t, localized } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const { data: departments = [] } = useDepartments();
  const { data: managers = [] } = useEmployeeOptions();
  const { data: frames = [] } = useFrames();
  const { data: roles = [] } = useRoles();

  const [form, setForm] = useState<EmployeeInput>(EMPTY);
  const [withLogin, setWithLogin] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [roleKey, setRoleKey] = useState('employee');
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(employee);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setWithLogin(false);
    setLoginPassword('');
    setRoleKey('employee');

    if (employee) {
      setForm({
        employee_code: employee.employee_code,
        full_name_en: employee.full_name_en,
        full_name_ar: employee.full_name_ar ?? '',
        photo_url: employee.photo_url ?? '',
        email: employee.email ?? '',
        phone: employee.phone ?? '',
        job_title: employee.job_title ?? '',
        department_id: employee.department_id,
        manager_id: employee.manager_id,
        gender: employee.gender,
        joining_date: employee.joining_date ?? '',
        employment_status: employee.employment_status,
        frame_id: employee.frame_id,
        name_color: employee.name_color,
        notes: employee.notes ?? '',
      });
    } else {
      setForm(EMPTY);
      void suggestEmployeeCode().then((code) =>
        setForm((current) => ({ ...current, employee_code: code })),
      );
    }
  }, [open, employee]);

  const managerOptions = useMemo(
    () => managers.filter((m) => m.id !== employee?.id),
    [managers, employee?.id],
  );

  const set = <K extends keyof EmployeeInput>(key: K, value: EmployeeInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: EmployeeInput = {
        ...form,
        full_name_ar: form.full_name_ar || null,
        photo_url: form.photo_url || null,
        email: form.email || null,
        phone: form.phone || null,
        job_title: form.job_title || null,
        joining_date: form.joining_date || null,
        notes: form.notes || null,
        name_color: form.name_color || null,
      };

      if (isEdit && employee) {
        return updateEmployee(employee.id, payload);
      }

      if (withLogin) {
        if (!payload.email) throw new Error(t('auth.email'));
        if (loginPassword.length < 8) throw new Error(t('auth.passwordTooShort'));
        const userId = await provisionAccount({
          email: payload.email,
          password: loginPassword,
          username: payload.email.split('@')[0],
          roleKey,
        });
        payload.user_id = userId;
      }

      return createEmployee(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? t('employees.updated') : t('employees.created'));
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      void queryClient.invalidateQueries({ queryKey: ['employee-options'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? t('employees.editEmployee') : t('employees.newEmployee')}
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
      <div className="space-y-6">
        <Section title={t('employees.personalInfo')}>
          <Input
            label={t('employees.fullNameEn')}
            value={form.full_name_en}
            onChange={(e) => set('full_name_en', e.target.value)}
            required
          />
          <Input
            label={t('employees.fullNameAr')}
            value={form.full_name_ar ?? ''}
            onChange={(e) => set('full_name_ar', e.target.value)}
            dir="rtl"
          />
          <Input
            label={t('employees.employeeId')}
            value={form.employee_code}
            onChange={(e) => set('employee_code', e.target.value)}
            required
          />
          <Select
            label={t('common.gender')}
            value={form.gender ?? ''}
            onChange={(e) => set('gender', (e.target.value || null) as Gender | null)}
          >
            <option value="">{t('common.select')}</option>
            <option value="male">{t('common.male')}</option>
            <option value="female">{t('common.female')}</option>
          </Select>
          <Input
            type="email"
            label={t('auth.email')}
            value={form.email ?? ''}
            onChange={(e) => set('email', e.target.value)}
          />
          <Input
            label={t('employees.phone')}
            value={form.phone ?? ''}
            onChange={(e) => set('phone', e.target.value)}
            dir="ltr"
          />
          <Input
            label={t('employees.photoUrl')}
            value={form.photo_url ?? ''}
            onChange={(e) => set('photo_url', e.target.value)}
            placeholder="https://…"
            dir="ltr"
            wrapperClassName="sm:col-span-2"
          />
        </Section>

        <Section title={t('employees.workInfo')}>
          <Input
            label={t('employees.jobTitle')}
            value={form.job_title ?? ''}
            onChange={(e) => set('job_title', e.target.value)}
          />
          <Select
            label={t('employees.department')}
            value={form.department_id ?? ''}
            onChange={(e) => set('department_id', e.target.value || null)}
          >
            <option value="">{t('common.notAssigned')}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {localized(d.name_en, d.name_ar)}
              </option>
            ))}
          </Select>
          <Select
            label={t('employees.manager')}
            value={form.manager_id ?? ''}
            onChange={(e) => set('manager_id', e.target.value || null)}
          >
            <option value="">{t('common.notAssigned')}</option>
            {managerOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {localized(m.full_name_en, m.full_name_ar)} — {m.employee_code}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            label={t('employees.joiningDate')}
            value={form.joining_date ?? ''}
            onChange={(e) => set('joining_date', e.target.value)}
          />
          <Select
            label={t('employees.employmentStatus')}
            value={form.employment_status}
            onChange={(e) => set('employment_status', e.target.value as 'active' | 'inactive')}
          >
            <option value="active">{t('common.active')}</option>
            <option value="inactive">{t('common.inactive')}</option>
          </Select>
          <Select
            label={t('employees.frame')}
            value={form.frame_id ?? ''}
            onChange={(e) => set('frame_id', e.target.value || null)}
          >
            <option value="">{t('employees.autoColor')}</option>
            {frames.map((frame) => (
              <option key={frame.id} value={frame.id}>
                {localized(frame.name_en, frame.name_ar)}
              </option>
            ))}
          </Select>
          <Input
            label={t('employees.nameColor')}
            value={form.name_color ?? ''}
            onChange={(e) => set('name_color', e.target.value)}
            placeholder="#d97706"
            hint={t('employees.autoColor')}
            dir="ltr"
          />
          <Textarea
            label={t('common.notes')}
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
            wrapperClassName="sm:col-span-2"
          />
        </Section>

        {!isEdit && isAdmin && (
          <Section title={t('employees.accountInfo')}>
            <div className="sm:col-span-2">
              <Switch
                checked={withLogin}
                onChange={setWithLogin}
                label={t('employees.createLogin')}
                description={t('employees.createLoginHint')}
              />
            </div>
            {withLogin && (
              <>
                <Input
                  type="password"
                  label={t('auth.password')}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  hint={t('auth.passwordTooShort')}
                  autoComplete="new-password"
                />
                <Select
                  label={t('employees.role')}
                  value={roleKey}
                  onChange={(e) => setRoleKey(e.target.value)}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.key}>
                      {localized(role.name_en, role.name_ar)}
                    </option>
                  ))}
                </Select>
              </>
            )}
          </Section>
        )}

        {error && (
          <p className="rounded-theme-sm border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-content-muted">{title}</h4>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
