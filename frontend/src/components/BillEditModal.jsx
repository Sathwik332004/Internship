import React, { useEffect, useState } from 'react';
import { AlertCircle, CreditCard, Landmark, Save, Search, Smartphone, Trash2, X } from 'lucide-react';
import api from '../services/api';
import { normalizePhone, normalizeTextInput, validateBillingForm } from '../utils/validation';

const SHOP_STATE = 'Maharashtra';
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0));
const medId = (value) => (typeof value === 'string' ? value : value?._id || '');
const getBatchKey = (value) => String(
  value?.inventoryBatchId
  || value?._id
  || String(value?.batchNumber || '').trim().toUpperCase()
);
const getLineKey = (item) => String(
  item.inventoryBatchId
  || `${item.medicineId}-${String(item.batchNumber || '').trim().toUpperCase()}`
);
const getItemBaseQuantity = (item) => (
  item.isPack
    ? Number(item.quantity || 0) * Number(item.conversionFactor || 1)
    : Number(item.quantity || 0)
);

export default function BillEditModal({ bill, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customer, setCustomer] = useState({ name: '', phone: '', state: '', address: '' });
  const [items, setItems] = useState([]);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [amountPaid, setAmountPaid] = useState('');
  const [discountType, setDiscountType] = useState('PERCENT');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmountInput, setDiscountAmountInput] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const originalBatchRestoration = (bill.items || []).reduce((acc, item) => {
    const batchKey = getBatchKey({ inventoryBatchId: item.inventoryBatchId, batchNumber: item.batchNumber });
    acc[batchKey] = (acc[batchKey] || 0) + Number(item.unitQuantity || 0);
    return acc;
  }, {});

  const enrichItem = async (item) => {
    const medicineId = medId(item.medicine);
    const [medicineRes, batchRes] = await Promise.all([
      api.get(`/medicines/${medicineId}`),
      api.get(`/inventory/medicine/${medicineId}`, {
        params: { includeZeroStock: true, batch: item.batchNumber }
      })
    ]);

    const medicine = medicineRes.data?.data || {};
    const batch = (batchRes.data?.data || [])[0];
    const isPack = Number(item.packQuantity || 0) > 0 && Number(item.looseQuantity || 0) === 0;
    const quantity = Number(item.quantity || item.packQuantity || item.looseQuantity || 1);
    const inferredFactor = isPack && quantity > 0 ? Math.max(1, Number(item.unitQuantity || 0) / quantity) : 1;
    const conversionFactor = Number(medicine.conversionFactor) || inferredFactor || 1;
    const rate = Number(item.rate || 0);
    const batchKey = getBatchKey({ _id: batch?._id || item.inventoryBatchId, batchNumber: item.batchNumber });
    const restoredQuantity = Number(originalBatchRestoration[batchKey] || 0);

    return {
      medicineId,
      medicineName: item.medicineName || medicine.medicineName || '',
      brandName: item.brandName || medicine.brandName || '',
      batchNumber: item.batchNumber,
      expiryDate: batch?.expiryDate || item.expiryDate,
      baseUnit: medicine.baseUnit || 'TAB',
      conversionFactor,
      isPack,
      quantity,
      packMrp: isPack ? rate : rate * conversionFactor,
      looseMrp: isPack ? rate / conversionFactor : rate,
      gstPercent: Number(item.gstPercent || batch?.gstPercent || medicine.gstPercent || 0),
      availableStock: Number(batch?.quantityAvailable || 0) + restoredQuantity,
      inventoryBatchId: batch?._id || item.inventoryBatchId || null
    };
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const nextItems = await Promise.all((bill.items || []).map(enrichItem));
        if (cancelled) return;
        setCustomer({
          name: bill.customerName || '',
          phone: normalizePhone(bill.customerPhone || ''),
          state: bill.customerState || '',
          address: bill.customerAddress || ''
        });
        setItems(nextItems);
        setPaymentMode(bill.paymentMode || 'CASH');
        setAmountPaid(bill.amountPaid === undefined || bill.amountPaid === null ? '' : String(bill.amountPaid));
        const savedDiscountType = bill.discountType;
        const savedPercent = Number(bill.discountPercent || 0);
        const savedAmount = Number(bill.discountAmount || 0);
        if (savedDiscountType === 'PERCENT') {
          setDiscountType('PERCENT');
          setDiscountPercent(savedPercent);
          setDiscountAmountInput(0);
        } else if (savedDiscountType === 'AMOUNT') {
          setDiscountType('AMOUNT');
          setDiscountPercent(0);
          setDiscountAmountInput(savedAmount);
        } else if (savedPercent > 0) {
          setDiscountType('PERCENT');
          setDiscountPercent(savedPercent);
          setDiscountAmountInput(0);
        } else {
          setDiscountType('AMOUNT');
          setDiscountPercent(0);
          setDiscountAmountInput(savedAmount);
        }
      } catch (loadError) {
        if (!cancelled) {
          console.error(loadError);
          setError(loadError.response?.data?.message || 'Unable to load bill for editing');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [bill]);

  useEffect(() => {
    const q = searchTerm.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setShowSearch(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const medRes = await api.get('/medicines/search', { params: { q, limit: 10 } });
        let results = medRes.data?.data || [];
        if (!results.length) {
          const invRes = await api.get('/inventory', {
            params: { search: q, page: 1, limit: 50, sortBy: 'expiryDate', sortOrder: 'asc' }
          });
          results = (invRes.data?.data || []).map((entry) => ({
            _id: entry.medicine?._id,
            medicineName: entry.medicine?.medicineName,
            brandName: entry.medicine?.brandName,
            baseUnit: entry.medicine?.baseUnit,
            conversionFactor: entry.medicine?.conversionFactor,
            packSize: entry.medicine?.packSize,
            defaultSellingPrice: entry.mrp,
            inventoryBatches: [{
              _id: entry._id,
              batchNumber: entry.batchNumber,
              expiryDate: entry.expiryDate,
              quantityAvailable: entry.quantityAvailable,
              mrp: entry.mrp,
              gstPercent: entry.gstPercent
            }]
          }));
        }
        if (!cancelled) {
          setSearchResults(results.filter((entry) => entry?._id));
          setShowSearch(true);
        }
      } catch (searchError) {
        if (!cancelled) {
          console.error(searchError);
          setSearchResults([]);
          setShowSearch(true);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm]);

  const getAllocatableBatchForMedicine = async (medicine) => {
    const medicineLines = items.filter((item) => item.medicineId === medicine._id);
    let batches = Array.isArray(medicine.inventoryBatches) ? [...medicine.inventoryBatches] : [];

    if (!batches.length || medicineLines.length > 0) {
      const response = await api.get(`/inventory/medicine/${medicine._id}`, {
        params: { includeZeroStock: true }
      });
      batches = response.data?.data || [];
    }

    const validBatches = batches
      .filter((batch) => {
        const expiry = new Date(batch.expiryDate);
        expiry.setHours(23, 59, 59, 999);
        const batchKey = getBatchKey(batch);
        const totalEditableStock = Number(batch.quantityAvailable || 0) + Number(originalBatchRestoration[batchKey] || 0);
        return expiry >= new Date() && totalEditableStock > 0;
      })
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

    for (const batch of validBatches) {
      const batchKey = getBatchKey(batch);
      const existingLine = medicineLines.find((item) => getBatchKey(item) === batchKey);
      const batchCapacity = existingLine
        ? Number(existingLine.availableStock || 0)
        : Number(batch.quantityAvailable || 0) + Number(originalBatchRestoration[batchKey] || 0);
      const allocatedQuantity = existingLine ? getItemBaseQuantity(existingLine) : 0;

      if (allocatedQuantity < batchCapacity) {
        return { validBatches, selectedBatch: batch, existingLine, batchCapacity };
      }
    }

    return { validBatches, selectedBatch: null, existingLine: null, batchCapacity: 0 };
  };

  const addMedicine = async (medicine) => {
    const { validBatches, selectedBatch, existingLine, batchCapacity } = await getAllocatableBatchForMedicine(medicine);

    if (!validBatches.length || !selectedBatch) {
      setError(`No stock available for ${medicine.medicineName}`);
      return;
    }

    if (existingLine) {
      updateQuantity(getLineKey(existingLine), existingLine.quantity + 1);
      setSearchTerm('');
      setShowSearch(false);
      return;
    }

    const conversionFactor = Number(medicine.conversionFactor) || 1;
    const isPack = conversionFactor > 1 && medicine.baseUnit !== 'ml';
    const packMrp = Number(selectedBatch.mrp || medicine.defaultSellingPrice || 0);
    const looseMrp = conversionFactor > 0 ? packMrp / conversionFactor : packMrp;

    setItems((prev) => [...prev, {
      medicineId: medicine._id,
      medicineName: medicine.medicineName,
      brandName: medicine.brandName,
      batchNumber: selectedBatch.batchNumber,
      expiryDate: selectedBatch.expiryDate,
      baseUnit: medicine.baseUnit || 'TAB',
      conversionFactor,
      isPack,
      quantity: 1,
      packMrp,
      looseMrp,
      gstPercent: Number(selectedBatch.gstPercent || medicine.gstPercent || 0),
      availableStock: batchCapacity,
      inventoryBatchId: selectedBatch._id
    }]);
    setSearchTerm('');
    setShowSearch(false);
  };

  const updateQuantity = (lineKey, value) => {
    const next = Math.max(0, Number(value));
    if (!Number.isFinite(next)) return;
    const current = items.find((item) => getLineKey(item) === lineKey);
    if (current) {
      const baseQty = current.isPack ? next * current.conversionFactor : next;
      if (baseQty > current.availableStock) {
        setError(`Insufficient stock for ${current.medicineName}`);
        return;
      }
    }
    setError('');
    setItems((prev) => prev.map((item) => getLineKey(item) === lineKey ? { ...item, quantity: next } : item));
  };

  const toggleUnit = (lineKey) => {
    setItems((prev) => prev.map((item) => {
      if (getLineKey(item) !== lineKey || item.conversionFactor <= 1 || item.baseUnit === 'ml') return item;
      const nextIsPack = !item.isPack;
      const currentBaseQty = item.isPack ? item.quantity * item.conversionFactor : item.quantity;
      const nextQty = nextIsPack ? Math.ceil(currentBaseQty / item.conversionFactor) : currentBaseQty;
      const nextBaseQty = nextIsPack ? nextQty * item.conversionFactor : nextQty;
      if (nextBaseQty > item.availableStock) {
        setError(`Insufficient stock for ${item.medicineName}`);
        return item;
      }
      return { ...item, isPack: nextIsPack, quantity: nextQty };
    }));
  };

  const totals = items.reduce((acc, item) => {
    const unitRate = item.isPack ? item.packMrp : item.looseMrp;
    const baseRate = unitRate / (1 + item.gstPercent / 100);
    const gst = unitRate - baseRate;
    const gstAmount = gst * item.quantity;
    acc.subtotal += unitRate * item.quantity;
    acc.totalGst += gstAmount;
    if ((customer.state || '').trim().toLowerCase() !== SHOP_STATE.toLowerCase() && customer.state) acc.totalIgst += gstAmount;
    else {
      acc.totalCgst += gstAmount / 2;
      acc.totalSgst += gstAmount / 2;
    }
    return acc;
  }, { subtotal: 0, totalGst: 0, totalCgst: 0, totalSgst: 0, totalIgst: 0 });
  totals.discountAmount = discountType === 'PERCENT'
    ? (totals.subtotal * (discountPercent / 100))
    : Math.min(Number(discountAmountInput) || 0, totals.subtotal);
  totals.discountPercentApplied = discountType === 'PERCENT' ? Number(discountPercent || 0) : 0;
  totals.grandTotal = totals.subtotal - totals.discountAmount;
  totals.isInterstate = !!customer.state && customer.state.trim().toLowerCase() !== SHOP_STATE.toLowerCase();

  const paidValue = Number.parseFloat(amountPaid);
  const effectiveAmountPaid = Number.isFinite(paidValue) ? paidValue : totals.grandTotal;

  const save = async () => {
    const validationError = validateBillingForm({
      customerDetails: customer,
      discountType,
      discountPercent,
      discountAmount: discountAmountInput,
      subtotal: totals.subtotal,
      amountPaid,
      billItems: items
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        customerName: normalizeTextInput(customer.name).trim(),
        customerPhone: normalizePhone(customer.phone),
        customerState: normalizeTextInput(customer.state).trim(),
        customerAddress: normalizeTextInput(customer.address).trim(),
        isInterstate: totals.isInterstate,
        items: items.map((item) => {
          const rate = item.isPack ? item.packMrp : item.looseMrp;
          const unitQuantity = item.isPack ? item.quantity * item.conversionFactor : item.quantity;
          return {
            medicine: item.medicineId,
            inventoryBatchId: item.inventoryBatchId,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            quantity: item.quantity,
            packQuantity: item.isPack ? item.quantity : 0,
            looseQuantity: item.isPack ? 0 : item.quantity,
            unitQuantity,
            rate,
            gstPercent: item.gstPercent,
            discountPercent: 0,
            discountAmount: 0
          };
        }),
        discountPercent: totals.discountPercentApplied,
        discountAmount: discountType === 'AMOUNT' ? (Number(discountAmountInput) || 0) : totals.discountAmount,
        discountType,
        paymentMode,
        amountPaid: effectiveAmountPaid
      };
      const response = await api.put(`/bills/${bill._id}`, payload);
      onSaved?.(response.data?.data || null);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError.response?.data?.message || 'Unable to update bill');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Edit Bill</h2>
            <p className="text-sm text-gray-500">{bill.invoiceNumber}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100"><X size={18} /></button>
        </div>
        {loading ? (
          <div className="p-10 text-center text-gray-500">Loading bill editor...</div>
        ) : (
          <div className="grid gap-6 overflow-y-auto p-6 lg:grid-cols-[2fr,1fr]">
            <div className="space-y-4">
              {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} />{error}</div>}
              <div className="grid gap-3 rounded-xl border border-gray-200 p-4 md:grid-cols-2">
                <input value={customer.name} onChange={(e) => setCustomer((v) => ({ ...v, name: normalizeTextInput(e.target.value) }))} placeholder="Customer name" className="rounded-lg border border-gray-300 px-3 py-2" />
                <input value={customer.phone} onChange={(e) => setCustomer((v) => ({ ...v, phone: normalizePhone(e.target.value) }))} placeholder="Customer phone" className="rounded-lg border border-gray-300 px-3 py-2" />
                <input value={customer.state} onChange={(e) => setCustomer((v) => ({ ...v, state: normalizeTextInput(e.target.value) }))} placeholder="Customer state" className="rounded-lg border border-gray-300 px-3 py-2" />
                <input value={customer.address} onChange={(e) => setCustomer((v) => ({ ...v, address: normalizeTextInput(e.target.value) }))} placeholder="Customer address" className="rounded-lg border border-gray-300 px-3 py-2" />
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search medicine to add..." className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3" />
                  {showSearch && (
                    <div className="absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {searchResults.length ? searchResults.map((entry) => (
                        <button key={entry._id} onClick={() => addMedicine(entry)} className="flex w-full justify-between border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50">
                          <div><p className="font-medium text-gray-900">{entry.medicineName}</p><p className="text-xs text-gray-500">{entry.brandName}</p></div>
                          <span className="text-sm font-semibold text-gray-900">{money(entry.defaultSellingPrice || entry.inventoryBatches?.[0]?.mrp || 0)}</span>
                        </button>
                      )) : <div className="px-4 py-3 text-sm text-gray-500">No stocked medicines found.</div>}
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-gray-200">
                <div className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-900">Items</div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-3 text-left">Medicine</th><th className="px-3 py-3 text-center">Batch</th><th className="px-3 py-3 text-center">Unit</th><th className="px-3 py-3 text-center">Qty</th><th className="px-3 py-3 text-right">Rate</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((item) => {
                        const rate = item.isPack ? item.packMrp : item.looseMrp;
                        return (
                          <tr key={getLineKey(item)}>
                            <td className="px-3 py-3"><p className="font-medium text-gray-900">{item.medicineName}</p><p className="text-xs text-gray-500">{item.brandName}</p><p className="text-xs text-gray-400">Stock: {item.availableStock} {item.baseUnit}</p></td>
                            <td className="px-3 py-3 text-center text-sm text-gray-600">{item.batchNumber}</td>
                            <td className="px-3 py-3 text-center">{item.conversionFactor > 1 && item.baseUnit !== 'ml' ? <button onClick={() => toggleUnit(getLineKey(item))} className="rounded border border-gray-300 px-2 py-1 text-xs">{item.isPack ? 'Pack' : 'Loose'}</button> : <span className="text-xs text-gray-400">Fixed</span>}</td>
                            <td className="px-3 py-3"><div className="flex items-center justify-center gap-2"><button onClick={() => updateQuantity(getLineKey(item), item.quantity - 1)} className="h-8 w-8 rounded bg-gray-100">-</button><input type="number" min="0" value={item.quantity} onChange={(e) => updateQuantity(getLineKey(item), e.target.value)} className="w-20 rounded border border-gray-300 px-2 py-1 text-center" /><button onClick={() => updateQuantity(getLineKey(item), item.quantity + 1)} className="h-8 w-8 rounded bg-gray-100">+</button></div></td>
                            <td className="px-3 py-3 text-right text-sm font-medium">{money(rate)}</td>
                            <td className="px-3 py-3 text-right text-sm font-semibold">{money(rate * item.quantity)}</td>
                            <td className="px-3 py-3 text-right"><button onClick={() => setItems((prev) => prev.filter((entry) => getLineKey(entry) !== getLineKey(item)))} className="rounded p-2 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {[
                    { value: 'CASH', label: 'Cash', icon: null },
                    { value: 'UPI', label: 'UPI', icon: Smartphone },
                    { value: 'CARD', label: 'Card', icon: CreditCard },
                    { value: 'BANK', label: 'Bank', icon: Landmark }
                  ].map(({ value, label, icon: Icon }) => (
                    <button key={value} onClick={() => setPaymentMode(value)} className={`rounded-lg border px-2 py-2 text-xs font-medium ${paymentMode === value ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 text-gray-700'}`}>
                      {Icon ? <Icon size={14} className="mx-auto mb-1" /> : null}{label}
                    </button>
                  ))}
                </div>
                <input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="Amount paid" className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2" />
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('PERCENT');
                      setDiscountAmountInput(0);
                    }}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold ${discountType === 'PERCENT' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-700'}`}
                  >
                    Percent
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('AMOUNT');
                      setDiscountPercent(0);
                    }}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold ${discountType === 'AMOUNT' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-700'}`}
                  >
                    Amount
                  </button>
                </div>
                {discountType === 'PERCENT' ? (
                  <input type="number" value={discountPercent} onChange={(e) => setDiscountPercent(Math.min(Number.parseFloat(e.target.value) || 0, 100))} min="0" max="100" placeholder="Discount %" className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                ) : (
                  <input type="number" value={discountAmountInput} onChange={(e) => setDiscountAmountInput(Number.parseFloat(e.target.value) || 0)} min="0" step="0.01" placeholder="Discount Amount" className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                )}
              </div>
              <div className="rounded-xl bg-gray-900 p-4 text-white">
                <h3 className="mb-4 text-lg font-semibold">Updated Totals</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Subtotal</span><span>{money(totals.subtotal)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">GST</span><span>{money(totals.totalGst)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Discount ({discountType === 'PERCENT' ? `${Number(discountPercent || 0).toFixed(2)}%` : 'Amount'})</span><span>{money(totals.discountAmount)}</span></div>
                  <div className="flex justify-between border-t border-gray-700 pt-2 text-lg font-semibold"><span>Total</span><span className="text-green-400">{money(totals.grandTotal)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Paid</span><span>{money(effectiveAmountPaid)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">{effectiveAmountPaid - totals.grandTotal >= 0 ? 'Balance / Change' : 'Amount Due'}</span><span>{money(Math.abs(effectiveAmountPaid - totals.grandTotal))}</span></div>
                </div>
                <div className="mt-6 space-y-2">
                  <button onClick={save} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"><Save size={16} />{saving ? 'Saving...' : 'Save Bill Changes'}</button>
                  <button onClick={onClose} className="w-full rounded-lg border border-gray-600 px-4 py-3 font-semibold text-white hover:bg-gray-800">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
