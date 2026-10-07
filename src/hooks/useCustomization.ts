import { useQuery } from '@tanstack/react-query';
import { fetchBadges, fetchFrames, fetchNameColorRules } from '@/services/customization.service';

export function useFrames() {
  return useQuery({ queryKey: ['frames'], queryFn: fetchFrames, staleTime: 10 * 60 * 1000 });
}

export function useBadges() {
  return useQuery({ queryKey: ['badges'], queryFn: fetchBadges, staleTime: 10 * 60 * 1000 });
}

export function useNameColorRules() {
  return useQuery({
    queryKey: ['name-color-rules'],
    queryFn: fetchNameColorRules,
    staleTime: 10 * 60 * 1000,
  });
}
