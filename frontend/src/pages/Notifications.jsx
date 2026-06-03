import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCheck,
  Clock,
  CreditCard,
  PackageX,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-toastify';
import { notificationAPI } from '../services/api';

const TYPE_CONFIG = {
  LOW_STOCK: {
    label: 'Low Stock',
    icon: AlertTriangle,
    card: 'border-amber-200 bg-amber-50/80',
    iconWrap: 'bg-amber-100 text-amber-700',
    text: 'text-amber-800'
  },
  EXPIRY_WARNING: {
    label: 'Expiry Warning',
    icon: Clock,
    card: 'border-orange-200 bg-orange-50/80',
    iconWrap: 'bg-orange-100 text-orange-700',
    text: 'text-orange-800'
  },
  EXPIRED: {
    label: 'Expired',
    icon: PackageX,
    card: 'border-red-200 bg-red-50/80',
    iconWrap: 'bg-red-100 text-red-700',
    text: 'text-red-800'
  },
  PENDING_PAYMENT: {
    label: 'Pending Payment',
    icon: CreditCard,
    card: 'border-blue-200 bg-blue-50/80',
    iconWrap: 'bg-blue-100 text-blue-700',
    text: 'text-blue-800'
  },
  APPLICATION_STATE_CHANGE: {
    label: 'Application Changes',
    icon: Activity,
    card: 'border-emerald-200 bg-emerald-50/80',
    iconWrap: 'bg-emerald-100 text-emerald-700',
    text: 'text-emerald-800'
  }
};

const TYPE_ORDER = ['APPLICATION_STATE_CHANGE', 'LOW_STOCK', 'EXPIRY_WARNING', 'EXPIRED', 'PENDING_PAYMENT'];

const getTimeAgo = (dateValue) => {
  const date = new Date(dateValue);
  const diffSeconds = Math.max(Math.floor((Date.now() - date.getTime()) / 1000), 0);

  if (diffSeconds < 60) return 'Just now';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const groupedNotifications = useMemo(() => {
    return TYPE_ORDER.reduce((groups, type) => {
      groups[type] = notifications.filter((notification) => notification.type === type);
      return groups;
    }, {});
  }, [notifications]);

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  const fetchNotifications = async ({ generate = false, silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setRefreshing(true);

      const response = generate
        ? await notificationAPI.generate()
        : await notificationAPI.getAll();

      setNotifications(response.data.data || []);
      window.dispatchEvent(new Event('notifications:updated'));
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error(error.response?.data?.message || 'Unable to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications({ generate: true });
  }, []);

  const handleMarkAsRead = async (notification) => {
    if (notification.isRead || updatingId) {
      return;
    }

    try {
      setUpdatingId(notification._id);
      await notificationAPI.markAsRead(notification._id);
      setNotifications((current) => current.map((item) => (
        item._id === notification._id ? { ...item, isRead: true } : item
      )));
      window.dispatchEvent(new Event('notifications:updated'));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Unable to mark notification as read');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) {
      return;
    }

    try {
      await notificationAPI.markAllAsRead();
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      window.dispatchEvent(new Event('notifications:updated'));
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Unable to mark all notifications as read');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.34em] text-slate-500">Store alerts</p>
          <h1 className="text-3xl font-semibold text-slate-900">Notifications</h1>
          <p className="mt-2 text-sm text-slate-500">Application changes, stock, expiry, and payment alerts generated from current store activity.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => fetchNotifications({ generate: true, silent: true })}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_14px_30px_rgba(15,23,42,0.05)] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,185,129,0.20)] transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-medium text-slate-500">Total Alerts</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{notifications.length}</p>
        </div>
        <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-medium text-slate-500">Unread</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{unreadCount}</p>
        </div>
        <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-medium text-slate-500">Categories</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {TYPE_ORDER.filter((type) => groupedNotifications[type]?.length > 0).length}
          </p>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[24px] border border-dashed border-gray-300 bg-white px-6 py-12 text-center shadow-[0_20px_48px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Bell className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">No notifications</h2>
          <p className="mt-2 max-w-md text-sm text-slate-500">Everything looks clear right now. Refresh anytime to scan application activity, inventory, and payments again.</p>
        </div>
      ) : (
        <div className="space-y-7">
          {TYPE_ORDER.map((type) => {
            const items = groupedNotifications[type] || [];
            const config = TYPE_CONFIG[type];
            const Icon = config.icon;

            if (items.length === 0) {
              return null;
            }

            return (
              <section key={type}>
                <div className="mb-3 flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${config.iconWrap}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{config.label}</h2>
                    <p className="text-sm text-slate-500">{items.length} alert{items.length === 1 ? '' : 's'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {items.map((notification) => (
                    <button
                      key={notification._id}
                      type="button"
                      onClick={() => handleMarkAsRead(notification)}
                      className={`rounded-[24px] border p-5 text-left shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(15,23,42,0.08)] ${config.card} ${notification.isRead ? 'opacity-55 grayscale' : ''}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${config.iconWrap}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className={`text-base font-semibold ${config.text}`}>{notification.title}</h3>
                            {!notification.isRead ? (
                              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                                New
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{notification.message}</p>
                          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            {getTimeAgo(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
