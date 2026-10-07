import { useAuth } from '@/providers/AuthProvider';
import { PERMISSIONS } from '@/lib/permissions';
import { AdminDashboard } from './AdminDashboard';
import { ManagerDashboard } from './ManagerDashboard';
import { EmployeeDashboard } from './EmployeeDashboard';

/**
 * One route, four experiences. The dashboard shown is driven by what the
 * user can actually see, not by a hardcoded role switch — so a custom role
 * with company-wide visibility gets the company view automatically.
 */
export function DashboardPage() {
  const { can, roleKey } = useAuth();

  if (roleKey === 'admin' || can(PERMISSIONS.employees.viewAll)) return <AdminDashboard />;
  if (can(PERMISSIONS.employees.viewTeam)) return <ManagerDashboard />;
  return <EmployeeDashboard />;
}
