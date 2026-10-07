/**
 * Canonical permission keys.
 *
 * Mirrors the rows seeded in supabase/migrations/0007_seed_reference_data.sql.
 * Using these constants (instead of loose strings) means a typo becomes a
 * compile error rather than a silently denied action.
 */
export const PERMISSIONS = {
  dashboard: {
    view: 'dashboard.view',
  },
  employees: {
    viewAll: 'employees.view_all',
    viewTeam: 'employees.view_team',
    create: 'employees.create',
    editAll: 'employees.edit_all',
    editTeam: 'employees.edit_team',
    delete: 'employees.delete',
    export: 'employees.export',
  },
  organization: {
    departments: 'departments.manage',
    teams: 'teams.manage',
  },
  users: {
    view: 'users.view',
    manage: 'users.manage',
    roles: 'roles.manage',
    permissions: 'permissions.manage',
  },
  attendance: {
    viewAll: 'attendance.view_all',
    viewTeam: 'attendance.view_team',
    manage: 'attendance.manage',
    manageTeam: 'attendance.manage_team',
    export: 'attendance.export',
  },
  leaves: {
    viewAll: 'leaves.view_all',
    viewTeam: 'leaves.view_team',
    manage: 'leaves.manage',
    approveTeam: 'leaves.approve_team',
  },
  evaluations: {
    viewAll: 'evaluations.view_all',
    viewTeam: 'evaluations.view_team',
    evaluateTeam: 'evaluations.evaluate_team',
    self: 'evaluations.self',
    manage: 'evaluations.manage',
    configure: 'evaluations.configure',
    export: 'evaluations.export',
  },
  ranking: {
    view: 'ranking.view',
    manage: 'ranking.manage',
  },
  reports: {
    employee: 'reports.employee',
    team: 'reports.team',
    department: 'reports.department',
    company: 'reports.company',
  },
  customization: {
    manage: 'customization.manage',
  },
  settings: {
    manage: 'settings.manage',
    notifications: 'notifications.send',
  },
  audit: {
    view: 'audit.view',
  },
} as const;

type Leaves<T> = T extends string ? T : { [K in keyof T]: Leaves<T[K]> }[keyof T];
export type PermissionKey = Leaves<typeof PERMISSIONS>;

/** Any of these means "this user can open the Employees section at all". */
export const EMPLOYEE_VIEW_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.employees.viewAll,
  PERMISSIONS.employees.viewTeam,
];

export const ATTENDANCE_VIEW_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.attendance.viewAll,
  PERMISSIONS.attendance.viewTeam,
];

export const EVALUATION_VIEW_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.evaluations.viewAll,
  PERMISSIONS.evaluations.viewTeam,
  PERMISSIONS.evaluations.evaluateTeam,
];

export const REPORT_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.reports.employee,
  PERMISSIONS.reports.team,
  PERMISSIONS.reports.department,
  PERMISSIONS.reports.company,
];
