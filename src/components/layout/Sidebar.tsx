import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { NAVIGATION, type NavItem } from '@/routes/navigation';

function useVisibleNavigation(): NavItem[] {
  const { canAny } = useAuth();

  const isVisible = (item: NavItem): boolean => {
    if (!item.anyOf || item.anyOf.length === 0) return true;
    return canAny(item.anyOf);
  };

  return NAVIGATION.filter(isVisible).map((item) => ({
    ...item,
    children: item.children?.filter(isVisible),
  }));
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, localized } = useI18n();
  const { settings } = useSettings();
  const location = useLocation();
  const items = useVisibleNavigation();
  const [expanded, setExpanded] = useState<string[]>([]);

  // Keep the group containing the active route open.
  useEffect(() => {
    const active = items.find((item) =>
      item.children?.some((child) => child.path && location.pathname.startsWith(child.path)),
    );
    if (active) setExpanded((current) => (current.includes(active.id) ? current : [...current, active.id]));
  }, [location.pathname, items]);

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggle = (id: string) =>
    setExpanded((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex w-[17rem] flex-col border-e border-line bg-surface',
          'transition-transform duration-300 ease-out lg:translate-x-0 lg:rtl:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full',
        )}
        style={{ backdropFilter: 'var(--sf-surface-blur)' }}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-line px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark logoUrl={settings.branding.logo_url} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-extrabold text-content">
                {localized(settings.branding.company_name_en, settings.branding.company_name_ar)}
              </p>
              <p className="truncate text-[10px] text-content-muted">{t('common.appSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-theme-sm p-1.5 text-content-muted hover:bg-surface-alt lg:hidden"
            aria-label={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {items.map((item) =>
            item.children && item.children.length > 0 ? (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-theme-sm px-3 py-2.5 text-sm font-semibold transition',
                    'text-content-muted hover:bg-surface-alt hover:text-content',
                  )}
                >
                  <item.icon size={18} className="shrink-0" />
                  <span className="flex-1 text-start">{t(item.labelKey)}</span>
                  <ChevronDown
                    size={15}
                    className={cn('transition-transform', expanded.includes(item.id) && 'rotate-180')}
                  />
                </button>
                <div
                  className={cn(
                    'grid transition-[grid-template-rows] duration-300 ease-out',
                    expanded.includes(item.id) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="ms-4 mt-0.5 space-y-0.5 border-s border-line ps-2.5">
                      {item.children.map((child) => (
                        <NavRow key={child.id} item={child} nested />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <NavRow key={item.id} item={item} />
            ),
          )}
        </nav>

        <div className="border-t border-line px-4 py-3">
          <p className="text-center text-[10px] leading-relaxed text-content-muted">
            {t('splash.copyright')}
          </p>
        </div>
      </aside>
    </>
  );
}

function NavRow({ item, nested = false }: { item: NavItem; nested?: boolean }) {
  const { t } = useI18n();
  if (!item.path) return null;

  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-theme-sm px-3 py-2.5 text-sm font-semibold transition-all',
          nested && 'py-2 text-[13px]',
          isActive
            ? 'bg-primary text-primary-fg shadow-sm'
            : 'text-content-muted hover:bg-surface-alt hover:text-content',
        )
      }
    >
      <item.icon size={nested ? 16 : 18} className="shrink-0" />
      <span className="flex-1 truncate text-start">{t(item.labelKey)}</span>
    </NavLink>
  );
}

export function BrandMark({ logoUrl, size = 36 }: { logoUrl?: string | null; size?: number }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="shrink-0 rounded-theme-sm object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-theme-sm font-extrabold text-primary-fg"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.44,
        background: 'linear-gradient(135deg, var(--sf-primary), var(--sf-accent))',
      }}
      aria-hidden
    >
      SF
    </span>
  );
}
