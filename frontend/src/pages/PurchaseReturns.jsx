import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  FileText,
  Package,
  Receipt,
  RotateCcw,
  Save,
  Search,
  Truck
} from 'lucide-react';
import { inventoryAPI, purchaseAPI, purchaseReturnAPI } from '../services/api';

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

const formatExpiry = (value) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric'
  });
};

const normalizeBatch = (value = '') => String(value || '').trim().toUpperCase();

const getItemReturnState = (
  item,
  index,
  returnedByIndex,
  returnQuantities,
  returnFreeQuantities,
  availableByIndex
) => {
  const alreadyReturned = returnedByIndex[index] || { quantity: 0, freeQuantity: 0 };
  const conversionFactor = Math.max(Number(item.conversionFactor || 1), 1);
  const availableUnits = Number(availableByIndex[index] || 0);
  const availableQuantity = Math.max(Math.floor(availableUnits / conversionFactor), 0);
  const remainingQuantity = Math.max(Number(item.quantity || 0) - Number(alreadyReturned.quantity || 0), 0);
  const remainingFreeQuantity = Math.max(Number(item.freeQuantity || 0) - Number(alreadyReturned.freeQuantity || 0), 0);
  const requestedQuantity = Math.min(Number(returnQuantities[index] || 0), remainingQuantity, availableQuantity);
  const requestedFreeQuantity = Math.min(
    Number(returnFreeQuantities[index] || 0),
    remainingFreeQuantity,
    Math.max(availableQuantity - requestedQuantity, 0)
  );
  const maxReturnQuantity = Math.min(remainingQuantity, Math.max(availableQuantity - requestedFreeQuantity, 0));
  const maxReturnFreeQuantity = Math.min(remainingFreeQuantity, Math.max(availableQuantity - requestedQuantity, 0));
  const ratio = Number(item.quantity || 0) > 0 ? requestedQuantity / Number(item.quantity || 1) : 0;
  const previewAmount = Math.max(Number(item.totalAmount || 0) * ratio, 0);

  return {
    alreadyReturnedQuantity: Number(alreadyReturned.quantity || 0),
    alreadyReturnedFreeQuantity: Number(alreadyReturned.freeQuantity || 0),
    availableQuantity,
    remainingQuantity,
    remainingFreeQuantity,
    requestedQuantity,
    requestedFreeQuantity,
    maxReturnQuantity,
    maxReturnFreeQuantity,
    previewAmount
  };
};

export default function PurchaseReturns() {
  const location = useLocation();
  const preselectedPurchaseId = location.state?.purchaseId || '';

  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [purchaseResults, setPurchaseResults] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);

  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [selectedPurchaseLoading, setSelectedPurchaseLoading] = useState(false);
  const [purchaseReturnHistory, setPurchaseReturnHistory] = useState([]);
  const [returnedByIndex, setReturnedByIndex] = useState({});
  const [availableByIndex, setAvailableByIndex] = useState({});

  const [returnQuantities, setReturnQuantities] = useState({});
  const [returnFreeQuantities, setReturnFreeQuantities] = useState({});
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [historySearch, setHistorySearch] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [recentReturns, setRecentReturns] = useState([]);

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchPurchaseResults = async (searchValue = '') => {
    try {
      setPurchasesLoading(true);
      const response = await purchaseAPI.getAll({
        page: 1,
        limit: 8,
        search: searchValue
      });
      setPurchaseResults(response.data?.data || []);
    } catch (fetchError) {
      console.error('Error fetching purchases for purchase return:', fetchError);
      setPurchaseResults([]);
    } finally {
      setPurchasesLoading(false);
    }
  };

  const fetchRecentReturns = async (searchValue = '') => {
    try {
      setHistoryLoading(true);
      const response = await purchaseReturnAPI.getAll({
        page: 1,
        limit: 10,
        search: searchValue
      });
      setRecentReturns(response.data?.data || []);
    } catch (fetchError) {
      console.error('Error fetching purchase return history:', fetchError);
      setRecentReturns([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchCurrentAvailability = async (purchase) => {
    const items = Array.isArray(purchase?.items) ? purchase.items : [];

    const entries = await Promise.all(items.map(async (item, index) => {
      try {
        const medicineId = item.medicine?._id || item.medicine;
        if (!medicineId) {
          return [index, 0];
        }

        const response = await inventoryAPI.getByMedicine(medicineId, {
          includeZeroStock: 'true'
        });

        const inventoryItems = response.data?.data || [];
        const matchedBatch = inventoryItems.find(
          (entry) => normalizeBatch(entry.batchNumber) === normalizeBatch(item.batchNumber)
        );

        return [index, Number(matchedBatch?.quantityAvailable || 0)];
      } catch (availabilityError) {
        console.error('Error fetching current stock for purchase return:', availabilityError);
        return [index, 0];
      }
    }));

    return Object.fromEntries(entries);
  };

  const loadPurchase = async (purchaseId) => {
    if (!purchaseId) return;

    try {
      setSelectedPurchaseLoading(true);
      setError('');

      const [purchaseResponse, returnsResponse] = await Promise.all([
        purchaseAPI.getOne(purchaseId),
        purchaseReturnAPI.getAll({
          purchaseId,
          page: 1,
          limit: 100
        })
      ]);

      const purchase = purchaseResponse.data?.data || null;
      const returns = returnsResponse.data?.data || [];
      const nextAvailableByIndex = await fetchCurrentAvailability(purchase);
      const nextReturnedByIndex = returns.reduce((acc, purchaseReturn) => {
        (purchaseReturn.items || []).forEach((item) => {
          const key = Number(item.originalItemIndex);
          if (!acc[key]) {
            acc[key] = { quantity: 0, freeQuantity: 0 };
          }

          acc[key].quantity += Number(item.returnQuantity || 0);
          acc[key].freeQuantity += Number(item.returnFreeQuantity || 0);
        });

        return acc;
      }, {});

      setSelectedPurchase(purchase);
      setPurchaseReturnHistory(returns);
      setReturnedByIndex(nextReturnedByIndex);
      setAvailableByIndex(nextAvailableByIndex);
      setReturnQuantities({});
      setReturnFreeQuantities({});
    } catch (loadError) {
      console.error('Error loading purchase for purchase return:', loadError);
      setSelectedPurchase(null);
      setPurchaseReturnHistory([]);
      setReturnedByIndex({});
      setAvailableByIndex({});
      setReturnQuantities({});
      setReturnFreeQuantities({});
      setError(loadError.response?.data?.message || 'Unable to load purchase for purchase return.');
    } finally {
      setSelectedPurchaseLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchaseResults('');
    fetchRecentReturns('');
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPurchaseResults(purchaseSearch.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [purchaseSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecentReturns(historySearch.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [historySearch]);

  useEffect(() => {
    if (preselectedPurchaseId) {
      loadPurchase(preselectedPurchaseId);
    }
  }, [preselectedPurchaseId]);

  const updateReturnQuantity = (index, rawValue, maxQuantity) => {
    const nextValue = Number.parseInt(rawValue, 10);

    if (!Number.isFinite(nextValue)) {
      setReturnQuantities((prev) => ({ ...prev, [index]: 0 }));
      return;
    }

    const clampedValue = Math.max(0, Math.min(maxQuantity, nextValue));
    setReturnQuantities((prev) => ({ ...prev, [index]: clampedValue }));
  };

  const updateFreeReturnQuantity = (index, rawValue, maxQuantity) => {
    const nextValue = Number.parseInt(rawValue, 10);

    if (!Number.isFinite(nextValue)) {
      setReturnFreeQuantities((prev) => ({ ...prev, [index]: 0 }));
      return;
    }

    const clampedValue = Math.max(0, Math.min(maxQuantity, nextValue));
    setReturnFreeQuantities((prev) => ({ ...prev, [index]: clampedValue }));
  };

  const returnPreview = (selectedPurchase?.items || []).reduce(
    (acc, item, index) => {
      const requestedQuantity = Number(returnQuantities[index] || 0);
      const requestedFreeQuantity = Number(returnFreeQuantities[index] || 0);

      if (!requestedQuantity && !requestedFreeQuantity) {
        return acc;
      }

      const originalQuantity = Number(item.quantity || 0);
      const ratio = originalQuantity > 0 ? requestedQuantity / originalQuantity : 0;

      acc.lines += 1;
      acc.quantity += requestedQuantity;
      acc.freeQuantity += requestedFreeQuantity;
      acc.subtotal += Number(item.subtotal || 0) * ratio;
      acc.discountAmount += Number(item.discountAmount || 0) * ratio;
      acc.totalGst += Number(item.gstAmount || 0) * ratio;
      acc.grandTotal += Number(item.totalAmount || 0) * ratio;
      return acc;
    },
    { lines: 0, quantity: 0, freeQuantity: 0, subtotal: 0, discountAmount: 0, totalGst: 0, grandTotal: 0 }
  );

  const hasReturnSelection = returnPreview.lines > 0;

  const handleSubmit = async () => {
    if (!selectedPurchase?._id) {
      setError('Select a purchase before saving purchase return.');
      return;
    }

    const items = Object.keys({
      ...returnQuantities,
      ...returnFreeQuantities
    })
      .map((index) => ({
        originalItemIndex: Number(index),
        returnQuantity: Number(returnQuantities[index] || 0),
        returnFreeQuantity: Number(returnFreeQuantities[index] || 0)
      }))
      .filter((item) => item.returnQuantity > 0 || item.returnFreeQuantity > 0);

    if (!items.length) {
      setError('Enter at least one return quantity.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');

      const response = await purchaseReturnAPI.create({
        purchaseId: selectedPurchase._id,
        reason,
        notes,
        items
      });

      const createdReturn = response.data?.data;
      setReason('');
      setNotes('');
      setReturnQuantities({});
      setReturnFreeQuantities({});

      await Promise.all([
        loadPurchase(selectedPurchase._id),
        fetchRecentReturns(historySearch.trim())
      ]);

      setSuccessMessage(createdReturn?.returnNumber
        ? `Purchase return ${createdReturn.returnNumber} saved successfully.`
        : 'Purchase return saved successfully.');
    } catch (saveError) {
      console.error('Error saving purchase return:', saveError);
      setError(saveError.response?.data?.message || 'Unable to save purchase return.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Return</h1>
          <p className="mt-1 text-sm text-gray-600">
            Process supplier-facing returns without editing the original purchase entry.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
          <RotateCcw size={16} />
          Separate stock deduction flow
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

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[1.05fr,1.35fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Search size={18} className="text-emerald-600" />
              <h2 className="text-lg font-semibold text-gray-900">Search Purchase</h2>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={purchaseSearch}
                onChange={(event) => setPurchaseSearch(event.target.value)}
                placeholder="Search purchase number or supplier invoice..."
                className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1 sm:max-h-[30rem]">
              {purchasesLoading ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                  Loading purchases...
                </div>
              ) : purchaseResults.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                  No purchases found.
                </div>
              ) : (
                purchaseResults.map((purchase) => (
                  <button
                    key={purchase._id}
                    onClick={() => loadPurchase(purchase._id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                      selectedPurchase?._id === purchase._id
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-gray-900">{purchase.purchaseNumber}</div>
                        <div className="mt-1 text-sm text-gray-600">{purchase.supplierInvoiceNumber}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {purchase.supplier?.supplierName || 'Supplier'} | {formatDate(purchase.purchaseDate)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">{formatAmount(purchase.grandTotal)}</div>
                        <div className="text-xs text-gray-500">{purchase.items?.length || 0} items</div>
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
                <h2 className="text-lg font-semibold text-gray-900">Recent Purchase Returns</h2>
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
            </div>

            <div className="space-y-3">
              {historyLoading ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                  Loading return history...
                </div>
              ) : recentReturns.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                  No purchase returns recorded yet.
                </div>
              ) : (
                recentReturns.map((entry) => (
                  <div key={entry._id} className="rounded-xl border border-gray-200 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="break-all font-semibold text-gray-900">{entry.returnNumber}</div>
                        <div className="mt-1 break-all text-sm text-gray-600">{entry.purchaseNumber}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {entry.supplierName || 'Supplier'} | {formatDate(entry.returnDate)}
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

            {selectedPurchaseLoading ? (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-12 text-center text-sm text-gray-500">
                Loading selected purchase...
              </div>
            ) : !selectedPurchase ? (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-12 text-center text-sm text-gray-500">
                Select a purchase from the left to start a purchase return.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 rounded-2xl bg-gray-50 p-4 lg:grid-cols-[1.2fr,0.8fr]">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Package size={15} className="text-gray-400" />
                      <span className="font-medium">{selectedPurchase.purchaseNumber}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Receipt size={15} className="text-gray-400" />
                      <span>{selectedPurchase.supplierInvoiceNumber}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Calendar size={15} className="text-gray-400" />
                      <span>{formatDate(selectedPurchase.purchaseDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Truck size={15} className="text-gray-400" />
                      <span>{selectedPurchase.supplier?.supplierName || 'Supplier'}</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white p-4">
                    <div className="text-sm text-gray-500">Original Purchase Amount</div>
                    <div className="mt-1 text-2xl font-bold text-gray-900">{formatAmount(selectedPurchase.grandTotal)}</div>
                    <div className="mt-2 text-xs text-gray-500">
                      Discount: {formatAmount(selectedPurchase.discountAmount)} | GST: {formatAmount(selectedPurchase.totalGst)}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200">
                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[1100px]">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Medicine</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Batch</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Qty</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Free</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Returned Qty</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Returned Free</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Remaining Qty</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Remaining Free</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Available</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Return Qty</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Return Free</th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Line Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {selectedPurchase.items?.map((item, index) => {
                          const {
                            alreadyReturnedQuantity,
                            alreadyReturnedFreeQuantity,
                            availableQuantity,
                            remainingQuantity,
                            remainingFreeQuantity,
                            requestedQuantity,
                            requestedFreeQuantity,
                            maxReturnQuantity,
                            maxReturnFreeQuantity,
                            previewAmount
                          } = getItemReturnState(
                            item,
                            index,
                            returnedByIndex,
                            returnQuantities,
                            returnFreeQuantities,
                            availableByIndex
                          );

                          return (
                            <tr key={`${item.medicineName || index}-${item.batchNumber}-${index}`} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">{item.medicine?.medicineName || item.medicineName}</div>
                                <div className="text-xs text-gray-500">
                                  {item.medicine?.brandName || item.brandName || '-'} | Exp {formatExpiry(item.expiryDate)}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{item.batchNumber || '-'}</td>
                              <td className="px-4 py-3 text-center text-sm text-gray-900">{item.quantity || 0}</td>
                              <td className="px-4 py-3 text-center text-sm text-gray-900">{item.freeQuantity || 0}</td>
                              <td className="px-4 py-3 text-center text-sm text-amber-700">{alreadyReturnedQuantity}</td>
                              <td className="px-4 py-3 text-center text-sm text-amber-700">{alreadyReturnedFreeQuantity}</td>
                              <td className="px-4 py-3 text-center text-sm font-medium text-emerald-700">{remainingQuantity}</td>
                              <td className="px-4 py-3 text-center text-sm font-medium text-emerald-700">{remainingFreeQuantity}</td>
                              <td className="px-4 py-3 text-center text-sm font-medium text-sky-700">{availableQuantity}</td>
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={maxReturnQuantity}
                                  value={returnQuantities[index] ?? ''}
                                  disabled={maxReturnQuantity <= 0}
                                  onChange={(event) => updateReturnQuantity(index, event.target.value, maxReturnQuantity)}
                                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-center focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                                />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={maxReturnFreeQuantity}
                                  value={returnFreeQuantities[index] ?? ''}
                                  disabled={maxReturnFreeQuantity <= 0}
                                  onChange={(event) => updateFreeReturnQuantity(index, event.target.value, maxReturnFreeQuantity)}
                                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-center focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                                />
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                                {requestedQuantity > 0 || requestedFreeQuantity > 0 ? formatAmount(previewAmount) : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 p-3 lg:hidden">
                    {selectedPurchase.items?.map((item, index) => {
                      const {
                        alreadyReturnedQuantity,
                        alreadyReturnedFreeQuantity,
                        availableQuantity,
                        remainingQuantity,
                        remainingFreeQuantity,
                        requestedQuantity,
                        requestedFreeQuantity,
                        maxReturnQuantity,
                        maxReturnFreeQuantity,
                        previewAmount
                      } = getItemReturnState(
                        item,
                        index,
                        returnedByIndex,
                        returnQuantities,
                        returnFreeQuantities,
                        availableByIndex
                      );

                      return (
                        <div
                          key={`${item.medicineName || index}-${item.batchNumber}-${index}`}
                          className="rounded-xl border border-gray-200 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-gray-900">{item.medicine?.medicineName || item.medicineName}</div>
                              <div className="truncate text-sm text-gray-500">{item.medicine?.brandName || item.brandName || '-'}</div>
                            </div>
                            <div className="shrink-0 text-right text-sm">
                              <div className="font-medium text-gray-900">{formatAmount(item.purchasePrice)}</div>
                              <div className="text-xs text-gray-500">purchase rate</div>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-lg bg-gray-50 p-3">
                              <div className="text-xs uppercase tracking-wide text-gray-500">Batch</div>
                              <div className="mt-1 text-sm font-medium text-gray-900">{item.batchNumber || '-'}</div>
                            </div>
                            <div className="rounded-lg bg-gray-50 p-3">
                              <div className="text-xs uppercase tracking-wide text-gray-500">Qty / Free</div>
                              <div className="mt-1 text-sm font-medium text-gray-900">{item.quantity || 0} / {item.freeQuantity || 0}</div>
                            </div>
                            <div className="rounded-lg bg-gray-50 p-3">
                              <div className="text-xs uppercase tracking-wide text-gray-500">Returned</div>
                              <div className="mt-1 text-sm font-medium text-amber-700">{alreadyReturnedQuantity} / {alreadyReturnedFreeQuantity}</div>
                            </div>
                            <div className="rounded-lg bg-gray-50 p-3">
                              <div className="text-xs uppercase tracking-wide text-gray-500">Remaining</div>
                              <div className="mt-1 text-sm font-medium text-emerald-700">{remainingQuantity} / {remainingFreeQuantity}</div>
                            </div>
                            <div className="rounded-lg bg-gray-50 p-3">
                              <div className="text-xs uppercase tracking-wide text-gray-500">Available</div>
                              <div className="mt-1 text-sm font-medium text-sky-700">{availableQuantity}</div>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm font-medium text-gray-700">Return Quantity</label>
                              <input
                                type="number"
                                min="0"
                                max={maxReturnQuantity}
                                value={returnQuantities[index] ?? ''}
                                disabled={maxReturnQuantity <= 0}
                                onChange={(event) => updateReturnQuantity(index, event.target.value, maxReturnQuantity)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-center focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                              />
                            </div>
                            <div>
                              <label className="mb-2 block text-sm font-medium text-gray-700">Return Free Qty</label>
                              <input
                                type="number"
                                min="0"
                                max={maxReturnFreeQuantity}
                                value={returnFreeQuantities[index] ?? ''}
                                disabled={maxReturnFreeQuantity <= 0}
                                onChange={(event) => updateFreeReturnQuantity(index, event.target.value, maxReturnFreeQuantity)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-center focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                              />
                            </div>
                          </div>

                          <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm">
                            <div className="text-gray-500">Return Value</div>
                            <div className="mt-1 font-semibold text-emerald-900">
                              {requestedQuantity > 0 || requestedFreeQuantity > 0 ? formatAmount(previewAmount) : '-'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr,0.8fr]">
                  <div className="space-y-4 rounded-2xl border border-gray-200 p-4">
                    <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Free quantity affects stock only. Return value is calculated from paid quantity.
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Return Reason</label>
                      <input
                        type="text"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="e.g. Damaged batch, overstock, expiry risk"
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Notes</label>
                      <textarea
                        rows="4"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Optional notes for this purchase return..."
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-900 p-5 text-white xl:sticky xl:top-6">
                    <h3 className="text-lg font-semibold">Return Summary</h3>
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Selected lines</span>
                        <span>{returnPreview.lines}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Return qty</span>
                        <span>{returnPreview.quantity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Return free qty</span>
                        <span>{returnPreview.freeQuantity}</span>
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
                      className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save size={18} />
                      {saving ? 'Saving Return...' : 'Save Purchase Return'}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 p-4">
                  <h3 className="text-base font-semibold text-gray-900">Selected Purchase Return History</h3>
                  <div className="mt-4 space-y-3">
                    {purchaseReturnHistory.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                        No purchase returns have been recorded for this purchase yet.
                      </div>
                    ) : (
                      purchaseReturnHistory.map((entry) => (
                        <div key={entry._id} className="rounded-xl border border-gray-200 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-gray-900">{entry.returnNumber}</div>
                              <div className="mt-1 text-sm text-gray-600">{formatDate(entry.returnDate)}</div>
                              {entry.reason && (
                                <div className="mt-1 text-xs text-gray-500">Reason: {entry.reason}</div>
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
        </div>
      </div>
    </div>
  );
}
