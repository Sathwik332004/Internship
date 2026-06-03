import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Phone,
  Receipt,
  RotateCcw,
  Save,
  Search,
  User,
  XCircle
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const REFUND_MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Card' },
  { value: 'STORE_CREDIT', label: 'Store Credit' },
  { value: 'ADJUSTED_IN_NEXT_BILL', label: 'Adjusted in Next Bill' }
];

const STATUS_CONFIG = {
  PENDING_APPROVAL: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-amber-100 text-amber-800 border-amber-200'
  },
  APPROVED: {
    label: 'Approved',
    icon: CheckCircle,
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  },
  REJECTED: {
    label: 'Rejected',
    icon: XCircle,
    className: 'bg-red-100 text-red-800 border-red-200'
  }
};

const formatAmount = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatRefundMode = (value) => REFUND_MODES.find((mode) => mode.value === value)?.label || 'Cash';

const StatusBadge = ({ status }) => {
  const normalizedStatus = status || 'APPROVED';
  const config = STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG.PENDING_APPROVAL;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${config.className}`}>
      <Icon size={13} />
      {config.label}
    </span>
  );
};

const getItemUnitLabel = (item) => {
  const soldAsPack = Number(item.packQuantity || 0) > 0 && Number(item.looseQuantity || 0) === 0;
  return soldAsPack ? 'pack' : 'unit';
};

const getItemReturnState = (item, index, returnedByIndex, returnQuantities, selectedBill) => {
  const alreadyReturned = Number(returnedByIndex[index] || 0);
  const remainingQuantity = Math.max(Number(item.quantity || 0) - alreadyReturned, 0);
  const requestedQuantity = Math.min(Number(returnQuantities[index] || 0), remainingQuantity);
  const ratio = Number(item.quantity || 0) > 0 ? requestedQuantity / Number(item.quantity || 1) : 0;
  const previewAmount = Math.max(
    Number(item.total || 0) * ratio
    - (selectedBill?.subtotal
      ? (Number(selectedBill.discountAmount || 0) * (Number(item.rate || 0) * requestedQuantity))
        / Number(selectedBill.subtotal || 1)
      : 0),
    0
  );

  return {
    alreadyReturned,
    remainingQuantity,
    requestedQuantity,
    previewAmount
  };
};

export default function SalesReturns() {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const preselectedBillId = location.state?.billId || '';

  const [billSearch, setBillSearch] = useState('');
  const [billResults, setBillResults] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);

  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedBillLoading, setSelectedBillLoading] = useState(false);
  const [billReturnHistory, setBillReturnHistory] = useState([]);
  const [returnedByIndex, setReturnedByIndex] = useState({});

  const [returnQuantities, setReturnQuantities] = useState({});
  const [reason, setReason] = useState('');
  const [refundMode, setRefundMode] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [historySearch, setHistorySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [recentReturns, setRecentReturns] = useState([]);
  const [returnReport, setReturnReport] = useState(null);
  const [approvalLoadingId, setApprovalLoadingId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchBillResults = async (searchValue = '') => {
    try {
      setBillsLoading(true);
      const response = await api.get('/bills', {
        params: {
          page: 1,
          limit: 8,
          search: searchValue
        }
      });
      setBillResults(response.data?.data || []);
    } catch (fetchError) {
      console.error('Error fetching bills for sales return:', fetchError);
      setBillResults([]);
    } finally {
      setBillsLoading(false);
    }
  };

  const fetchRecentReturns = async (searchValue = '') => {
    try {
      setHistoryLoading(true);
      const response = await api.get('/sales-returns', {
        params: {
          page: 1,
          limit: 10,
          search: searchValue,
          status: statusFilter === 'ALL' ? undefined : statusFilter
        }
      });
      setRecentReturns(response.data?.data || []);
    } catch (fetchError) {
      console.error('Error fetching sales return history:', fetchError);
      setRecentReturns([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchReturnReport = async () => {
    try {
      const response = await api.get('/sales-returns/report');
      setReturnReport(response.data?.data || null);
    } catch (fetchError) {
      console.error('Error fetching sales return report:', fetchError);
      setReturnReport(null);
    }
  };

  const loadBill = async (billId) => {
    if (!billId) return;

    try {
      setSelectedBillLoading(true);
      setError('');

      const [billResponse, returnsResponse] = await Promise.all([
        api.get(`/bills/${billId}`),
        api.get('/sales-returns', {
          params: {
            billId,
            page: 1,
            limit: 100
          }
        })
      ]);

      const bill = billResponse.data?.data || null;
      const returns = returnsResponse.data?.data || [];
      const nextReturnedByIndex = returns.reduce((acc, salesReturn) => {
        (salesReturn.items || []).forEach((item) => {
          const key = Number(item.originalItemIndex);
          acc[key] = (acc[key] || 0) + Number(item.returnQuantity || 0);
        });
        return acc;
      }, {});

      setSelectedBill(bill);
      setBillReturnHistory(returns);
      setReturnedByIndex(nextReturnedByIndex);
      setReturnQuantities({});
    } catch (loadError) {
      console.error('Error loading bill for sales return:', loadError);
      setSelectedBill(null);
      setBillReturnHistory([]);
      setReturnedByIndex({});
      setReturnQuantities({});
      setError(loadError.response?.data?.message || 'Unable to load bill for sales return.');
    } finally {
      setSelectedBillLoading(false);
    }
  };

  useEffect(() => {
    fetchBillResults('');
    fetchRecentReturns('');
    fetchReturnReport();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBillResults(billSearch.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [billSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecentReturns(historySearch.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [historySearch, statusFilter]);

  useEffect(() => {
    if (preselectedBillId) {
      loadBill(preselectedBillId);
    }
  }, [preselectedBillId]);

  const updateReturnQuantity = (index, rawValue, maxQuantity) => {
    const nextValue = Number.parseInt(rawValue, 10);

    if (!Number.isFinite(nextValue)) {
      setReturnQuantities((prev) => ({ ...prev, [index]: 0 }));
      return;
    }

    const clampedValue = Math.max(0, Math.min(maxQuantity, nextValue));
    setReturnQuantities((prev) => ({ ...prev, [index]: clampedValue }));
  };

  const returnPreview = (selectedBill?.items || []).reduce(
    (acc, item, index) => {
      const requestedQuantity = Number(returnQuantities[index] || 0);
      if (!requestedQuantity) {
        return acc;
      }

      const originalQuantity = Number(item.quantity || 0);
      if (!originalQuantity) {
        return acc;
      }

      const ratio = requestedQuantity / originalQuantity;
      const subtotalShare = Number(item.rate || 0) * requestedQuantity;
      const discountShare = selectedBill?.subtotal
        ? (Number(selectedBill.discountAmount || 0) * subtotalShare) / Number(selectedBill.subtotal || 1)
        : 0;
      const totalShare = Math.max(Number(item.total || 0) * ratio - discountShare, 0);

      acc.items += 1;
      acc.quantity += requestedQuantity;
      acc.subtotal += subtotalShare;
      acc.discountAmount += discountShare;
      acc.totalGst += Number(item.gstAmount || 0) * ratio;
      acc.grandTotal += totalShare;
      return acc;
    },
    { items: 0, quantity: 0, subtotal: 0, discountAmount: 0, totalGst: 0, grandTotal: 0 }
  );

  const hasReturnSelection = returnPreview.items > 0;

  const handleSubmit = async () => {
    if (!selectedBill?._id) {
      setError('Select a bill before saving sales return.');
      return;
    }

    const items = Object.entries(returnQuantities)
      .map(([index, quantity]) => ({
        originalItemIndex: Number(index),
        returnQuantity: Number(quantity || 0)
      }))
      .filter((item) => item.returnQuantity > 0);

    if (!items.length) {
      setError('Enter at least one return quantity.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');

      const response = await api.post('/sales-returns', {
        billId: selectedBill._id,
        reason,
        refundMode,
        notes,
        items
      });

      const createdReturn = response.data?.data;
      setReason('');
      setRefundMode('CASH');
      setNotes('');
      setReturnQuantities({});

      await Promise.all([
        loadBill(selectedBill._id),
        fetchRecentReturns(historySearch.trim()),
        fetchReturnReport()
      ]);

      setSuccessMessage(createdReturn?.returnNumber
        ? `Sales return ${createdReturn.returnNumber} submitted for approval.`
        : 'Sales return submitted for approval.');
    } catch (saveError) {
      console.error('Error saving sales return:', saveError);
      setError(saveError.response?.data?.message || 'Unable to save sales return.');
    } finally {
      setSaving(false);
    }
  };

  const refreshReturnData = async () => {
    await Promise.all([
      fetchRecentReturns(historySearch.trim()),
      fetchReturnReport(),
      selectedBill?._id ? loadBill(selectedBill._id) : Promise.resolve()
    ]);
  };

  const handleApproveReturn = async (salesReturn) => {
    try {
      setApprovalLoadingId(salesReturn._id);
      setError('');
      setSuccessMessage('');

      const response = await api.patch(`/sales-returns/${salesReturn._id}/approve`);
      await refreshReturnData();
      setSuccessMessage(response.data?.message || `Sales return ${salesReturn.returnNumber} approved.`);
    } catch (approveError) {
      console.error('Error approving sales return:', approveError);
      setError(approveError.response?.data?.message || 'Unable to approve sales return.');
    } finally {
      setApprovalLoadingId(null);
    }
  };

  const openRejectModal = (salesReturn) => {
    setRejectTarget(salesReturn);
    setRejectionReason('');
    setError('');
    setSuccessMessage('');
  };

  const handleRejectReturn = async () => {
    if (!rejectTarget?._id) return;

    if (!rejectionReason.trim()) {
      setError('Enter a rejection reason before rejecting this return.');
      return;
    }

    try {
      setApprovalLoadingId(rejectTarget._id);
      const response = await api.patch(`/sales-returns/${rejectTarget._id}/reject`, {
        rejectionReason
      });
      setRejectTarget(null);
      setRejectionReason('');
      await refreshReturnData();
      setSuccessMessage(response.data?.message || `Sales return ${rejectTarget.returnNumber} rejected.`);
    } catch (rejectError) {
      console.error('Error rejecting sales return:', rejectError);
      setError(rejectError.response?.data?.message || 'Unable to reject sales return.');
    } finally {
      setApprovalLoadingId(null);
    }
  };

  const renderReturnCard = (entry) => {
    const isPending = entry.status === 'PENDING_APPROVAL';

    return (
      <div key={entry._id} className="rounded-xl border border-gray-200 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="break-all font-semibold text-gray-900">{entry.returnNumber}</div>
            <div className="mt-1 break-all text-sm text-gray-600">{entry.invoiceNumber}</div>
            <div className="mt-1 text-xs text-gray-500">
              {entry.customerName || 'Walk-in Customer'} - {formatDate(entry.returnDate)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={entry.status} />
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                {formatRefundMode(entry.refundMode)}
              </span>
            </div>
            {entry.reason && (
              <div className="mt-2 text-xs text-gray-500">Reason: {entry.reason}</div>
            )}
            {entry.rejectionReason && (
              <div className="mt-2 text-xs text-red-600">Rejected: {entry.rejectionReason}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-emerald-700">{formatAmount(entry.grandTotal)}</div>
            <div className="text-xs text-gray-500">{entry.items?.length || 0} lines</div>
          </div>
        </div>

        {isAdmin && isPending && (
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => handleApproveReturn(entry)}
              disabled={approvalLoadingId === entry._id}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle size={14} />
              {approvalLoadingId === entry._id ? 'Approving...' : 'Approve'}
            </button>
            <button
              type="button"
              onClick={() => openRejectModal(entry)}
              disabled={approvalLoadingId === entry._id}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <XCircle size={14} />
              Reject
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Return Approval</h1>
          <p className="mt-1 text-sm text-gray-600">
            Submit return requests, approve stock restoration, and track refund decisions.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
          <RotateCcw size={16} />
          Approval-based stock restoration
        </div>
      </div>

      {(error || successMessage) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          error
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-green-200 bg-green-50 text-green-700'
        }`}>
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error || successMessage}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { key: 'PENDING_APPROVAL', label: 'Pending Approval', color: 'text-amber-700', bg: 'bg-amber-50' },
          { key: 'APPROVED', label: 'Approved Returns', color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { key: 'REJECTED', label: 'Rejected Returns', color: 'text-red-700', bg: 'bg-red-50' }
        ].map((item) => {
          const total = returnReport?.statusTotals?.[item.key] || { count: 0, amount: 0 };
          return (
            <div key={item.key} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className={`mb-3 inline-flex rounded-xl px-3 py-2 text-sm font-semibold ${item.bg} ${item.color}`}>
                {item.label}
              </div>
              <div className="text-2xl font-bold text-gray-900">{total.count || 0}</div>
              <div className="mt-1 text-sm text-gray-500">{formatAmount(total.amount || 0)}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr,1.35fr]">
        <div className="space-y-6">
          <div className="hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm xl:block">
            <div className="mb-4 flex items-center gap-2">
              <Search size={18} className="text-emerald-600" />
              <h2 className="text-lg font-semibold text-gray-900">Search Bill</h2>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={billSearch}
                onChange={(event) => setBillSearch(event.target.value)}
                placeholder="Search invoice number, customer name, or phone..."
                className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1 sm:max-h-[30rem]">
              {billsLoading ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                  Loading bills...
                </div>
              ) : billResults.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                  No bills found.
                </div>
              ) : (
                billResults.map((bill) => (
                  <button
                    key={bill._id}
                    onClick={() => loadBill(bill._id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                      selectedBill?._id === bill._id
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-gray-900">{bill.invoiceNumber}</div>
                        <div className="mt-1 text-sm text-gray-600">{bill.customerName || 'Walk-in Customer'}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {formatDate(bill.billDate)}{bill.customerPhone ? ` â€¢ ${bill.customerPhone}` : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">{formatAmount(bill.grandTotal)}</div>
                        <div className="text-xs text-gray-500">{bill.items?.length || 0} items</div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-emerald-600" />
                <h2 className="text-lg font-semibold text-gray-900">Recent Sales Returns</h2>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder="Search returns..."
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 sm:max-w-[12rem]"
              >
                <option value="ALL">All statuses</option>
                <option value="PENDING_APPROVAL">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            {isAdmin && recentReturns.some((entry) => entry.status === 'PENDING_APPROVAL') && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <Clock size={16} />
                  Pending approval queue
                </div>
                <div className="space-y-3">
                  {recentReturns
                    .filter((entry) => entry.status === 'PENDING_APPROVAL')
                    .map(renderReturnCard)}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {historyLoading ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                  Loading return history...
                </div>
              ) : recentReturns.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                  No sales returns recorded yet.
                </div>
              ) : (
                recentReturns.map((entry) => (
                  <div key={entry._id} className="rounded-xl border border-gray-200 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="break-all font-semibold text-gray-900">{entry.returnNumber}</div>
                        <div className="mt-1 break-all text-sm text-gray-600">{entry.invoiceNumber}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {entry.customerName || 'Walk-in Customer'} â€¢ {formatDate(entry.returnDate)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-emerald-700">{formatAmount(entry.grandTotal)}</div>
                        <div className="text-xs text-gray-500">{entry.items?.length || 0} lines</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <FileText size={18} className="text-violet-600" />
              <h2 className="text-lg font-semibold text-gray-900">Return Entry</h2>
            </div>

            {selectedBillLoading ? (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-12 text-center text-sm text-gray-500">
                Loading selected bill...
              </div>
            ) : !selectedBill ? (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-12 text-center text-sm text-gray-500">
                Select a bill from the left to start a sales return.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 rounded-2xl bg-gray-50 p-4 lg:grid-cols-[1.2fr,0.8fr]">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Receipt size={15} className="text-gray-400" />
                      <span className="font-medium">{selectedBill.invoiceNumber}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Calendar size={15} className="text-gray-400" />
                      <span>{formatDate(selectedBill.billDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <User size={15} className="text-gray-400" />
                      <span>{selectedBill.customerName || 'Walk-in Customer'}</span>
                    </div>
                    {selectedBill.customerPhone && (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Phone size={15} className="text-gray-400" />
                        <span>{selectedBill.customerPhone}</span>
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl bg-white p-4">
                    <div className="text-sm text-gray-500">Original Bill Amount</div>
                    <div className="mt-1 text-2xl font-bold text-gray-900">{formatAmount(selectedBill.grandTotal)}</div>
                    <div className="mt-2 text-xs text-gray-500">
                      Discount: {formatAmount(selectedBill.discountAmount)} â€¢ GST: {formatAmount(selectedBill.totalGst)}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200">
                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[860px]">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Medicine</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Batch</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Sold</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Returned</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Remaining</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Return Qty</th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Line Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {selectedBill.items?.map((item, index) => {
                          const {
                            alreadyReturned,
                            remainingQuantity,
                            requestedQuantity,
                            previewAmount
                          } = getItemReturnState(item, index, returnedByIndex, returnQuantities, selectedBill);

                          return (
                            <tr key={`${item.medicineName}-${item.batchNumber}-${index}`} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">{item.medicineName}</div>
                                <div className="text-xs text-gray-500">{item.brandName || '-'}</div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{item.batchNumber}</td>
                              <td className="px-4 py-3 text-center text-sm text-gray-900">
                                {item.quantity} {getItemUnitLabel(item)}
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-amber-700">{alreadyReturned}</td>
                              <td className="px-4 py-3 text-center text-sm font-medium text-emerald-700">{remainingQuantity}</td>
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={remainingQuantity}
                                  value={returnQuantities[index] ?? ''}
                                  disabled={remainingQuantity <= 0}
                                  onChange={(event) => updateReturnQuantity(index, event.target.value, remainingQuantity)}
                                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-center focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                                />
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                                {requestedQuantity > 0 ? formatAmount(previewAmount) : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 p-3 lg:hidden">
                    {selectedBill.items?.map((item, index) => {
                      const {
                        alreadyReturned,
                        remainingQuantity,
                        requestedQuantity,
                        previewAmount
                      } = getItemReturnState(item, index, returnedByIndex, returnQuantities, selectedBill);

                      return (
                        <div
                          key={`${item.medicineName}-${item.batchNumber}-${index}`}
                          className="rounded-xl border border-gray-200 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-gray-900">{item.medicineName}</div>
                              <div className="truncate text-sm text-gray-500">{item.brandName || '-'}</div>
                            </div>
                            <div className="shrink-0 text-right text-sm">
                              <div className="font-medium text-gray-900">{formatAmount(item.rate)}</div>
                              <div className="text-xs text-gray-500">per {getItemUnitLabel(item)}</div>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-lg bg-gray-50 p-3">
                              <div className="text-xs uppercase tracking-wide text-gray-500">Batch</div>
                              <div className="mt-1 text-sm font-medium text-gray-900">{item.batchNumber}</div>
                            </div>
                            <div className="rounded-lg bg-gray-50 p-3">
                              <div className="text-xs uppercase tracking-wide text-gray-500">Sold</div>
                              <div className="mt-1 text-sm font-medium text-gray-900">
                                {item.quantity} {getItemUnitLabel(item)}
                              </div>
                            </div>
                            <div className="rounded-lg bg-gray-50 p-3">
                              <div className="text-xs uppercase tracking-wide text-gray-500">Returned</div>
                              <div className="mt-1 text-sm font-medium text-amber-700">{alreadyReturned}</div>
                            </div>
                            <div className="rounded-lg bg-gray-50 p-3">
                              <div className="text-xs uppercase tracking-wide text-gray-500">Remaining</div>
                              <div className="mt-1 text-sm font-medium text-emerald-700">{remainingQuantity}</div>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr),auto] sm:items-end">
                            <div>
                              <label className="mb-2 block text-sm font-medium text-gray-700">Return Quantity</label>
                              <input
                                type="number"
                                min="0"
                                max={remainingQuantity}
                                value={returnQuantities[index] ?? ''}
                                disabled={remainingQuantity <= 0}
                                onChange={(event) => updateReturnQuantity(index, event.target.value, remainingQuantity)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-center focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-gray-100 sm:text-left"
                              />
                            </div>
                            <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm sm:min-w-[10rem]">
                              <div className="text-gray-500">Line Value</div>
                              <div className="mt-1 font-semibold text-emerald-900">
                                {requestedQuantity > 0 ? formatAmount(previewAmount) : '-'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.2fr,0.8fr]">
                  <div className="space-y-4 rounded-2xl border border-gray-200 p-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Return Reason</label>
                      <input
                        type="text"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="e.g. Damaged strip, wrong medicine, customer cancelled"
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Refund Mode</label>
                      <select
                        value={refundMode}
                        onChange={(event) => setRefundMode(event.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                      >
                        {REFUND_MODES.map((mode) => (
                          <option key={mode.value} value={mode.value}>{mode.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Notes</label>
                      <textarea
                        rows="4"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Optional notes for this sales return..."
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-900 p-5 text-white 2xl:sticky 2xl:top-6">
                    <h3 className="text-lg font-semibold">Return Summary</h3>
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Selected lines</span>
                        <span>{returnPreview.items}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Return quantity</span>
                        <span>{returnPreview.quantity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Subtotal</span>
                        <span>{formatAmount(returnPreview.subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">GST</span>
                        <span>{formatAmount(returnPreview.totalGst)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Discount share</span>
                        <span>{formatAmount(returnPreview.discountAmount)}</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-700 pt-3 text-lg font-semibold">
                        <span>Return total</span>
                        <span className="text-emerald-400">{formatAmount(returnPreview.grandTotal)}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleSubmit}
                      disabled={!hasReturnSelection || saving}
                      className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-center font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save size={18} />
                      {saving ? 'Submitting Request...' : 'Submit for Approval'}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 p-4">
                  <h3 className="text-base font-semibold text-gray-900">Selected Bill Return History</h3>
                  <div className="mt-4 space-y-3">
                    {billReturnHistory.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                        No sales returns have been recorded for this bill yet.
                      </div>
                    ) : (
                      billReturnHistory.map((entry) => (
                        <div key={entry._id} className="rounded-xl border border-gray-200 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-gray-900">{entry.returnNumber}</div>
                              <div className="mt-1 text-sm text-gray-600">{formatDate(entry.returnDate)}</div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <StatusBadge status={entry.status} />
                                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                                  {formatRefundMode(entry.refundMode)}
                                </span>
                              </div>
                              {entry.reason && (
                                <div className="mt-1 text-xs text-gray-500">Reason: {entry.reason}</div>
                              )}
                              {entry.rejectionReason && (
                                <div className="mt-1 text-xs text-red-600">Rejected: {entry.rejectionReason}</div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-emerald-700">{formatAmount(entry.grandTotal)}</div>
                              <div className="text-xs text-gray-500">{entry.items?.length || 0} lines</div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm xl:hidden">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-emerald-600" />
                <h2 className="text-lg font-semibold text-gray-900">Recent Sales Returns</h2>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder="Search returns..."
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 sm:max-w-[12rem]"
              >
                <option value="ALL">All statuses</option>
                <option value="PENDING_APPROVAL">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div className="space-y-3">
              {historyLoading ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                  Loading return history...
                </div>
              ) : recentReturns.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                  No sales returns recorded yet.
                </div>
              ) : (
                recentReturns.map((entry) => (
                  <div key={entry._id} className="rounded-xl border border-gray-200 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="break-all font-semibold text-gray-900">{entry.returnNumber}</div>
                        <div className="mt-1 break-all text-sm text-gray-600">{entry.invoiceNumber}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {entry.customerName || 'Walk-in Customer'} â€¢ {formatDate(entry.returnDate)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-emerald-700">{formatAmount(entry.grandTotal)}</div>
                        <div className="text-xs text-gray-500">{entry.items?.length || 0} lines</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-3 text-red-700">
                <XCircle size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Reject Sales Return</h3>
                <p className="text-sm text-gray-500">{rejectTarget.returnNumber}</p>
              </div>
            </div>

            <label className="mb-2 block text-sm font-medium text-gray-700">Rejection Reason</label>
            <textarea
              rows="4"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Explain why this return request is rejected..."
              className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-red-500 focus:ring-2 focus:ring-red-500"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setRejectTarget(null);
                  setRejectionReason('');
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectReturn}
                disabled={approvalLoadingId === rejectTarget._id}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {approvalLoadingId === rejectTarget._id ? 'Rejecting...' : 'Reject Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
