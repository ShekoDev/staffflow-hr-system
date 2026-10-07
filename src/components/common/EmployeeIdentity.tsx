import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import { avatarTint, initialsOf, resolveFrame, resolveNameColor, resolveAutoBadges, type AppearanceContext } from '@/lib/appearance';
import { useBadges, useFrames, useNameColorRules } from '@/hooks/useCustomization';
import { useI18n } from '@/i18n';
import type { Employee } from '@/types/models';
import { Tooltip } from '@/components/ui/Tooltip';

const SIZES = { xs: 28, sm: 36, md: 44, lg: 64, xl: 96 } as const;
export type AvatarSize = keyof typeof SIZES;

export interface IdentitySource {
  id?: string;
  full_name_en?: string | null;
  full_name_ar?: string | null;
  photo_url?: string | null;
  frame_id?: string | null;
  name_color?: string | null;
}

/**
 * Avatar with its data-driven profile frame. The frame is a gradient ring
 * defined in the `profile_frames` table, so admins can add new ones without
 * touching this component.
 */
export function EmployeeAvatar({
  employee,
  size = 'md',
  context = {},
  className,
}: {
  employee: IdentitySource | null | undefined;
  size?: AvatarSize;
  context?: AppearanceContext;
  className?: string;
}) {
  const { data: frames = [] } = useFrames();
  const { localized } = useI18n();
  const px = SIZES[size];

  const name = localized(employee?.full_name_en, employee?.full_name_ar);
  const frame = useMemo(
    () => resolveFrame(employee as Employee | null, frames, context),
    [employee, frames, context],
  );

  const ring = frame?.ring_width ?? 2;
  const innerSize = px - ring * 2;

  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center rounded-full', className)}
      style={{
        width: px,
        height: px,
        background: frame?.css_gradient ?? 'var(--sf-border)',
        boxShadow: frame?.glow_color ? `0 0 0 1px ${frame.glow_color}22, 0 0 14px -2px ${frame.glow_color}80` : undefined,
      }}
      title={name}
    >
      <span
        className="flex items-center justify-center overflow-hidden rounded-full bg-surface"
        style={{ width: innerSize, height: innerSize }}
      >
        {employee?.photo_url ? (
          <img
            src={employee.photo_url}
            alt={name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center font-bold text-white"
            style={{
              background: avatarTint(employee?.id ?? name ?? 'sf'),
              fontSize: Math.max(10, innerSize * 0.36),
            }}
          >
            {initialsOf(name)}
          </span>
        )}
      </span>
    </span>
  );
}

/** Employee name coloured by the priority rules, with automatic badges. */
export function EmployeeName({
  employee,
  context = {},
  showBadges = true,
  className,
  subtitle,
}: {
  employee: IdentitySource | null | undefined;
  context?: AppearanceContext;
  showBadges?: boolean;
  className?: string;
  subtitle?: string | null;
}) {
  const { data: rules = [] } = useNameColorRules();
  const { data: badges = [] } = useBadges();
  const { localized } = useI18n();

  const name = localized(employee?.full_name_en, employee?.full_name_ar) || '—';
  const color = resolveNameColor(employee as Employee | null, rules, context);
  const autoBadges = showBadges ? resolveAutoBadges(badges, context) : [];

  return (
    <span className={cn('flex min-w-0 flex-col', className)}>
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          className="truncate font-semibold"
          style={color ? { color } : undefined}
        >
          {name}
        </span>
        {autoBadges.slice(0, 3).map((badge) => (
          <Tooltip key={badge.id} label={localized(badge.name_en, badge.name_ar)}>
            <span className="text-[13px] leading-none" aria-hidden>
              {badge.icon}
            </span>
          </Tooltip>
        ))}
      </span>
      {subtitle && <span className="truncate text-xs text-content-muted">{subtitle}</span>}
    </span>
  );
}

/** Avatar + name, the combination used in every table and list. */
export function EmployeeIdentity({
  employee,
  context = {},
  subtitle,
  size = 'sm',
}: {
  employee: IdentitySource | null | undefined;
  context?: AppearanceContext;
  subtitle?: string | null;
  size?: AvatarSize;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <EmployeeAvatar employee={employee} size={size} context={context} />
      <EmployeeName employee={employee} context={context} subtitle={subtitle} />
    </span>
  );
}
