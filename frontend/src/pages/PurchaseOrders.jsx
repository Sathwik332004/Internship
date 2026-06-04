import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, ChevronDown, ChevronUp, CheckCircle2,
  XCircle, Send, Trash2, Plus, Package, AlertTriangle,
  ClipboardList, Clock, TrendingDown, Pencil, Check, X
} from 'lucide-react';
import { toast } from 'react-toastify';
import { purchaseOrderAPI, supplierAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const STATUS_TABS = ['ALL', 'DRAFT', 'APPROVED', 'SENT', 'CANCELLED'];

const STATUS_STYLE = {
  DRAFT:     { label: 'Draft',     bg: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
  APPROVED:  { label: 'Approved',  bg: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  SENT:      { label: 'Sent',      bg: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-red-100 text-red-600',       dot: 'bg-red-400' }
};

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLE[status] || STATUS_STYLE.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
};

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ─── Inline qty editor ────────────────────────────────────────────────────────
const QtyCell = ({ item, poId, editable, onUpdated }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.requestedQty);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const qty = parseInt(val);
    if (isNaN(qty) || qty < 1) { toast.error('Quantity must be ≥ 1'); return; }
    try {
      setSaving(true);
      await purchaseOrderAPI.update(poId, {
        items: [{ itemId: item._id, requestedQty: qty }]
      });
      setEditing(false);
      onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update quantity');
    } finally {
      setSaving(false);
    }
  };

  if (!editable) return <span className="font-semibold">{item.requestedQty}</span>;

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          type="number"
          min={1}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="w-20 border border-slate-300 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        />
        <button onClick={save} disabled={saving} className="text-emerald-600 hover:text-emerald-800">
          <Check size={14} />
        </button>
        <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600">
          <X size={14} />
        </button>
      </span>
    );
  }

  return (
    <button
      className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-emerald-600 group"
      onClick={() => setEditing(true)}
    >
      {item.requestedQty}
      <Pencil size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
};

// ─── PO Row (expandable) ──────────────────────────────────────────────────────
const PORow = ({ po, onRefresh, isAdmin }) => {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);

  const act = async (fn, successMsg) => {
    try {
      setActing(true);
      await fn();
      toast.success(successMsg);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const isDraft = po.status === 'DRAFT';
  const isApproved = po.status === 'APPROVED';
  const isCancelled = po.status === 'CANCELLED';

  return (
    <>
      {/* Main row */}
      <tr
        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            <span className="font-mono font-semibold text-emerald-700 text-sm">{po.poNumber}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-slate-700">
          {po.supplier?.supplierName || po.supplierName || 'Unassigned'}
        </td>
        <td className="px-4 py-3 text-sm text-center text-slate-600">{po.items?.length ?? 0}</td>
        <td className="px-4 py-3 text-sm text-slate-500">{formatDate(po.createdAt)}</td>
        <td className="px-4 py-3">
          <StatusBadge status={po.status} />
          {po.generatedBy === 'AUTO' && (
            <span className="ml-2 text-xs text-slate-400">Auto</span>
          )}
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          {isAdmin && (
            <div className="flex items-center gap-1.5">
              {isDraft && (
                <>
                  <button
                    onClick={() => act(() => purchaseOrderAPI.approve(po._id), 'Purchase order approved')}
                    disabled={acting}
                    title="Approve"
                    className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 transition-colors"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                  <button
                    onClick={() => act(() => purchaseOrderAPI.cancel(po._id), 'Purchase order cancelled')}
                    disabled={acting}
                    title="Cancel"
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                  >
                    <XCircle size={16} />
                  </button>
                </>
              )}
              {isApproved && (
                <>
                  <button
                    onClick={() => act(() => purchaseOrderAPI.send(po._id), 'Marked as sent to supplier')}
                    disabled={acting}
                    title="Mark as Sent"
                    className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors"
                  >
                    <Send size={16} />
                  </button>
                  <button
                    onClick={() => act(() => purchaseOrderAPI.cancel(po._id), 'Purchase order cancelled')}
                    disabled={acting}
                    title="Cancel"
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                  >
                    <XCircle size={16} />
                  </button>
                </>
              )}
              {isCancelled && (
                <button
                  onClick={() => act(() => purchaseOrderAPI.delete(po._id), 'Purchase order deleted')}
                  disabled={acting}
                  title="Delete"
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          )}
        </td>
      </tr>

      {/* Expanded items */}
      {expanded && (
        <tr className="bg-slate-50">
          <td colSpan={6} className="px-6 pb-4 pt-2">
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-500 text-xs uppercase tracking-wide">
                    <th className="px-4 py-2 text-left">Medicine</th>
                    <th className="px-4 py-2 text-right">Current Stock</th>
                    <th className="px-4 py-2 text-right">Reorder Level</th>
                    <th className="px-4 py-2 text-right">Order Qty</th>
                    <th className="px-4 py-2 text-right">Last Price (₹)</th>
                    <th className="px-4 py-2 text-right">Est. Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((item) => (
                    <tr key={item._id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-800">{item.medicineName}</div>
                        {item.brandName && <div className="text-xs text-slate-400">{item.brandName}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={item.currentStock === 0 ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                          {item.currentStock}
                        </span>
                        {item.unit && <span className="text-xs text-slate-400 ml-1">{item.unit}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{item.reorderLevel}</td>
                      <td className="px-4 py-2.5 text-right">
                        <QtyCell
                          item={item}
                          poId={po._id}
                          editable={isAdmin && isDraft}
                          onUpdated={onRefresh}
                        />
                        {item.unit && <span className="text-xs text-slate-400 ml-1">{item.unit}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600">
                        {item.lastPurchasePrice > 0 ? `₹${item.lastPurchasePrice.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">
                        {item.lastPurchasePrice > 0
                          ? `₹${(item.lastPurchasePrice * item.requestedQty).toFixed(2)}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {po.items.some((i) => i.lastPurchasePrice > 0) && (
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td colSpan={5} className="px-4 py-2 text-right text-sm font-semibold text-slate-600">
                        Estimated Total
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-emerald-700">
                        ₹{po.items
                          .reduce((sum, i) => sum + (i.lastPurchasePrice || 0) * i.requestedQty, 0)
                          .toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>

              {po.notes && (
                <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-500">
                  <span className="font-medium">Notes:</span> {po.notes}
                </div>
              )}

              {po.approvedBy && (
                <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
                  Approved by {po.approvedBy.name || po.approvedBy.email} on {formatDate(po.approvedAt)}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PurchaseOrders() {
  const { isAdmin } = useAuth();
  const [pos, setPOs] = useState([]);
  const [statusCounts, setStatusCounts] = useState({ ALL: 0, DRAFT: 0, APPROVED: 0, SENT: 0, CANCELLED: 0 });
  const [activeTab, setActiveTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [runningReorder, setRunningReorder] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchPOs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await purchaseOrderAPI.getAll({
        status: activeTab === 'ALL' ? undefined : activeTab,
        search: search || undefined,
        page,
        limit: 20
      });
      setPOs(res.data.data || []);
      setStatusCounts(res.data.statusCounts || {});
      setTotalPages(res.data.totalPages || 1);
      setTotal(res.data.total || 0);
    } catch (err) {
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, page]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, search]);

  useEffect(() => {
    fetchPOs();
  }, [fetchPOs]);

  const handleRunReorder = async () => {
    try {
      setRunningReorder(true);
      const res = await purchaseOrderAPI.runReorder();
      toast.success(res.data.message);
      fetchPOs();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reorder check failed');
    } finally {
      setRunningReorder(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Purchase Orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Auto-generated draft POs from reorder thresholds
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={handleRunReorder}
            disabled={runningReorder}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
          >
            <RefreshCw size={16} className={runningReorder ? 'animate-spin' : ''} />
            {runningReorder ? 'Checking…' : 'Run Reorder Check'}
          </button>
        )}
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'DRAFT',     label: 'Draft',    icon: ClipboardList, color: 'text-amber-600 bg-amber-50 border-amber-200' },
          { key: 'APPROVED',  label: 'Approved', icon: CheckCircle2,  color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          { key: 'SENT',      label: 'Sent',     icon: Send,          color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { key: 'CANCELLED', label: 'Cancelled',icon: XCircle,       color: 'text-red-500 bg-red-50 border-red-200' }
        ].map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
              activeTab === key ? 'ring-2 ring-emerald-400 ' + color : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <Icon size={20} className={activeTab === key ? color.split(' ')[0] : 'text-slate-400'} />
            <div>
              <div className="text-2xl font-bold text-slate-800">{statusCounts[key] ?? 0}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Tab bar */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'ALL' ? `All (${statusCounts.ALL ?? 0})` : tab}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search PO, supplier, medicine…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw size={24} className="animate-spin mr-2" />
            Loading…
          </div>
        ) : pos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Package size={40} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">No purchase orders found</p>
            {activeTab === 'ALL' && isAdmin && (
              <p className="text-xs mt-1">
                Click <span className="font-semibold text-emerald-600">Run Reorder Check</span> to auto-generate draft POs for low-stock medicines
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">PO Number</th>
                    <th className="px-4 py-3 text-left">Supplier</th>
                    <th className="px-4 py-3 text-center">Items</th>
                    <th className="px-4 py-3 text-left">Created</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.map((po) => (
                    <PORow key={po._id} po={po} onRefresh={fetchPOs} isAdmin={isAdmin} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
                <span>{total} order{total !== 1 ? 's' : ''}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page === 1}
                    className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    Prev
                  </button>
                  <span className="px-3 py-1 font-medium">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    disabled={page === totalPages}
                    className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Info box */}
      <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
        <AlertTriangle size={18} className="shrink-0 mt-0.5 text-blue-500" />
        <div>
          <span className="font-semibold">How it works: </span>
          The system automatically checks stock levels every 6 hours. When a medicine's total stock drops at or below its
          reorder level, a <strong>Draft PO</strong> is created for its preferred supplier (or last purchase supplier).
          Review drafts, edit quantities inline, then <strong>Approve</strong> → <strong>Mark as Sent</strong> when the
          order is dispatched to the supplier. To set a preferred supplier per medicine, edit the medicine record.
        </div>
      </div>
    </div>
  );
}
