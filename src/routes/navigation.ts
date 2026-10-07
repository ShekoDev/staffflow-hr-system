import {
  Activity,
  Award,
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Cog,
  FileBarChart,
  LayoutDashboard,
  Palette,
  ShieldCheck,
  Trophy,
  Type,
  UserCog,
  Users,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TranslationKey } from '@/i18n';
import {
  ATTENDANCE_VIEW_PERMISSIONS,
  EMPLOYEE_VIEW_PERMISSIONS,
  EVALUATION_VIEW_PERMISSIONS,
  PERMISSIONS,
  REPORT_PERMISSIONS,
} from '@/lib/permissions';

export interface NavItem {
  id: string;
  labelKey: TranslationKey;
  path?: string;
  icon: LucideIcon;
  /** Visible when the user holds ANY of these. Empty = always visible. */
  anyOf?: string[];
  children?: NavItem[];
}

export const NAVIGATION: NavItem[] = [
  {
    id: 'dashboard',
    labelKey: 'nav.dashboard',
    path: '/',
    icon: LayoutDashboard,
  },
  {
    id: 'employees',
    labelKey: 'nav.employees',
    icon: Users,
    anyOf: [
      ...EMPLOYEE_VIEW_PERMISSIONS,
      PERMISSIONS.organization.departments,
      PERMISSIONS.organization.teams,
    ],
    children: [
      {
        id: 'employees-all',
        labelKey: 'nav.allEmployees',
        path: '/employees',
        icon: Users,
        anyOf: EMPLOYEE_VIEW_PERMISSIONS,
      },
      {
        id: 'departments',
        labelKey: 'nav.departments',
        path: '/departments',
        icon: Building2,
        anyOf: [PERMISSIONS.organization.departments, ...EMPLOYEE_VIEW_PERMISSIONS],
      },
      {
        id: 'teams',
        labelKey: 'nav.teams',
        path: '/teams',
        icon: UsersRound,
        anyOf: [PERMISSIONS.organization.teams, ...EMPLOYEE_VIEW_PERMISSIONS],
      },
      {
        id: 'managers',
        labelKey: 'nav.managers',
        path: '/managers',
        icon: UserCog,
        anyOf: EMPLOYEE_VIEW_PERMISSIONS,
      },
    ],
  },
  {
    id: 'attendance',
    labelKey: 'nav.attendance',
    icon: CalendarCheck,
    anyOf: ATTENDANCE_VIEW_PERMISSIONS,
    children: [
      {
        id: 'attendance-daily',
        labelKey: 'nav.dailyAttendance',
        path: '/attendance',
        icon: CalendarCheck,
        anyOf: ATTENDANCE_VIEW_PERMISSIONS,
      },
      {
        id: 'attendance-calendar',
        labelKey: 'attendance.calendar',
        path: '/attendance/calendar',
        icon: CalendarDays,
        anyOf: ATTENDANCE_VIEW_PERMISSIONS,
      },
      {
        id: 'attendance-absence',
        labelKey: 'nav.absence',
        path: '/attendance/absence',
        icon: Activity,
        anyOf: ATTENDANCE_VIEW_PERMISSIONS,
      },
      {
        id: 'attendance-leaves',
        labelKey: 'nav.leaves',
        path: '/attendance/leaves',
        icon: ClipboardCheck,
        anyOf: [PERMISSIONS.leaves.viewAll, PERMISSIONS.leaves.viewTeam, PERMISSIONS.leaves.manage],
      },
      {
        id: 'attendance-reports',
        labelKey: 'nav.attendanceReports',
        path: '/reports/attendance',
        icon: FileBarChart,
        anyOf: [PERMISSIONS.attendance.export, ...REPORT_PERMISSIONS],
      },
    ],
  },
  {
    id: 'evaluations',
    labelKey: 'nav.evaluations',
    icon: ClipboardCheck,
    anyOf: [...EVALUATION_VIEW_PERMISSIONS, PERMISSIONS.evaluations.self],
    children: [
      {
        id: 'evaluations-mine',
        labelKey: 'nav.myEvaluation',
        path: '/evaluations/mine',
        icon: ClipboardCheck,
      },
      {
        id: 'evaluations-team',
        labelKey: 'nav.teamEvaluations',
        path: '/evaluations/team',
        icon: UsersRound,
        anyOf: EVALUATION_VIEW_PERMISSIONS,
      },
      {
        id: 'evaluations-criteria',
        labelKey: 'nav.evaluationCriteria',
        path: '/evaluations/criteria',
        icon: BarChart3,
        anyOf: [PERMISSIONS.evaluations.configure],
      },
      {
        id: 'evaluations-settings',
        labelKey: 'nav.evaluationSettings',
        path: '/evaluations/settings',
        icon: Cog,
        anyOf: [PERMISSIONS.evaluations.configure],
      },
    ],
  },
  {
    id: 'ranking',
    labelKey: 'nav.ranking',
    icon: Trophy,
    anyOf: [PERMISSIONS.ranking.view],
    children: [
      {
        id: 'ranking-monthly',
        labelKey: 'nav.monthlyRanking',
        path: '/ranking',
        icon: Trophy,
        anyOf: [PERMISSIONS.ranking.view],
      },
      {
        id: 'ranking-eom',
        labelKey: 'nav.employeeOfTheMonth',
        path: '/ranking/employee-of-the-month',
        icon: Award,
        anyOf: [PERMISSIONS.ranking.view],
      },
    ],
  },
  {
    id: 'reports',
    labelKey: 'nav.reports',
    icon: FileBarChart,
    anyOf: REPORT_PERMISSIONS,
    children: [
      {
        id: 'reports-attendance',
        labelKey: 'nav.attendanceReports',
        path: '/reports/attendance',
        icon: CalendarCheck,
        anyOf: REPORT_PERMISSIONS,
      },
      {
        id: 'reports-employees',
        labelKey: 'nav.employeeReports',
        path: '/reports/employees',
        icon: Users,
        anyOf: REPORT_PERMISSIONS,
      },
      {
        id: 'reports-evaluations',
        labelKey: 'nav.evaluationReports',
        path: '/reports/evaluations',
        icon: ClipboardCheck,
        anyOf: REPORT_PERMISSIONS,
      },
    ],
  },
  {
    id: 'users',
    labelKey: 'nav.usersPermissions',
    path: '/users',
    icon: ShieldCheck,
    anyOf: [PERMISSIONS.users.view, PERMISSIONS.users.manage, PERMISSIONS.users.permissions],
  },
  {
    id: 'customization',
    labelKey: 'nav.customization',
    icon: Palette,
    anyOf: [PERMISSIONS.customization.manage, PERMISSIONS.settings.manage],
    children: [
      {
        id: 'settings',
        labelKey: 'nav.systemSettings',
        path: '/settings',
        icon: Cog,
        anyOf: [PERMISSIONS.settings.manage],
      },
      {
        id: 'customization-themes',
        labelKey: 'nav.themes',
        path: '/customization/themes',
        icon: Palette,
        anyOf: [PERMISSIONS.customization.manage],
      },
      {
        id: 'customization-frames',
        labelKey: 'nav.frames',
        path: '/customization/frames',
        icon: Award,
        anyOf: [PERMISSIONS.customization.manage],
      },
      {
        id: 'customization-badges',
        labelKey: 'nav.badges',
        path: '/customization/badges',
        icon: Trophy,
        anyOf: [PERMISSIONS.customization.manage],
      },
      {
        id: 'customization-colors',
        labelKey: 'nav.nameColors',
        path: '/customization/colors',
        icon: Type,
        anyOf: [PERMISSIONS.customization.manage],
      },
    ],
  },
  {
    id: 'audit',
    labelKey: 'nav.auditLogs',
    path: '/audit-logs',
    icon: Activity,
    anyOf: [PERMISSIONS.audit.view],
  },
];
