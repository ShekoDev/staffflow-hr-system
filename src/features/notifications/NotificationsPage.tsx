import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useToast } from '@/providers/ToastProvider';
import { supabase } from '@/lib/supabase';
import { fetchNotifications, markNotificationRead } from '@/services/dashboard.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Pill, type BadgeTone } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDateTime } from '@/lib/format';

const TYPE_TONE: Record<string, BadgeTone> = {
  info: 'neutral',
  success: 'success',
  warning: 'warning',
  evaluation: 'primary',
  attendance: 'warning',
  ranking: 'accent',
};

export function NotificationsPage() {
  const { t, localized, language } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', 'page'],
    queryFn: () => fetchNotifications(100),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const readMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: invalidate,
  });

  const readAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('mark_all_notifications_read');
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('notifications.allRead'));
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const rows = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <>
      <PageHeader
        title={t('notifications.title')}
        actions={
          unreadCount > 0 && (
            <Button
              variant="secondary"
              leftIcon={<CheckCheck size={16} />}
              loading={readAllMutation.isPending}
              onClick={() => readAllMutation.mutate()}
            >
              {t('notifications.markAllRead')}
            </Button>
          )
        }
      />

      <Tabs
        className="mb-4 max-w-xs"
        value={filter}
        onChange={(key) => setFilter(key as 'all' | 'unread')}
        items={[
          { key: 'all', label: t('notifications.all') },
          {
            key: 'unread',
            label: `${t('notifications.unread')}${unreadCount ? ` (${unreadCount})` : ''}`,
          },
        ]}
      />

      {isLoading ? (
        <Card>
          <Skeleton className="h-40 w-full" />
        </Card>
      ) : rows.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<Bell size={24} />}
            title={t('notifications.empty')}
            description={t('notifications.emptyBody')}
          />
        </Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {rows.map((item, index) => {
              const content = (
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background: item.is_read ? 'var(--sf-border)' : 'var(--sf-primary)',
                    }}
                  />
                  <div className="min-w-0 flex-1">
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
                  </div>
                  <Pill tone={TYPE_TONE[item.type] ?? 'neutral'}>{item.type}</Pill>
                </div>
              );

              return (
                <li
                  key={item.id}
                  className="animate-fade-in px-4 py-3.5 transition hover:bg-surface-alt/60"
                  style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
                  onClick={() => !item.is_read && readMutation.mutate(item.id)}
                >
                  {item.link ? (
                    <Link to={item.link} className="block">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
