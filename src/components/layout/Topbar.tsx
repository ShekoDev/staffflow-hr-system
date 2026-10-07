import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronDown, KeyRound, LogOut, Menu, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/cn';
import { useI18n } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { fetchNotifications, markNotificationRead } from '@/services/dashboard.service';
import { formatDateTime } from '@/lib/format';
import { EmployeeAvatar } from '@/components/common/EmployeeIdentity';
import { ColorModeToggle, LanguageSwitcher, ThemePicker } from '@/components/common/AppearanceControls';
import { Button } from '@/components/ui/Button';

export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { t, localized, language } = useI18n();
  const { profile, signOut, roleKey } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  const { data: notifications = [], refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications(10),
    enabled: Boolean(profile),
    refetchInterval: 60_000,
  });

  const unread = notifications.filter((n) => !n.is_read).length;
  const employee = profile?.employee;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-surface/85 px-3 backdrop-blur-md sm:px-5">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="rounded-theme-sm p-2 text-content-muted transition hover:bg-surface-alt hover:text-content lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1" />

      <LanguageSwitcher compact />
      <ThemePicker />
      <ColorModeToggle />

      {/* Notifications */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setBellOpen((o) => !o)}
          aria-label={t('dashboard.notifications')}
          className="relative"
        >
          <Bell size={17} />
          {unread > 0 && (
            <span className="absolute end-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
        {bellOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} aria-hidden />
            <div className="sf-surface absolute end-0 z-50 mt-2 w-[min(92vw,20rem)] animate-scale-in overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <p className="text-xs font-bold uppercase tracking-wide text-content-muted">
                  {t('dashboard.notifications')}
                </p>
                <Link
                  to="/notifications"
                  onClick={() => setBellOpen(false)}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  {t('notifications.all')}
                </Link>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-content-muted">
                    {t('dashboard.noNotifications')}
                  </p>
                ) : (
                  notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={async () => {
                        if (!item.is_read) {
                          await markNotificationRead(item.id);
                          void refetch();
                        }
                      }}
                      className={cn(
                        'block w-full border-b border-line/60 px-4 py-3 text-start transition last:border-0 hover:bg-surface-alt',
                        !item.is_read && 'bg-primary/5',
                      )}
                    >
                      <p className="text-sm font-semibold text-content">
                        {localized(item.title_en, item.title_ar)}
                      </p>
                      {(item.body_en || item.body_ar) && (
                        <p className="mt-0.5 text-xs text-content-muted">
                          {localized(item.body_en, item.body_ar)}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-content-muted">
                        {formatDateTime(item.created_at, language)}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Account menu */}
      <div className="relative ms-1">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-theme-sm p-1 pe-2 transition hover:bg-surface-alt"
        >
          <EmployeeAvatar employee={employee} size="sm" context={{ roleKey }} />
          <span className="hidden min-w-0 text-start sm:block">
            <span className="block max-w-[9rem] truncate text-sm font-semibold text-content">
              {localized(employee?.full_name_en, employee?.full_name_ar) ||
                profile?.user.username ||
                profile?.user.email}
            </span>
            <span className="block text-[10px] uppercase tracking-wide text-content-muted">
              {roleKey}
            </span>
          </span>
          <ChevronDown size={14} className="text-content-muted" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
            <div className="sf-surface absolute end-0 z-50 mt-2 w-56 animate-scale-in p-1.5">
              <Link
                to="/my-profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-theme-sm px-3 py-2 text-sm font-medium transition hover:bg-surface-alt"
              >
                <User size={16} /> {t('nav.myProfile')}
              </Link>
              <Link
                to="/change-password"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-theme-sm px-3 py-2 text-sm font-medium transition hover:bg-surface-alt"
              >
                <KeyRound size={16} /> {t('auth.changePassword')}
              </Link>
              <div className="my-1 border-t border-line" />
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex w-full items-center gap-2.5 rounded-theme-sm px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger/10"
              >
                <LogOut size={16} /> {t('auth.signOut')}
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
