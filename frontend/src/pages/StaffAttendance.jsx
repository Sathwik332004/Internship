import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CalendarClock, Clock, LogIn, LogOut, RefreshCw, UserCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { staffAttendanceAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatCurrency = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;

export default function StaffAttendance() {
  const { user, isAdmin } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    shiftName: 'General',
    scheduledStart: '',
    scheduledEnd: '',
    openingCash: '',
    closingCash: '',
    notes: ''
  });

  const summary = overview?.summary || {};
  const attendance = overview?.attendance || [];
  const sessions = overview?.sessions || [];
  const activeAttendance = overview?.activeAttendance;
  const activeSession = overview?.activeSession;

  const todayStatus = useMemo(() => {
    if (activeAttendance) return 'Clocked in';
    if (attendance.some((item) => item.dateKey === new Date().toISOString().slice(0, 10) && item.status === 'COMPLETED')) {
      return 'Completed';
    }
    return 'Not started';
  }, [activeAttendance, attendance]);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const response = await staffAttendanceAPI.getOverview();
      setOverview(response.data.data);
    } catch (error) {
      console.error('Error loading staff attendance:', error);
      toast.error(error.response?.data?.message || 'Unable to load staff attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const runAction = async (action, successMessage) => {
    try {
      setSaving(true);
      await action();
      toast.success(successMessage);
      await fetchOverview();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClockIn = () => runAction(
    () => staffAttendanceAPI.clockIn({
      shiftName: form.shiftName,
      scheduledStart: form.scheduledStart,
      scheduledEnd: form.scheduledEnd,
      notes: form.notes
    }),
    'Clocked in successfully'
  );

  const handleClockOut = () => runAction(
    () => staffAttendanceAPI.clockOut({ notes: form.notes }),
    'Clocked out successfully'
  );

  const handleOpenSession = () => runAction(
    () => staffAttendanceAPI.openSession({
      shiftName: form.shiftName,
      openingCash: Number(form.openingCash || 0),
      notes: form.notes
    }),
    'Cashier session opened'
  );

  const handleCloseSession = () => {
    if (!activeSession?._id) return;
    return runAction(
      () => staffAttendanceAPI.closeSession(activeSession._id, {
        closingCash: Number(form.closingCash || 0),
        notes: form.notes
      }),
      'Cashier session closed'
    );
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.34em] text-slate-500">Staff operations</p>
          <h1 className="text-3xl font-semibold text-slate-900">Attendance & Shifts</h1>
          <p className="mt-2 text-sm text-slate-500">Track staff clock-ins, cashier sessions, and bill handling.</p>
        </div>
        <button
          type="button"
          onClick={fetchOverview}
          className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_14px_30px_rgba(15,23,42,0.05)] hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <UserCheck className="mb-3 h-5 w-5 text-emerald-700" />
          <p className="text-sm font-medium text-slate-500">Today Status</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{todayStatus}</p>
        </div>
        <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <CalendarClock className="mb-3 h-5 w-5 text-indigo-700" />
          <p className="text-sm font-medium text-slate-500">Attendance Records</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.attendanceRecords || 0}</p>
        </div>
        <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <Clock className="mb-3 h-5 w-5 text-amber-700" />
          <p className="text-sm font-medium text-slate-500">Open Sessions</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.openSessions || 0}</p>
        </div>
        <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <Banknote className="mb-3 h-5 w-5 text-blue-700" />
          <p className="text-sm font-medium text-slate-500">Session Sales</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(summary.totalSessionSales)}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
        <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <h2 className="text-lg font-semibold text-slate-900">Shift Controls</h2>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <label className="text-sm font-medium text-slate-600">
              Shift name
              <input
                value={form.shiftName}
                onChange={(event) => setForm({ ...form, shiftName: event.target.value })}
                className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-2.5 outline-none focus:border-emerald-500"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-slate-600">
                Start
                <input
                  type="time"
                  value={form.scheduledStart}
                  onChange={(event) => setForm({ ...form, scheduledStart: event.target.value })}
                  className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-2.5 outline-none focus:border-emerald-500"
                />
              </label>
              <label className="text-sm font-medium text-slate-600">
                End
                <input
                  type="time"
                  value={form.scheduledEnd}
                  onChange={(event) => setForm({ ...form, scheduledEnd: event.target.value })}
                  className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-2.5 outline-none focus:border-emerald-500"
                />
              </label>
            </div>
            <label className="text-sm font-medium text-slate-600">
              Opening cash
              <input
                type="number"
                min="0"
                value={form.openingCash}
                onChange={(event) => setForm({ ...form, openingCash: event.target.value })}
                className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-2.5 outline-none focus:border-emerald-500"
              />
            </label>
            <label className="text-sm font-medium text-slate-600">
              Closing cash
              <input
                type="number"
                min="0"
                value={form.closingCash}
                onChange={(event) => setForm({ ...form, closingCash: event.target.value })}
                className="mt-1 w-full rounded-2xl border border-gray-200 px-4 py-2.5 outline-none focus:border-emerald-500"
              />
            </label>
            <label className="text-sm font-medium text-slate-600">
              Notes
              <textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                rows={3}
                className="mt-1 w-full resize-none rounded-2xl border border-gray-200 px-4 py-2.5 outline-none focus:border-emerald-500"
              />
            </label>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button disabled={saving || Boolean(activeAttendance)} onClick={handleClockIn} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-300">
              <LogIn className="h-4 w-4" />
              Clock In
            </button>
            <button disabled={saving || !activeAttendance || Boolean(activeSession)} onClick={handleClockOut} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-300">
              <LogOut className="h-4 w-4" />
              Clock Out
            </button>
            <button disabled={saving || Boolean(activeSession)} onClick={handleOpenSession} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 disabled:opacity-50">
              Open Session
            </button>
            <button disabled={saving || !activeSession} onClick={handleCloseSession} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 disabled:opacity-50">
              Close Session
            </button>
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
            Signed in as {user?.name}
          </p>
        </div>

        <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <h2 className="text-lg font-semibold text-slate-900">Cashier Sessions</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  {isAdmin ? <th className="px-3 py-3">Staff</th> : null}
                  <th className="px-3 py-3">Opened</th>
                  <th className="px-3 py-3">Closed</th>
                  <th className="px-3 py-3">Bills</th>
                  <th className="px-3 py-3">Sales</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session._id} className="border-t border-gray-100">
                    {isAdmin ? <td className="px-3 py-3 font-medium text-slate-800">{session.staffName}</td> : null}
                    <td className="px-3 py-3 text-slate-600">{formatDateTime(session.openedAt)}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDateTime(session.closedAt)}</td>
                    <td className="px-3 py-3 text-slate-800">{session.billCount || 0}</td>
                    <td className="px-3 py-3 text-slate-800">{formatCurrency(session.totalSales)}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${session.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {session.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="px-3 py-8 text-center text-slate-500">No cashier sessions recorded.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
        <h2 className="text-lg font-semibold text-slate-900">Attendance History</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-slate-400">
              <tr>
                {isAdmin ? <th className="px-3 py-3">Staff</th> : null}
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Shift</th>
                <th className="px-3 py-3">Check In</th>
                <th className="px-3 py-3">Check Out</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((record) => (
                <tr key={record._id} className="border-t border-gray-100">
                  {isAdmin ? <td className="px-3 py-3 font-medium text-slate-800">{record.staffName}</td> : null}
                  <td className="px-3 py-3 text-slate-700">{record.dateKey}</td>
                  <td className="px-3 py-3 text-slate-700">{record.shiftName}</td>
                  <td className="px-3 py-3 text-slate-600">{formatDateTime(record.checkInAt)}</td>
                  <td className="px-3 py-3 text-slate-600">{formatDateTime(record.checkOutAt)}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${record.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))}
              {attendance.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-3 py-8 text-center text-slate-500">No attendance records found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
