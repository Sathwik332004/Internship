import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Clock3,
  FileClock,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  PencilLine,
  PlusCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import { auditLogAPI } from '../services/api';

const ACTION_CONFIG = {
  CREATE: {
    label: 'Create',
    icon: PlusCircle,
    badge: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    dot: 'bg-emerald-500'
  },
  UPDATE: {
    label: 'Update',
    icon: PencilLine,
    badge: 'bg-amber-100 text-amber-800 ring-amber-200',
    dot: 'bg-amber-500'
  },
  DELETE: {
    label: 'Delete',
    icon: Trash2,
    badge: 'bg-rose-100 text-rose-800 ring-rose-200',
    dot: 'bg-rose-500'
  }
};

const DEFAULT_FILTERS = {
  search: '',
  module: '',
  action: ''
};

const formatDateTime = (dateValue) => {
  if (!dateValue) {
    return '-';
  }

  return new Date(dateValue).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [availableModules, setAvailableModules] = useState([]);
  const [summary, setSummary] = useState({ total: 0, createCount: 0, updateCount: 0, deleteCount: 0 });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, limit: 25, total: 0 });
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const actionOptions = useMemo(() => Object.entries(ACTION_CONFIG), []);

  const fetchLogs = async ({ page = pagination.page, silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setRefreshing(true);

      const response = await auditLogAPI.getAll({
        page,
        limit: pagination.limit,
        search: filters.search.trim(),
        module: filters.module,
        action: filters.action
      });

      setLogs(response.data.data || []);
      setSummary(response.data.summary || { total: 0, createCount: 0, updateCount: 0, deleteCount: 0 });
      setPagination((current) => ({
        ...current,
        page: response.data.pagination?.page || page,
        pages: response.data.pagination?.pages || 1,
        total: response.data.pagination?.total || 0,
        limit: response.data.pagination?.limit || current.limit
      }));
      setAvailableModules(response.data.modules || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error(error.response?.data?.message || 'Unable to load audit logs');
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleFilterChange = (field, value) => {
    setPagination((current) => ({ ...current, page: 1 }));
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const handleRefresh = () => {
    fetchLogs({ page: pagination.page, silent: true });
  };

  const goToPage = (page) => {
    const nextPage = Math.min(Math.max(page, 1), pagination.pages || 1);
    if (nextPage !== pagination.page) {
      setPagination((current) => ({ ...current, page: nextPage }));
      fetchLogs({ page: nextPage, silent: true });
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.34em] text-slate-500">Security trail</p>
          <h1 className="text-3xl font-semibold text-slate-900">Audit Logs</h1>
          <p className="mt-2 text-sm text-slate-500">Track who changed what across the store so admins can review activity at a glance.</p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_14px_30px_rgba(15,23,42,0.05)] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-medium text-slate-500">Total logs</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.total || pagination.total || 0}</p>
        </div>
        <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-medium text-slate-500">Creates</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{summary.createCount || 0}</p>
        </div>
        <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-medium text-slate-500">Updates</p>
          <p className="mt-2 text-3xl font-semibold text-amber-700">{summary.updateCount || 0}</p>
        </div>
        <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-medium text-slate-500">Deletes</p>
          <p className="mt-2 text-3xl font-semibold text-rose-700">{summary.deleteCount || 0}</p>
        </div>
      </div>

      <div className="mb-6 rounded-[24px] border border-gray-200 bg-white p-4 shadow-[0_20px_48px_rgba(15,23,42,0.05)]">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search user, module, or action..."
              className="w-full rounded-2xl border border-gray-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white"
            />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={filters.module}
              onChange={(e) => handleFilterChange('module', e.target.value)}
              className="w-full appearance-none rounded-2xl border border-gray-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-400 focus:bg-white"
            >
              <option value="">All modules</option>
              {availableModules.map((module) => (
                <option key={module} value={module}>{module}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <ArrowLeftRight className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="w-full appearance-none rounded-2xl border border-gray-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-400 focus:bg-white"
            >
              <option value="">All actions</option>
              {actionOptions.map(([value, config]) => (
                <option key={value} value={value}>{config.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[24px] border border-dashed border-gray-300 bg-white px-6 py-12 text-center shadow-[0_20px_48px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <FileClock className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">No audit logs found</h2>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            Try widening your filters or check back after users perform changes in the system.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Time</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">User</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Action</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Module</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => {
                  const config = ACTION_CONFIG[log.action] || ACTION_CONFIG.UPDATE;
                  const ActionIcon = config.icon;

                  return (
                    <tr key={log._id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 h-2.5 w-2.5 rounded-full ${config.dot}`}></div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{formatDateTime(log.createdAt)}</p>
                            <p className="text-xs text-slate-500">{log.statusCode || 200}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                            <UserRound className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{log.userName || 'Unknown user'}</p>
                            <p className="text-xs text-slate-500">{log.userEmail || log.userRole || 'No role'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${config.badge}`}>
                          <ActionIcon className="h-3.5 w-3.5" />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {log.module || '-'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Showing {logs.length} of {pagination.total} log{pagination.total === 1 ? '' : 's'}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                Page {pagination.page} of {Math.max(pagination.pages, 1)}
              </span>
              <button
                type="button"
                onClick={() => goToPage(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}