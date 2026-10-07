import { useQuery } from '@tanstack/react-query';
import { fetchDepartments } from '@/services/departments.service';
import { fetchTeams } from '@/services/teams.service';
import { fetchEmployeeOptions } from '@/services/employees.service';
import { fetchPermissions, fetchRoles } from '@/services/users.service';

export function useDepartments() {
  return useQuery({ queryKey: ['departments'], queryFn: fetchDepartments, staleTime: 60_000 });
}

export function useTeams() {
  return useQuery({ queryKey: ['teams'], queryFn: fetchTeams, staleTime: 60_000 });
}

export function useEmployeeOptions() {
  return useQuery({
    queryKey: ['employee-options'],
    queryFn: fetchEmployeeOptions,
    staleTime: 60_000,
  });
}

export function useRoles() {
  return useQuery({ queryKey: ['roles'], queryFn: fetchRoles, staleTime: 10 * 60 * 1000 });
}

export function usePermissionCatalog() {
  return useQuery({ queryKey: ['permissions'], queryFn: fetchPermissions, staleTime: 10 * 60 * 1000 });
}
