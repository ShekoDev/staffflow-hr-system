import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronRight, UserCog, UsersRound } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useDepartments, useTeams } from '@/hooks/useOrganization';
import { fetchEmployees } from '@/services/employees.service';
import { PageHeader } from '@/components/common/PageHeader';
import { EmployeeIdentity } from '@/components/common/EmployeeIdentity';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Pill } from '@/components/ui/Badge';
import type { Employee } from '@/types/models';

interface ManagerNode {
  manager: Employee;
  reports: Employee[];
  departments: string[];
  teams: string[];
}

/**
 * Reporting tree: Department → Manager → Team members.
 * Built from the same rows the rest of the app uses, so it always matches
 * what the permission layer considers "my team".
 */
export function ManagersPage() {
  const { t, localized } = useI18n();
  const { data: departments = [] } = useDepartments();
  const { data: teams = [] } = useTeams();

  const { data, isLoading } = useQuery({
    queryKey: ['employees', 'tree'],
    queryFn: () => fetchEmployees({ pageSize: 500, status: 'active' }),
  });

  const nodes = useMemo<ManagerNode[]>(() => {
    const employees = data?.rows ?? [];
    const byId = new Map(employees.map((e) => [e.id, e]));
    const grouped = new Map<string, Employee[]>();

    for (const employee of employees) {
      if (!employee.manager_id) continue;
      const bucket = grouped.get(employee.manager_id) ?? [];
      bucket.push(employee);
      grouped.set(employee.manager_id, bucket);
    }

    const managerIds = new Set<string>(grouped.keys());
    for (const department of departments) if (department.manager_id) managerIds.add(department.manager_id);
    for (const team of teams) if (team.manager_id) managerIds.add(team.manager_id);

    return Array.from(managerIds)
      .map((managerId) => {
        const manager = byId.get(managerId);
        if (!manager) return null;
        return {
          manager,
          reports: grouped.get(managerId) ?? [],
          departments: departments
            .filter((d) => d.manager_id === managerId)
            .map((d) => localized(d.name_en, d.name_ar)),
          teams: teams
            .filter((team) => team.manager_id === managerId)
            .map((team) => localized(team.name_en, team.name_ar)),
        } satisfies ManagerNode;
      })
      .filter((node): node is ManagerNode => node !== null)
      .sort((a, b) => b.reports.length - a.reports.length);
  }, [data, departments, teams, localized]);

  if (isLoading) {
    return (
      <>
        <PageHeader title={t('managers.title')} subtitle={t('managers.subtitle')} />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="mt-4 h-16 w-full" />
            </Card>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('managers.title')} subtitle={t('managers.subtitle')} />

      {nodes.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<UserCog size={24} />}
            title={t('managers.noManagers')}
            description={t('managers.noManagersBody')}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {nodes.map((node, index) => (
            <Card key={node.manager.id} className="animate-fade-up" style={{ animationDelay: `${index * 50}ms` }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link to={`/employees/${node.manager.id}`}>
                  <EmployeeIdentity
                    employee={node.manager}
                    subtitle={node.manager.job_title}
                    size="md"
                  />
                </Link>
                <div className="flex flex-wrap items-center gap-1.5">
                  {node.departments.map((name) => (
                    <Pill key={name} tone="primary" icon={<Building2 size={11} />}>
                      {name}
                    </Pill>
                  ))}
                  {node.teams.map((name) => (
                    <Pill key={name} tone="accent" icon={<UsersRound size={11} />}>
                      {name}
                    </Pill>
                  ))}
                  <Pill tone="neutral">
                    {t('managers.manages')} {node.reports.length} {t('managers.people')}
                  </Pill>
                </div>
              </div>

              {node.reports.length > 0 && (
                <ul className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-2 xl:grid-cols-3">
                  {node.reports.map((report) => (
                    <li key={report.id}>
                      <Link
                        to={`/employees/${report.id}`}
                        className="flex items-center gap-2 rounded-theme-sm p-2 transition hover:bg-surface-alt"
                      >
                        <ChevronRight size={14} className="shrink-0 text-content-muted rtl:rotate-180" />
                        <EmployeeIdentity employee={report} subtitle={report.job_title} size="xs" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
