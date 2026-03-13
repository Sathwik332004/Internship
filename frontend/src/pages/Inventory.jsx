import React, { useEffect, useState } from 'react';
import {
  Search,
  Package,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Trash2,
  History,
  IndianRupee
} from 'lucide-react';
import { toast } from 'react-toastify';
import { inventoryAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  normalizeNotes,
  validateDisposeForm
} from '../utils/validation';

const initialDisposeForm = {
  quantity: '',
  reason: 'DAMAGED',
  notes: ''
};

export default function Inventory() {
  const { isAdmin } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [disposals, setDisposals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [disposeSubmitting, setDisposeSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('expiryDate');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [filterExpiringSoon, setFilterExpiringSoon] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [disposeForm, setDisposeForm] = useState(initialDisposeForm);

  useEffect(() => {
    loadInventoryPage();
  }, [currentPage, searchTerm, sortBy, sortOrder, filterLowStock, filterExpiringSoon]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadInventoryPage = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchInventory(),
        fetchStats(),
        fetchDisposals()
      ]);
    } catch (error) {
      console.error('Error loading inventory page:', error);
      toast.error(error.response?.data?.message || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    const response = await inventoryAPI.getAll({
      page: currentPage,
      limit: 50,
      sortBy,
      sortOrder,
      search: searchTerm || undefined,
      lowStock: filterLowStock || undefined,
      expiringSoon: filterExpiringSoon || undefined
    });

    setInventory(response.data.data || []);
    setTotalPages(response.data.totalPages || 1);
  };

  const fetchStats = async () => {
    const response = await inventoryAPI.getStats();
    setStats(response.data.data || null);
  };

  const fetchDisposals = async () => {
    const response = await inventoryAPI.getDisposals({ limit: 8 });
    setDisposals(response.data.data || []);
  };

  const refreshData = async () => {
    try {
      setRefreshing(true);
      await Promise.all([
        fetchInventory(),
        fetchStats(),
        fetchDisposals()
      ]);
    } catch (error) {
      console.error('Error refreshing inventory:', error);
      toast.error(error.response?.data?.message || 'Failed to refresh inventory');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortBy(field);
    setSortOrder('asc');
  };

  const openDisposeModal = (item) => {
    setSelectedItem(item);
    setDisposeForm({
      quantity: item.quantityAvailable > 0 ? '1' : '',
      reason: 'DAMAGED',
      notes: ''
    });
  };

  const closeDisposeModal = () => {
    setSelectedItem(null);
    setDisposeForm(initialDisposeForm);
  };

  const handleDisposeSubmit = async (event) => {
    event.preventDefault();

    if (!selectedItem) {
      return;
    }

    const validationError = validateDisposeForm(disposeForm, selectedItem);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const quantity = Number(disposeForm.quantity);

    try {
      setDisposeSubmitting(true);
      await inventoryAPI.dispose(selectedItem._id, {
        quantity,
        reason: disposeForm.reason,
        notes: normalizeNotes(disposeForm.notes)
      });

      toast.success('Stock disposed and recorded');
      closeDisposeModal();
      await refreshData();
    } catch (error) {
      console.error('Error disposing inventory:', error);
      toast.error(error.response?.data?.message || 'Failed to dispose stock');
    } finally {
      setDisposeSubmitting(false);
    }
  };

  const getStockStatusBadge = (item) => {
    if (item.isLowStock) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
          <TrendingDown size={12} />
          Low Stock
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
        <TrendingUp size={12} />
        In Stock
      </span>
    );
  };

  const getExpiryBadge = (item) => {
    if (item.daysUntilExpiry <= 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
          <AlertCircle size={12} />
          Expired
        </span>
      );
    }

    if (item.isExpiringSoon) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
          <Clock size={12} />
          Expiring Soon
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
        {item.daysUntilExpiry} days
      </span>
    );
  };

  const getDisposalBadge = (disposal) => {
    const colorMap = {
      DAMAGED: 'bg-red-100 text-red-700',
      EXPIRED: 'bg-orange-100 text-orange-700',
      OTHER: 'bg-slate-100 text-slate-700'
    };

    return (
      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${colorMap[disposal.disposalReason] || colorMap.OTHER}`}>
        {disposal.disposalReason}
      </span>
    );
  };

  const formatDate = (date) => {
    if (!date) return '-';

    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    if (!date) return '-';

    return new Date(date).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const safeStats = stats || {
    batchCount: 0,
    totalItems: 0,
    lowStockCount: 0,
    expiringCount: 0,
    totalDisposedUnits: 0,
    totalDisposedValue: 0
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="mt-1 text-gray-600">
            Active stock stays clean while expired and damaged batches move into a disposal ledger.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshData}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-3">
              <Package className="text-blue-600" size={22} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Batches</p>
              <p className="text-2xl font-bold text-gray-900">{safeStats.batchCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-3">
              <Package className="text-green-600" size={22} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Stock Units</p>
              <p className="text-2xl font-bold text-gray-900">{safeStats.totalItems.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-100 p-3">
              <AlertTriangle className="text-red-600" size={22} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Low Stock</p>
              <p className="text-2xl font-bold text-gray-900">{safeStats.lowStockCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-3">
              <Clock className="text-orange-600" size={22} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Expiring Soon</p>
              <p className="text-2xl font-bold text-gray-900">{safeStats.expiringCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-3">
              <Trash2 className="text-amber-700" size={22} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Disposed Units</p>
              <p className="text-2xl font-bold text-gray-900">{safeStats.totalDisposedUnits.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 p-3">
              <IndianRupee className="text-slate-700" size={22} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Disposed Value</p>
              <p className="text-2xl font-bold text-gray-900">
                {safeStats.totalDisposedValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by medicine name or batch number..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilterLowStock(!filterLowStock)}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
                filterLowStock
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <TrendingDown size={16} />
              Low Stock
            </button>

            <button
              type="button"
              onClick={() => setFilterExpiringSoon(!filterExpiringSoon)}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
                filterExpiringSoon
                  ? 'border-orange-300 bg-orange-50 text-orange-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Clock size={16} />
              Expiring Soon
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-10 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
            <p className="mt-4 text-gray-600">Loading inventory...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Medicine</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Batch</th>
                    <th
                      className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 hover:bg-gray-100"
                      onClick={() => handleSort('expiryDate')}
                    >
                      Expiry {sortBy === 'expiryDate' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th
                      className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 hover:bg-gray-100"
                      onClick={() => handleSort('quantityAvailable')}
                    >
                      Available {sortBy === 'quantityAvailable' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Purchase Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">MRP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Supplier</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Action</th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {inventory.length > 0 ? (
                    inventory.map((item) => (
                      <tr key={item._id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-gray-900">{item.medicine?.medicineName || 'Unknown'}</p>
                            <p className="text-sm text-gray-500">{item.medicine?.brandName || '-'}</p>
                            {item.medicine?.baseUnit && (
                              <p className="text-xs text-gray-400">
                                Unit: {item.medicine.baseUnit}
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-900">{item.batchNumber || '-'}</td>

                        <td className="px-4 py-4">
                          <p className="text-sm text-gray-900">{formatDate(item.expiryDate)}</p>
                          <div className="mt-1">{getExpiryBadge(item)}</div>
                        </td>

                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-gray-900">
                            {item.quantityAvailable?.toLocaleString() || 0}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Disposed so far: {item.quantityDisposed?.toLocaleString() || 0}
                          </p>
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-900">
                          Rs. {item.purchasePrice?.toFixed(2) || '0.00'}
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-900">
                          Rs. {item.mrp?.toFixed(2) || '0.00'}
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-900">
                          {item.supplier?.supplierName || '-'}
                        </td>

                        <td className="px-4 py-4">{getStockStatusBadge(item)}</td>

                        {isAdmin && (
                          <td className="px-4 py-4">
                            <button
                              type="button"
                              onClick={() => openDisposeModal(item)}
                              disabled={!item.quantityAvailable}
                              className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 size={15} />
                              Dispose
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={isAdmin ? 9 : 8} className="px-4 py-10 text-center text-gray-500">
                        No active inventory batches found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <div className="text-sm text-gray-500">Showing {inventory.length} active batches</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
          <div className="flex items-center gap-2">
            <History size={18} className="text-gray-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Recent Disposal Records</h2>
              <p className="text-sm text-gray-600">
                Includes manual damage disposal and automatic expiry disposal.
              </p>
            </div>
          </div>

          {stats?.latestDisposedAt && (
            <p className="text-xs text-gray-500">
              Last disposal: {formatDateTime(stats.latestDisposedAt)}
            </p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Medicine</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Batch</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Disposed Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {disposals.length > 0 ? (
                disposals.map((disposal) => (
                  <tr key={disposal._id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm text-gray-700">{formatDateTime(disposal.disposedAt)}</td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900">{disposal.medicine?.medicineName || 'Unknown'}</p>
                      <p className="text-sm text-gray-500">{disposal.medicine?.brandName || '-'}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">{disposal.batchNumber}</td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">
                      {disposal.quantityDisposed?.toLocaleString() || 0}
                    </td>
                    <td className="px-4 py-4">{getDisposalBadge(disposal)}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{disposal.source === 'AUTO_EXPIRY' ? 'Auto Expiry' : 'Manual'}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      Rs. {((disposal.quantityDisposed || 0) * (disposal.purchasePrice || 0)).toFixed(2)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {disposal.disposedBy?.name || 'System'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    No disposal records yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Dispose Batch</h2>
              <p className="mt-1 text-sm text-gray-600">
                {selectedItem.medicine?.medicineName} | Batch {selectedItem.batchNumber}
              </p>
            </div>

            <form onSubmit={handleDisposeSubmit} className="space-y-4 px-6 py-5">
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Available stock: <span className="font-semibold">{selectedItem.quantityAvailable}</span>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Quantity to dispose</label>
                <input
                  type="number"
                  min="1"
                  max={selectedItem.quantityAvailable}
                  step="1"
                  value={disposeForm.quantity}
                  onChange={(event) => setDisposeForm((current) => ({ ...current, quantity: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Reason</label>
                <select
                  value={disposeForm.reason}
                  onChange={(event) => setDisposeForm((current) => ({ ...current, reason: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="DAMAGED">Damaged</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  rows="3"
                  value={disposeForm.notes}
                  onChange={(event) => setDisposeForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Optional note for the stock adjustment"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDisposeModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disposeSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 size={15} />
                  {disposeSubmitting ? 'Saving...' : 'Dispose Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
