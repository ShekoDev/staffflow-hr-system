import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';
import { useI18n } from '@/i18n';
import { PERMISSIONS } from '@/lib/permissions';
import { AppLayout } from '@/components/layout/AppLayout';
import { FullPageSpinner } from '@/components/ui/Spinner';

import { LoginPage } from '@/features/auth/LoginPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { ChangePasswordPage, ResetPasswordPage } from '@/features/auth/ChangePasswordPage';
import { DashboardPage } from '@/features/dashboard';
import { EmployeesPage } from '@/features/employees/EmployeesPage';
import { EmployeeProfilePage } from '@/features/employees/EmployeeProfilePage';
import { ManagersPage } from '@/features/employees/ManagersPage';
import { DepartmentsPage } from '@/features/departments/DepartmentsPage';
import { TeamsPage } from '@/features/teams/TeamsPage';
import { UsersPermissionsPage } from '@/features/users/UsersPermissionsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { RankingPage } from '@/features/ranking/RankingPage';
import { AuditLogsPage } from '@/features/audit/AuditLogsPage';
import { DailyAttendancePage } from '@/features/attendance/DailyAttendancePage';
import { AttendanceCalendarPage } from '@/features/attendance/AttendanceCalendar';
import { AbsencePage } from '@/features/attendance/AbsencePage';
import { LeavesPage } from '@/features/attendance/LeavesPage';
import { EvaluationCriteriaPage } from '@/features/evaluations/EvaluationCriteriaPage';
import { EvaluationSettingsPage } from '@/features/evaluations/EvaluationSettingsPage';
import { TeamEvaluationsPage } from '@/features/evaluations/TeamEvaluationsPage';
import { MyEvaluationPage } from '@/features/evaluations/MyEvaluationPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { CustomizationPage } from '@/features/customization/CustomizationPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { ForbiddenPage, NotFoundPage } from '@/features/errors/ErrorPages';
import type { ReactElement } from 'react';

/** Blocks a route unless the user holds one of the listed permissions. */
function Guard({ anyOf, children }: { anyOf?: string[]; children: ReactElement }) {
  const { canAny } = useAuth();
  if (anyOf && anyOf.length > 0 && !canAny(anyOf)) return <ForbiddenPage />;
  return children;
}

const EMPLOYEE_VIEW = [PERMISSIONS.employees.viewAll, PERMISSIONS.employees.viewTeam];
const ATTENDANCE_VIEW = [PERMISSIONS.attendance.viewAll, PERMISSIONS.attendance.viewTeam];
const LEAVE_VIEW = [
  PERMISSIONS.leaves.viewAll,
  PERMISSIONS.leaves.viewTeam,
  PERMISSIONS.leaves.manage,
];
const EVALUATION_VIEW = [
  PERMISSIONS.evaluations.viewAll,
  PERMISSIONS.evaluations.viewTeam,
  PERMISSIONS.evaluations.evaluateTeam,
];
const REPORTS = [
  PERMISSIONS.reports.employee,
  PERMISSIONS.reports.team,
  PERMISSIONS.reports.department,
  PERMISSIONS.reports.company,
  PERMISSIONS.attendance.export,
  PERMISSIONS.employees.export,
  PERMISSIONS.evaluations.export,
];

export function AppRoutes() {
  const { status } = useAuth();
  const { t } = useI18n();

  if (status === 'loading') return <FullPageSpinner label={t('common.loading')} />;

  if (status !== 'authenticated') {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />

        {/* ---------------- Employees & organization ---------------- */}
        <Route
          path="employees"
          element={
            <Guard anyOf={EMPLOYEE_VIEW}>
              <EmployeesPage />
            </Guard>
          }
        />
        <Route path="employees/:id" element={<EmployeeProfilePage />} />
        <Route path="my-profile" element={<EmployeeProfilePage selfView />} />
        <Route
          path="departments"
          element={
            <Guard anyOf={[PERMISSIONS.organization.departments, ...EMPLOYEE_VIEW]}>
              <DepartmentsPage />
            </Guard>
          }
        />
        <Route
          path="teams"
          element={
            <Guard anyOf={[PERMISSIONS.organization.teams, ...EMPLOYEE_VIEW]}>
              <TeamsPage />
            </Guard>
          }
        />
        <Route
          path="managers"
          element={
            <Guard anyOf={EMPLOYEE_VIEW}>
              <ManagersPage />
            </Guard>
          }
        />

        {/* ---------------- Attendance ---------------- */}
        <Route
          path="attendance"
          element={
            <Guard anyOf={ATTENDANCE_VIEW}>
              <DailyAttendancePage />
            </Guard>
          }
        />
        <Route
          path="attendance/calendar"
          element={
            <Guard anyOf={ATTENDANCE_VIEW}>
              <AttendanceCalendarPage />
            </Guard>
          }
        />
        <Route
          path="attendance/absence"
          element={
            <Guard anyOf={ATTENDANCE_VIEW}>
              <AbsencePage />
            </Guard>
          }
        />
        <Route
          path="attendance/leaves"
          element={
            <Guard anyOf={LEAVE_VIEW}>
              <LeavesPage />
            </Guard>
          }
        />
        {/* Every employee can see their own month, with no extra permission. */}
        <Route path="my-attendance" element={<AttendanceCalendarPage selfOnly />} />

        {/* ---------------- Evaluations ---------------- */}
        <Route path="evaluations/mine" element={<MyEvaluationPage />} />
        <Route
          path="evaluations/team"
          element={
            <Guard anyOf={EVALUATION_VIEW}>
              <TeamEvaluationsPage />
            </Guard>
          }
        />
        <Route
          path="evaluations/criteria"
          element={
            <Guard anyOf={[PERMISSIONS.evaluations.configure]}>
              <EvaluationCriteriaPage />
            </Guard>
          }
        />
        <Route
          path="evaluations/settings"
          element={
            <Guard anyOf={[PERMISSIONS.evaluations.configure]}>
              <EvaluationSettingsPage />
            </Guard>
          }
        />

        {/* ---------------- Ranking ---------------- */}
        <Route
          path="ranking"
          element={
            <Guard anyOf={[PERMISSIONS.ranking.view]}>
              <RankingPage />
            </Guard>
          }
        />
        <Route
          path="ranking/employee-of-the-month"
          element={
            <Guard anyOf={[PERMISSIONS.ranking.view]}>
              <RankingPage employeeOfMonthOnly />
            </Guard>
          }
        />

        {/* ---------------- Reports ---------------- */}
        <Route
          path="reports/attendance"
          element={
            <Guard anyOf={REPORTS}>
              <ReportsPage kind="attendance" />
            </Guard>
          }
        />
        <Route
          path="reports/employees"
          element={
            <Guard anyOf={REPORTS}>
              <ReportsPage kind="employees" />
            </Guard>
          }
        />
        <Route
          path="reports/evaluations"
          element={
            <Guard anyOf={REPORTS}>
              <ReportsPage kind="evaluations" />
            </Guard>
          }
        />

        {/* ---------------- Customization ---------------- */}
        <Route
          path="customization/themes"
          element={
            <Guard anyOf={[PERMISSIONS.customization.manage]}>
              <CustomizationPage tab="themes" />
            </Guard>
          }
        />
        <Route
          path="customization/frames"
          element={
            <Guard anyOf={[PERMISSIONS.customization.manage]}>
              <CustomizationPage tab="frames" />
            </Guard>
          }
        />
        <Route
          path="customization/badges"
          element={
            <Guard anyOf={[PERMISSIONS.customization.manage]}>
              <CustomizationPage tab="badges" />
            </Guard>
          }
        />
        <Route
          path="customization/colors"
          element={
            <Guard anyOf={[PERMISSIONS.customization.manage]}>
              <CustomizationPage tab="colors" />
            </Guard>
          }
        />

        {/* ---------------- Administration ---------------- */}
        <Route
          path="users"
          element={
            <Guard anyOf={[PERMISSIONS.users.view, PERMISSIONS.users.manage]}>
              <UsersPermissionsPage />
            </Guard>
          }
        />
        <Route
          path="settings"
          element={
            <Guard anyOf={[PERMISSIONS.settings.manage]}>
              <SettingsPage />
            </Guard>
          }
        />
        <Route
          path="audit-logs"
          element={
            <Guard anyOf={[PERMISSIONS.audit.view]}>
              <AuditLogsPage />
            </Guard>
          }
        />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="change-password" element={<ChangePasswordPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
