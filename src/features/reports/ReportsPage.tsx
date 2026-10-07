import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, FileText, TableProperties } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { useToast } from '@/providers/ToastProvider';
import { useDepartments, useTeams } from '@/hooks/useOrganization';
import { fetchAttendance, summarise, type AttendanceQuery } from '@/services/attendance.service';
import { fetchEmployees } from '@/services/employees.service';
import { fetchEvaluations } from '@/services/evaluations.service';
import { exportExcel, exportPdf, type ExportPayload } from '@/services/export.service';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar, currentMonthRange } from '@/components/common/FilterBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { formatDate, formatPercent, monthName } from '@/lib/format';
import type { AttendanceStatus, EvaluationStatus } from '@/types/models';

export type ReportKind = 'attendance' | 'employees' | 'evaluations';

interface Dataset {
  head: string[];
  body: (string | number)[][];
  summary: { label: string; value: string }[];
}

export function ReportsPage({ kind }: { kind: ReportKind }) {
  const { t, localized, language } = useI18n();
  const { profile } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();

  const now = new Date();
  const [filters, setFilters] = useState<AttendanceQuery>(() => currentMonthRange());
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null);

  const { data: departments = [] } = useDepartments();
  const { data: teams = [] } = useTeams();

  /* ---------------- data ---------------- */

  const attendanceQuery = useQuery({
    queryKey: ['report-attendance', filters],
    queryFn: () => fetchAttendance(filters),
    enabled: kind === 'attendance',
  });

  const employeesQuery = useQuery({
    queryKey: ['report-employees', filters],
    queryFn: () =>
      fetchEmployees({
        pageSize: 500,
        departmentId: filters.departmentId,
        managerId: filters.managerId,
        gender: filters.gender,
        status: 'all',
      }),
    enabled: kind === 'employees',
  });

  const evaluationsQuery = useQuery({
    queryKey: ['report-evaluations', year, month],
    queryFn: () => fetchEvaluations({ year, month }),
    enabled: kind === 'evaluations',
  });

  const isLoading =
    attendanceQuery.isLoading || employeesQuery.isLoading || evaluationsQuery.isLoading;

  const statusLabel = (status: AttendanceStatus) =>
    ({
      present: t('attendance.present'),
      absent: t('attendance.absent'),
      late: t('attendance.late'),
      leave: t('attendance.leave'),
      holiday: t('attendance.holiday'),
      excused: t('attendance.excused'),
      early_leave: t('attendance.earlyLeave'),
    })[status];

  const evaluationStatusLabel = (status: EvaluationStatus) =>
    ({
      draft: t('evaluations.draft'),
      submitted: t('evaluations.statusSubmitted'),
      approved: t('evaluations.statusApproved'),
      rejected: t('evaluations.statusRejected'),
    })[status];

  /* ---------------- dataset ---------------- */

  const dataset = useMemo<Dataset>(() => {
    if (kind === 'attendance') {
      const records = attendanceQuery.data ?? [];
      const stats = summarise(records);
      return {
        head: [
          t('employees.title'),
          t('employees.employeeId'),
          t('employees.department'),
          t('common.date'),
          t('common.status'),
          t('attendance.checkIn'),
          t('attendance.checkOut'),
          t('attendance.lateMinutes'),
          t('common.notes'),
        ],
        body: records.map((record) => [
          localized(record.employee?.full_name_en, record.employee?.full_name_ar),
          record.employee?.employee_code ?? '',
          localized(record.employee?.department?.name_en, record.employee?.department?.name_ar),
          record.work_date,
          statusLabel(record.status),
          record.check_in?.slice(0, 5) ?? '—',
          record.check_out?.slice(0, 5) ?? '—',
          record.late_minutes ?? 0,
          record.notes ?? '',
        ]),
        summary: [
          { label: t('attendance.present'), value: String(stats.present) },
          { label: t('attendance.absent'), value: String(stats.absent) },
          { label: t('attendance.late'), value: String(stats.late) },
          { label: t('attendance.leave'), value: String(stats.leave) },
          { label: t('attendance.attendanceRate'), value: formatPercent(stats.attendanceRate, language) },
          { label: t('attendance.punctualityRate'), value: formatPercent(stats.punctualityRate, language) },
          { label: t('attendance.totalLateMinutes'), value: String(stats.lateMinutes) },
          { label: t('reports.rowCount'), value: String(stats.total) },
        ],
      };
    }

    if (kind === 'employees') {
      const rows = employeesQuery.data?.rows ?? [];
      const active = rows.filter((row) => row.employment_status === 'active').length;
      return {
        head: [
          t('employees.employeeId'),
          t('employees.title'),
          t('employees.jobTitle'),
          t('employees.department'),
          t('employees.manager'),
          t('common.gender'),
          t('employees.joiningDate'),
          t('common.status'),
          t('employees.phone'),
          t('auth.email'),
        ],
        body: rows.map((row) => [
          row.employee_code,
          localized(row.full_name_en, row.full_name_ar),
          row.job_title ?? '',
          localized(row.department?.name_en, row.department?.name_ar),
          localized(row.manager?.full_name_en, row.manager?.full_name_ar),
          row.gender ? (row.gender === 'male' ? t('common.male') : t('common.female')) : '',
          row.joining_date ?? '',
          row.employment_status === 'active' ? t('common.active') : t('common.inactive'),
          row.phone ?? '',
          row.email ?? '',
        ]),
        summary: [
          { label: t('reports.employeeCount'), value: String(rows.length) },
          { label: t('common.active'), value: String(active) },
          {
            label: t('common.male'),
            value: String(rows.filter((row) => row.gender === 'male').length),
          },
          {
            label: t('common.female'),
            value: String(rows.filter((row) => row.gender === 'female').length),
          },
        ],
      };
    }

    const evaluations = evaluationsQuery.data ?? [];
    const scored = evaluations.filter((row) => row.percentage != null);
    const average = scored.length
      ? scored.reduce((sum, row) => sum + Number(row.percentage), 0) / scored.length
      : 0;

    return {
      head: [
        t('employees.title'),
        t('employees.employeeId'),
        t('employees.department'),
        t('evaluations.stage'),
        t('evaluations.period'),
        t('evaluations.score'),
        t('common.status'),
        t('evaluations.comments'),
      ],
      body: evaluations.map((row) => [
        localized(row.employee?.full_name_en, row.employee?.full_name_ar),
        row.employee?.employee_code ?? '',
        localized(row.employee?.department?.name_en, row.employee?.department?.name_ar),
        row.stage,
        `${row.period_year}-${String(row.period_month).padStart(2, '0')}`,
        row.percentage != null ? `${row.percentage}%` : '',
        evaluationStatusLabel(row.status),
        row.comments ?? '',
      ]),
      summary: [
        { label: t('reports.rowCount'), value: String(evaluations.length) },
        { label: t('evaluations.finalScore'), value: formatPercent(Math.round(average * 10) / 10, language) },
        {
          label: t('evaluations.statusApproved'),
          value: String(evaluations.filter((row) => row.status === 'approved').length),
        },
        {
          label: t('evaluations.statusSubmitted'),
          value: String(evaluations.filter((row) => row.status === 'submitted').length),
        },
      ],
    };
  }, [kind, attendanceQuery.data, employeesQuery.data, evaluationsQuery.data, t, localized, language]);

  /* ---------------- export ---------------- */

  const title =
    kind === 'attendance'
      ? t('reports.attendanceReport')
      : kind === 'employees'
        ? t('reports.employeeReport')
        : t('reports.evaluationReport');

  const scopeLabel = useMemo(() => {
    if (filters.teamId && filters.teamId !== 'all') {
      const team = teams.find((row) => row.id === filters.teamId);
      return localized(team?.name_en, team?.name_ar);
    }
    if (filters.departmentId && filters.departmentId !== 'all') {
      const department = departments.find((row) => row.id === filters.departmentId);
      return localized(department?.name_en, department?.name_ar);
    }
    return t('reports.allEmployees');
  }, [filters, teams, departments, localized, t]);

  const buildPayload = (): ExportPayload => {
    const generatedBy =
      localized(profile?.employee?.full_name_en, profile?.employee?.full_name_ar) ||
      profile?.user.username ||
      profile?.user.email ||
      '';

    const range =
      kind === 'evaluations'
        ? `${monthName(month, language)} ${year}`
        : `${filters.from ?? ''} - ${filters.to ?? ''}`;

    return {
      language,
      title,
      subtitle: scopeLabel,
      branding: settings.branding,
      pdfBranding: settings.pdf_branding,
      meta: [
        { label: t('reports.reportFor'), value: scopeLabel },
        { label: t('reports.dateRange'), value: range },
        { label: t('reports.rowCount'), value: String(dataset.body.length) },
        { label: t('reports.generatedBy'), value: generatedBy },
        { label: t('reports.generatedOn'), value: formatDate(new Date().toISOString(), language) },
      ],
      table: { head: dataset.head, body: dataset.body },
      summary: dataset.summary,
      generatedBy: `${t('reports.generatedBy')}: ${generatedBy}`,
      fileName: `${title.replace(/\s+/g, '-')}-${range.replace(/[^\w-]+/g, '_')}`,
    };
  };

  const runExport = async (format: 'pdf' | 'excel') => {
    if (dataset.body.length === 0) {
      toast.error(t('reports.noData'));
      return;
    }
    setBusy(format);
    try {
      const payload = buildPayload();
      if (format === 'pdf') await exportPdf(payload);
      else await exportExcel(payload);
      toast.success(t('reports.exported'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title={title}
        subtitle={t('reports.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              leftIcon={<FileText size={16} />}
              loading={busy === 'pdf'}
              onClick={() => void runExport('pdf')}
            >
              {t('common.exportPdf')}
            </Button>
            <Button
              variant="secondary"
              leftIcon={<FileSpreadsheet size={16} />}
              loading={busy === 'excel'}
              onClick={() => void runExport('excel')}
            >
              {t('common.exportExcel')}
            </Button>
          </div>
        }
      />

      {kind === 'evaluations' ? (
        <Card className="mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <Select
              label={t('evaluations.period')}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              wrapperClassName="w-40"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {monthName(m, language)}
                </option>
              ))}
            </Select>
            <Select
              label=" "
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              wrapperClassName="w-32"
            >
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        </Card>
      ) : (
        <FilterBar
          value={filters}
          onChange={setFilters}
          fields={
            kind === 'employees'
              ? ['employee', 'department', 'team', 'manager', 'gender']
              : ['employee', 'department', 'team', 'manager', 'gender', 'status', 'dates']
          }
        />
      )}

      {isLoading ? (
        <Card>
          <SkeletonTable rows={8} cols={6} />
        </Card>
      ) : dataset.body.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<TableProperties size={24} />}
            title={t('reports.noData')}
            description={t('reports.noDataBody')}
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {dataset.summary.slice(0, 4).map((entry) => (
              <div key={entry.label} className="sf-surface p-3">
                <p className="truncate text-[11px] font-bold uppercase tracking-wide text-content-muted">
                  {entry.label}
                </p>
                <p className="mt-1 text-xl font-extrabold text-content">{entry.value}</p>
              </div>
            ))}
          </div>

          <Card padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-alt/70">
                    {dataset.head.map((header) => (
                      <th
                        key={header}
                        className="px-3 py-2.5 text-start text-[11px] font-bold uppercase tracking-wide text-content-muted"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataset.body.slice(0, 100).map((row, index) => (
                    <tr key={index} className="border-b border-line/70 last:border-0">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-2 text-content">
                          {cell === '' ? '—' : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dataset.body.length > 100 && (
              <p className="border-t border-line px-4 py-2.5 text-xs text-content-muted">
                {t('reports.preview')}: 100 / {dataset.body.length} — {t('common.export')}
              </p>
            )}
          </Card>
        </>
      )}
    </>
  );
}
