import type { Badge, Employee, NameColorRule, ProfileFrame } from '@/types/models';

/**
 * Visual identity rules.
 *
 * Frames, name colours and badges are all data-driven: the admin edits rows
 * in the database and this module resolves them, so nothing here needs to
 * change when a new frame or badge is added.
 */

export interface AppearanceContext {
  roleKey?: string | null;
  isEmployeeOfMonth?: boolean;
  isTopPerformer?: boolean;
  hasPerfectAttendance?: boolean;
  isNewEmployee?: boolean;
}

function conditionMatches(condition: string | null, ctx: AppearanceContext): boolean {
  switch (condition) {
    case 'employee_of_month':
      return Boolean(ctx.isEmployeeOfMonth);
    case 'top_performer':
      return Boolean(ctx.isTopPerformer);
    case 'perfect_attendance':
      return Boolean(ctx.hasPerfectAttendance);
    case 'new_employee':
      return Boolean(ctx.isNewEmployee);
    default:
      return false;
  }
}

/**
 * Explicit assignment wins; otherwise the lowest-priority matching rule
 * (condition first, then role) decides.
 */
export function resolveFrame(
  employee: Pick<Employee, 'frame_id'> | null | undefined,
  frames: ProfileFrame[],
  ctx: AppearanceContext,
): ProfileFrame | null {
  if (!frames.length) return null;

  if (employee?.frame_id) {
    const explicit = frames.find((f) => f.id === employee.frame_id);
    if (explicit) return explicit;
  }

  const candidates = frames
    .filter(
      (frame) =>
        conditionMatches(frame.auto_condition, ctx) ||
        (frame.auto_role_key && frame.auto_role_key === ctx.roleKey),
    )
    .sort((a, b) => a.priority - b.priority);

  return candidates[0] ?? frames.find((f) => f.key === 'default') ?? null;
}

export function resolveNameColor(
  employee: Pick<Employee, 'name_color'> | null | undefined,
  rules: NameColorRule[],
  ctx: AppearanceContext,
): string | undefined {
  if (employee?.name_color) return employee.name_color;

  const match = rules
    .filter((rule) =>
      rule.condition_type === 'status'
        ? conditionMatches(rule.condition_value, ctx)
        : rule.condition_value === ctx.roleKey,
    )
    .sort((a, b) => a.priority - b.priority)[0];

  return match?.color || undefined;
}

export function resolveAutoBadges(badges: Badge[], ctx: AppearanceContext): Badge[] {
  return badges
    .filter(
      (badge) =>
        conditionMatches(badge.auto_condition, ctx) ||
        (badge.auto_role_key && badge.auto_role_key === ctx.roleKey),
    )
    .sort((a, b) => a.priority - b.priority);
}

/** "Ahmed Mohamed Ali" -> "AM" */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic pastel background for employees without a photo. */
export function avatarTint(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 62% 52%)`;
}
