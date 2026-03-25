import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Plus, Eye, Trash2, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Calendar, DollarSign, Package, AlertTriangle, Clock, Hash, Save, Pill, Check, Pencil } from 'lucide-react';
import api from '../services/api';
import {
  normalizeTextInput,
  normalizeUppercase,
  validatePurchaseForm
} from '../utils/validation';

// Unit options for dropdown
const UNIT_OPTIONS = [
  'tablet', 'capsule', 'piece', 'ml', 'bottle', 
  'vial', 'ampoule', 'gram', 'tube', 'strip', 'box', 'carton'
];

const EXPIRY_MONTH_OPTIONS = [
  { value: '01', label: 'Jan' },
  { value: '02', label: 'Feb' },
  { value: '03', label: 'Mar' },
  { value: '04', label: 'Apr' },
  { value: '05', label: 'May' },
  { value: '06', label: 'Jun' },
  { value: '07', label: 'Jul' },
  { value: '08', label: 'Aug' },
  { value: '09', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' }
];

const EXPIRY_MONTH_LOOKUP = EXPIRY_MONTH_OPTIONS.reduce((acc, option) => {
  acc[option.label.toLowerCase()] = option.value;
  acc[option.label.toLowerCase().slice(0, 3)] = option.value;
  return acc;
}, {});

// Column configuration for grid - ERP Style with fixed column widths
const GRID_COLUMNS = [
  { key: 'product', label: 'PRODUCT', className: 'product-col', editable: true, isSearch: true },
  { key: 'pack', label: 'PACK', className: 'pack-col', editable: true },
  { key: 'batch', label: 'BATCH', className: 'batch-col', editable: true },
  { key: 'expiry', label: 'EXPIRY', className: 'expiry-col', editable: true },
  { key: 'qty', label: 'QTY', className: 'qty-col numeric-col', editable: true },
  { key: 'free', label: 'FREE', className: 'free-col numeric-col', editable: true },
  { key: 'mrp', label: 'MRP', className: 'mrp-col numeric-col', editable: true },
  { key: 'rate', label: 'PURCHASE RATE', className: 'rate-col numeric-col', editable: true },
  { key: 'hsn', label: 'HSN', className: 'hsn-col', editable: true },
  { key: 'disc', label: 'DISC%', className: 'disc-col numeric-col', editable: true },
  { key: 'amount', label: 'AMOUNT', className: 'amount-col numeric-col', editable: false, isAmount: true },
  { key: 'actions', label: '', className: 'delete-col', editable: false }
];

const normalizeExpiryInput = (value = '') => {
  const trimmed = String(value).trim();
  if (!trimmed) {
    return '';
  }

  const yearMonthMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})$/);
  if (yearMonthMatch) {
    const [, year, month] = yearMonthMatch;
    const monthNum = Number(month);
    if (monthNum >= 1 && monthNum <= 12) {
      return `${year}-${String(monthNum).padStart(2, '0')}`;
    }
  }

  const monthYearMatch = trimmed.match(/^(\d{1,2})[-/](\d{2}|\d{4})$/);
  if (monthYearMatch) {
    const [, month, yearPart] = monthYearMatch;
    const monthNum = Number(month);
    if (monthNum >= 1 && monthNum <= 12) {
      const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
      return `${year}-${String(monthNum).padStart(2, '0')}`;
    }
  }

  const digitsOnlyMatch = trimmed.replace(/\D/g, '').match(/^(\d{2})(\d{2}|\d{4})$/);
  if (digitsOnlyMatch) {
    const [, month, yearPart] = digitsOnlyMatch;
    const monthNum = Number(month);
    if (monthNum >= 1 && monthNum <= 12) {
      const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
      return `${year}-${String(monthNum).padStart(2, '0')}`;
    }
  }

  const textMonthMatch = trimmed.match(/^([a-zA-Z]+)\s+(\d{2}|\d{4})$/);
  if (textMonthMatch) {
    const [, monthText, yearPart] = textMonthMatch;
    const month = EXPIRY_MONTH_LOOKUP[monthText.toLowerCase()];
    if (month) {
      const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
      return `${year}-${month}`;
    }
  }

  return '';
};

const formatExpiryDisplay = (value = '') => {
  const normalized = normalizeExpiryInput(value) || String(value).trim();
  const match = normalized.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return String(value || '');
  }

  const [, year, month] = match;
  const monthLabel = EXPIRY_MONTH_OPTIONS.find((option) => option.value === month)?.label || month;
  return `${monthLabel} ${year}`;
};

const getExpiryParts = (value = '') => {
  const normalized = normalizeExpiryInput(value);
  if (!normalized) {
    return { year: '', month: '' };
  }

  const [year, month] = normalized.split('-');
  return { year, month };
};

const normalizeExpiryMonthInput = (value = '') => {
  const month = value.replace(/\D/g, '').slice(0, 2);
  if (!month) {
    return '';
  }

  if (month.length === 1) {
    return month;
  }

  const monthNumber = Number(month);
  if (monthNumber < 1 || monthNumber > 12) {
    return month;
  }

  return String(monthNumber).padStart(2, '0');
};

// Memoized row component for performance
const PurchaseRow = React.memo(({ 
  item, 
  index, 
  purchaseDate,
  activeCell, 
  rowRef,
  onUpdateField, 
  onRemove, 
  onSelectMedicine,
  onKeyDown,
  onCellFocus,
  batchWarning,
  unitOptions,
  searchInputRef,
  inputRefs,
  isFirstRow,
  onSearchChange,
  onSetSearchRowIndex,
  searchResults,
  showSearchResults,
  searchRowIndex,
  onAddMedicine,
  onCloseSearch,
  hsnCodes,
  onHSNChange
}) => {
  // Get fixed column class for each column
  const getColumnClass = (colKey) => {
    const columnClasses = {
      product: 'product-col',
      pack: 'pack-col',
      batch: 'batch-col',
      expiry: 'expiry-col',
      qty: 'qty-col',
      free: 'free-col',
      mrp: 'mrp-col',
      rate: 'rate-col',
      hsn: 'hsn-col',
      disc: 'disc-col',
      amount: 'amount-col',
      actions: 'delete-col'
    };
    return columnClasses[colKey] || '';
  };

  const getCellClass = (colKey) => {
    const colClass = getColumnClass(colKey);
    let base = `${colClass} px-2 py-2 border-r border-gray-200 text-sm focus:outline-none transition-colors `;
    
    if (activeCell?.row === index && activeCell?.col === colKey) {
      base += 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200 ';
    } else {
      base += 'bg-white ';
    }
    
    if (colKey === 'amount') {
      base += 'bg-green-50 font-bold text-green-700 ';
    }
    
    return base;
  };

  const getInputClass = (colKey) => {
    let base = `w-full h-full bg-transparent focus:outline-none text-sm `;
    if (colKey === 'amount') {
      base += 'font-bold text-green-700 text-right ';
    } else if (colKey === 'qty' || colKey === 'rate' || colKey === 'mrp') {
      base += 'text-right ';
    }
    return base;
  };

  const purchaseMonthDate = purchaseDate ? new Date(purchaseDate) : new Date();
  const suggestionStartYear = Number.isNaN(purchaseMonthDate.getTime())
    ? new Date().getFullYear()
    : purchaseMonthDate.getFullYear();
  const purchaseMonthNumber = Number.isNaN(purchaseMonthDate.getTime())
    ? 1
    : purchaseMonthDate.getMonth() + 1;
  const expiryYearValue = getExpiryParts(item.expiryDate).year;
  const initialPickerYear = expiryYearValue || String(suggestionStartYear);
  // Check if this row needs a search input (empty row or first row)
  const needsSearchInput = !item.medicineId || isFirstRow;
  const [expiryParts, setExpiryParts] = useState(() => getExpiryParts(item.expiryDate));
  const [isExpiryPickerOpen, setIsExpiryPickerOpen] = useState(false);
  const [expiryPickerYear, setExpiryPickerYear] = useState(initialPickerYear);
  const expiryPickerRef = useRef(null);
  const productSearchContainerRef = useRef(null);
  const visibleYears = Array.from({ length: 12 }, (_, yearOffset) => String(Number(expiryPickerYear) + yearOffset));
  const availableMonthOptions = EXPIRY_MONTH_OPTIONS.filter((option) => {
    if (!expiryParts.year) {
      return true;
    }

    if (!expiryPickerYear || Number(expiryPickerYear) > suggestionStartYear) {
      return true;
    }

    return Number(option.value) >= purchaseMonthNumber;
  });

  useEffect(() => {
    setExpiryParts(getExpiryParts(item.expiryDate));
    setExpiryPickerYear(getExpiryParts(item.expiryDate).year || String(suggestionStartYear));
  }, [item.expiryDate, suggestionStartYear]);

  useEffect(() => {
    if (!isExpiryPickerOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (expiryPickerRef.current && !expiryPickerRef.current.contains(event.target)) {
        setIsExpiryPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpiryPickerOpen]);

  useEffect(() => {
    if (!(showSearchResults && searchRowIndex === index)) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (productSearchContainerRef.current && !productSearchContainerRef.current.contains(event.target)) {
        onCloseSearch();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [index, onCloseSearch, searchRowIndex, showSearchResults]);

  const updateExpiry = (nextParts) => {
    setExpiryParts(nextParts);
    if (nextParts.year.length === 4 && nextParts.month) {
      onUpdateField(index, 'expiryDate', `${nextParts.year}-${nextParts.month}`);
    }
  };

  const handleExpiryYearInput = (value) => {
    const year = value.replace(/\D/g, '').slice(0, 4);
    const nextParts = { ...expiryParts, year };

    if (
      nextParts.month &&
      year === String(suggestionStartYear) &&
      Number(nextParts.month) < purchaseMonthNumber
    ) {
      nextParts.month = '';
    }

    setExpiryPickerYear(year || String(suggestionStartYear));
    updateExpiry(nextParts);
  };

  const handleExpiryMonthInput = (value) => {
    const month = normalizeExpiryMonthInput(value);
    const nextParts = { ...expiryParts, month };

    if (
      month.length === 2 &&
      Number(month) >= 1 &&
      Number(month) <= 12 &&
      nextParts.year &&
      !(nextParts.year === String(suggestionStartYear) && Number(month) < purchaseMonthNumber)
    ) {
      updateExpiry(nextParts);
      return;
    }

    setExpiryParts(nextParts);
  };

  return (
    <tr 
      ref={rowRef}
      className={`hover:bg-gray-50 ${activeCell?.row === index ? 'bg-emerald-50/30' : ''}`}
      onClick={() => onCellFocus(index, 'product')}
    >
      {/* Product Column - Wide Search Input */}
      <td className={`${getCellClass('product')} relative`}>
        {needsSearchInput ? (
          <div className="relative" ref={productSearchContainerRef}>
            <input
              ref={(el) => (inputRefs.current[`product-${index}`] = el)}
              type="text"
              value={item.medicineName || ""}
              onChange={(e) => {
                const value = e.target.value;
                onUpdateField(index, "medicineName", value);
                onSetSearchRowIndex(index);
                onSearchChange(value, index);
              }}
              placeholder="Search medicine name, brand or barcode..."
              className="w-full h-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 bg-white"
            />
            {showSearchResults && searchRowIndex === index && searchResults.length > 0 && (
              <div className="absolute left-0 top-full z-30 mt-2 w-full min-w-[320px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                {searchResults.map((medicine) => {
                  const strength = medicine.strength || medicine.medicineStrength || '';
                  const pack = medicine.sellingUnit || medicine.packSize || medicine.baseUnit || '';
                  const displayText = `${medicine.medicineName}${strength ? ` - ${strength}` : ''}${pack ? ` - ${pack}` : ''}`;

                  return (
                    <button
                      key={medicine._id}
                      type="button"
                      onClick={() => onAddMedicine(medicine)}
                      className="w-full border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-emerald-50"
                    >
                      <p className="font-medium text-slate-900">{displayText}</p>
                      <p className="mt-1 text-sm text-slate-500">{medicine.brandName || 'Generic'}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center h-full px-3 py-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectMedicine(index);
              }}
              className="flex-1 text-left text-sm truncate text-gray-700 hover:text-emerald-600 font-medium"
              title={item.medicineName || 'Click to search'}
            >
              {item.medicineName || <span className="text-gray-400 italic">Search...</span>}
            </button>
          </div>
        )}
      </td>

      {/* Pack Column - Show pack with conversion factor (e.g., strip (10s)) */}
      <td className={getCellClass('pack')}>
        {item.sellingUnit && item.conversionFactor ? (
          <div className="h-full px-2 py-2 flex items-center text-sm text-gray-700 font-medium">
            {item.sellingUnit} ({item.conversionFactor}s)
          </div>
        ) : (
          <input
            type="text"
            value={item.unit || ''}
            onChange={(e) => onUpdateField(index, 'unit', e.target.value)}
            onKeyDown={(e) => onKeyDown(e, index, 'pack')}
            onFocus={() => onCellFocus(index, 'pack')}
            className={getInputClass('pack')}
            placeholder="Unit"
            list={`unit-options-${index}`}
          />
        )}
        <datalist id={`unit-options-${index}`}>
          {unitOptions.map(u => <option key={u} value={u} />)}
        </datalist>
      </td>

      {/* Batch Column */}
      <td className={getCellClass('batch')}>
        <input
          type="text"
          value={item.batchNumber || ''}
          onChange={(e) => onUpdateField(index, 'batchNumber', normalizeUppercase(e.target.value))}
          onKeyDown={(e) => onKeyDown(e, index, 'batch')}
          onFocus={() => onCellFocus(index, 'batch')}
          className={getInputClass('batch')}
          placeholder="Batch"
        />
      </td>

      {/* Expiry Column */}
      <td className={getCellClass('expiry')}>
        <div className="relative" ref={expiryPickerRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCellFocus(index, 'expiry');
              setIsExpiryPickerOpen((current) => !current);
            }}
            onKeyDown={(e) => onKeyDown(e, index, 'expiry')}
            className="flex w-full items-center justify-between rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 transition hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            title="Select expiry year and month"
          >
            <span>{formatExpiryDisplay(item.expiryDate) || 'Select expiry'}</span>
            <ChevronDown size={14} className={`transition-transform ${isExpiryPickerOpen ? 'rotate-180' : ''}`} />
          </button>
          {isExpiryPickerOpen && (
            <div
              className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setExpiryPickerYear(String(Math.max(suggestionStartYear, Number(expiryPickerYear) - 12)))}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                >
                  Prev
                </button>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Select Year
                </span>
                <button
                  type="button"
                  onClick={() => setExpiryPickerYear(String(Number(expiryPickerYear) + 12))}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
              <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Enter Manually
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={expiryParts.month}
                    onChange={(e) => handleExpiryMonthInput(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="MM"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={expiryParts.year}
                    onChange={(e) => handleExpiryYearInput(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="YYYY"
                  />
                </div>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2">
                {visibleYears.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      handleExpiryYearInput(year);
                    }}
                    className={`rounded-lg px-2 py-2 text-xs font-medium transition ${
                      expiryParts.year === year
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'border border-slate-200 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Select Month
              </div>
              <div className="grid grid-cols-3 gap-2">
                {availableMonthOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      updateExpiry({ year: expiryParts.year || '', month: option.value });
                      setIsExpiryPickerOpen(false);
                    }}
                    className={`rounded-lg px-2 py-2 text-xs font-medium transition ${
                      expiryParts.month === option.value
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'border border-slate-200 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </td>

      {/* Qty Column */}
      <td className={getCellClass('qty')}>
        <input
          type="number"
          min="1"
          value={item.quantity || ''}
          onChange={(e) => onUpdateField(index, 'quantity', parseInt(e.target.value) || 0)}
          onKeyDown={(e) => onKeyDown(e, index, 'qty')}
          onFocus={() => onCellFocus(index, 'qty')}
          className={getInputClass('qty')}
          placeholder="0"
        />
      </td>

      {/* Free Column */}
      <td className={getCellClass('free')}>
        <input
          type="number"
          min="0"
          value={item.freeQuantity || 0}
          onChange={(e) => onUpdateField(index, 'freeQuantity', parseInt(e.target.value) || 0)}
          onKeyDown={(e) => onKeyDown(e, index, 'free')}
          onFocus={() => onCellFocus(index, 'free')}
          className={getInputClass('free')}
          placeholder="0"
        />
      </td>

      {/* MRP Column */}
      <td className={getCellClass('mrp')}>
        <input
          type="number"
          min="0"
          step="0.01"
          value={item.mrp || ''}
          onChange={(e) => onUpdateField(index, 'mrp', parseFloat(e.target.value) || 0)}
          onKeyDown={(e) => onKeyDown(e, index, 'mrp')}
          onFocus={() => onCellFocus(index, 'mrp')}
          className={getInputClass('mrp')}
          placeholder="0.00"
        />
      </td>

      {/* Purchase Rate Column */}
      <td className={getCellClass('rate')}>
        <input
          type="number"
          min="0"
          step="0.01"
          value={item.purchasePrice || ''}
          onChange={(e) => onUpdateField(index, 'purchasePrice', parseFloat(e.target.value) || 0)}
          onKeyDown={(e) => onKeyDown(e, index, 'rate')}
          onFocus={() => onCellFocus(index, 'rate')}
          className={getInputClass('rate')}
          placeholder="0.00"
        />
      </td>

      {/* HSN Column */}
      <td className={getCellClass('hsn')}>
        <select
          value={item.hsnCode || ""}
          onChange={(e) => onHSNChange(index, e.target.value)}
          onKeyDown={(e) => onKeyDown(e, index, 'hsn')}
          onFocus={() => onCellFocus(index, 'hsn')}
          className="w-full h-full bg-transparent focus:outline-none text-sm px-1"
        >
          <option value="">Select</option>
          {Object.values(hsnCodes).map((hsn) => (
            <option key={hsn.hsnCode} value={hsn.hsnCode}>
              {hsn.hsnCode} - {hsn.gstPercent}%
            </option>
          ))}
        </select>
      </td>

      {/* Disc% Column */}
      <td className={getCellClass('disc')}>
        <input
          type="number"
          min="0"
          max="100"
          value={item.discountPercent || 0}
          onChange={(e) => onUpdateField(index, 'discountPercent', parseFloat(e.target.value) || 0)}
          onKeyDown={(e) => onKeyDown(e, index, 'disc')}
          onFocus={() => onCellFocus(index, 'disc')}
          className={getInputClass('disc')}
          placeholder="0"
        />
      </td>

      {/* Amount Column */}
      <td className={`${getCellClass('amount')} text-right font-bold`}>
        <span className="text-green-700">Rs. {item.totalAmount?.toFixed(2) || '0.00'}</span>
      </td>

      {/* Actions Column */}
      <td className={`${getCellClass('actions')} text-center`}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
          title="Remove"
        >
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  );
}, (prev, next) => {
  return (
    prev.item === next.item &&
    prev.activeCell?.row === next.activeCell?.row &&
    prev.activeCell?.col === next.activeCell?.col &&
    prev.batchWarning === next.batchWarning
  );
});

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [hsnCodes, setHsnCodes] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedPurchase, setExpandedPurchase] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);

  // Form state
  const [purchaseNumber, setPurchaseNumber] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [miscellaneousAmount, setMiscellaneousAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState([]);
  
  // Autocomplete state
  const [medicineSearch, setMedicineSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchRowIndex, setSearchRowIndex] = useState(-1); // Which row triggered search
  
  // Active cell for keyboard navigation
  const [activeCell, setActiveCell] = useState(null);
  
  // Batch warnings
  const [batchWarnings, setBatchWarnings] = useState({});
  
  // Refs
  const tableBodyRef = useRef(null);
  const inputRefs = useRef({});
  const searchInputRef = useRef(null);
  const productSearchRef = useRef(null);

  // Column order for keyboard navigation (MRP comes before Rate)
  const columnOrder = ['product', 'pack', 'batch', 'expiry', 'qty', 'free', 'mrp', 'rate', 'hsn', 'disc', 'amount'];

  useEffect(() => {
    fetchPurchases();
    fetchSuppliers();
    fetchMedicines();
    fetchHsnCodes();
  }, [currentPage, searchTerm]);

  useEffect(() => {
    if (showAddModal && !purchaseNumber) {
      generatePurchaseNumber();
    }
  }, [showAddModal]);

  // Focus search input when search row changes
  useEffect(() => {
    if (searchRowIndex >= 0) {
      const inputEl = inputRefs.current[`product-${searchRowIndex}`];
      if (inputEl) {
        inputEl.focus();
      }
    }
  }, [searchRowIndex]);

  // Auto-focus product search when modal opens
  useEffect(() => {
    if (showAddModal && purchaseItems.length === 0) {
      // Add first empty row and focus on it
      setTimeout(() => {
        addEmptyRow();
      }, 100);
    }
  }, [showAddModal]);

  const generatePurchaseNumber = async () => {
    try {
      const response = await api.get('/purchases?limit=1&page=1');
      let newNum = 1;
      if (response.data.data && response.data.data.length > 0) {
        const lastPurchase = response.data.data[0];
        if (lastPurchase.purchaseNumber) {
          const lastNum = parseInt(lastPurchase.purchaseNumber.replace('P', ''));
          newNum = lastNum + 1;
        }
      }
      setPurchaseNumber(`P${String(newNum).padStart(6, '0')}`);
    } catch (error) {
      console.error('Error generating purchase number:', error);
      setPurchaseNumber(`P${String(1).padStart(6, '0')}`);
    }
  };

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/purchases?page=${currentPage}&limit=10&search=${searchTerm}`);
      setPurchases(response.data.data || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      console.error('Error fetching purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data.data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchMedicines = async () => {
    try {
      const response = await api.get('/medicines?status=ACTIVE&limit=1000');
      setMedicines(response.data.data || []);
    } catch (error) {
      console.error('Error fetching medicines:', error);
    }
  };

  const fetchHsnCodes = async () => {
    try {
      const response = await api.get('/hsn?status=ACTIVE&limit=1000');
      const hsnData = {};
      response.data.data?.forEach(hsn => {
        hsnData[hsn.hsnCode] = hsn;
      });
      setHsnCodes(hsnData);
    } catch (error) {
      console.error('Error fetching HSN codes:', error);
    }
  };

  // Search medicines for autocomplete (minimum 2 characters)
  const searchMedicines = async (query, rowIndex) => {
    const normalizedQuery = String(query || '').trim();

    // Only search when query length >= 2
    if (normalizedQuery.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      if (rowIndex !== undefined) {
        setSearchRowIndex(rowIndex);
      }
      return;
    }

    const lowerQuery = normalizedQuery.toLowerCase();
    const results = medicines
      .filter((medicine) => {
        const medicineName = String(medicine.medicineName || '').toLowerCase();
        const brandName = String(medicine.brandName || '').toLowerCase();
        const barcode = String(medicine.barcode || '').toLowerCase();
        const gtin = String(medicine.gtin || '').toLowerCase();

        return (
          medicineName.includes(lowerQuery) ||
          brandName.includes(lowerQuery) ||
          barcode.includes(lowerQuery) ||
          gtin.includes(lowerQuery)
        );
      })
      .slice(0, 15);

    setSearchResults(results);
    setShowSearchResults(results.length > 0);
    if (rowIndex !== undefined) {
      setSearchRowIndex(rowIndex);
    }
  };

  // Get last purchase price for a medicine
  const fetchLastPurchasePrice = async (medicineId) => {
    try {
      const response = await api.get(`/purchases/last-price/${medicineId}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching last purchase price:', error);
      return null;
    }
  };

  // Check if batch exists
  const checkBatchExists = async (medicineId, batchNumber) => {
    if (!medicineId || !batchNumber) return;
    try {
      const response = await api.get(`/purchases/check-batch?medicineId=${medicineId}&batchNumber=${batchNumber}`);
      return response.data;
    } catch (error) {
      console.error('Error checking batch:', error);
      return null;
    }
  };

  // Add medicine to purchase (creates new row)
  const addMedicineToPurchase = async (medicine) => {
    const hsnCode = medicine.hsnCodeString || medicine.hsnCode?.hsnCode;
    const hsnRecord = hsnCodes[hsnCode];
    // GST should only come from HSN selection - no default fallback
    const gstPercent = hsnRecord?.gstPercent || 0;

    const lastPrice = await fetchLastPurchasePrice(medicine._id);

    const newItem = {
      medicineId: medicine._id,
      medicineName: medicine.medicineName,
      brandName: medicine.brandName,
      hsnCode: hsnCode || '',
      gstPercent: gstPercent,
      unit: medicine.sellingUnit || medicine.baseUnit || '',
      baseUnit: medicine.baseUnit || '',
      sellingUnit: medicine.sellingUnit || '',
      conversionFactor: medicine.conversionFactor || 1,
      batchNumber: '',
      expiryDate: '',
      mrp: lastPrice?.mrp || medicine.defaultSellingPrice || 0,
      purchasePrice: lastPrice?.purchasePrice || medicine.defaultSellingPrice || 0,
      sellingPrice: lastPrice?.sellingPrice || medicine.defaultSellingPrice || 0,
      quantity: 1,
      freeQuantity: 0,
      discountPercent: 0,
      discountAmount: 0,
      subtotal: 0,
      taxableAmount: 0,
      gstAmount: 0,
      totalAmount: 0
    };
    
    calculateItemTotals(newItem);
    
    let newItems;
    if (searchRowIndex >= 0) {
      // Replace empty row
      newItems = [...purchaseItems];
      newItems[searchRowIndex] = newItem;
    } else {
      // Add new row
      newItems = [...purchaseItems, newItem];
    }
    
    setPurchaseItems(newItems);
    setMedicineSearch('');
    setShowSearchResults(false);
    setSearchRowIndex(-1);
    
    // Focus on Batch field of the row
    setTimeout(() => {
      const targetIndex = searchRowIndex >= 0 ? searchRowIndex : newItems.length - 1;
      setActiveCell({ row: targetIndex, col: 'batch' });
    }, 50);
  };

  // Update item field
  const updateItemField = (index, field, value) => {
    const updatedItems = [...purchaseItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    if (['quantity', 'purchasePrice', 'discountPercent', 'gstPercent'].includes(field)) {
      calculateItemTotals(updatedItems[index]);
    }
    
    if (field === 'batchNumber' && value && updatedItems[index].medicineId) {
      checkBatchWarning(updatedItems[index].medicineId, value, index);
    }
    
    setPurchaseItems(updatedItems);
  };

  // Handle HSN change - dedicated function for controlled component
  const handleHSNChange = (index, value) => {
    const updatedItems = [...purchaseItems];
    
    const selectedHSN = Object.values(hsnCodes).find(h => h.hsnCode === value);
    
    // Create new object for immutable state update
    updatedItems[index] = {
      ...updatedItems[index],
      hsnCode: value,
      gstPercent: selectedHSN?.gstPercent || 0
    };
    
    // Recalculate totals for this item
    calculateItemTotals(updatedItems[index]);
    
    setPurchaseItems(updatedItems);
  };

  // Calculate item totals
  const calculateItemTotals = (item) => {
    const quantity = parseFloat(item.quantity) || 0;
    const purchasePrice = parseFloat(item.purchasePrice) || 0;
    const discountPercent = parseFloat(item.discountPercent) || 0;
    const gstPercent = parseFloat(item.gstPercent) || 0;
    const cgstPercent = gstPercent / 2;
    const sgstPercent = gstPercent / 2;

    item.subtotal = quantity * purchasePrice;
    item.discountAmount = item.subtotal * (discountPercent / 100);
    item.taxableAmount = item.subtotal - item.discountAmount;
    item.gstAmount = item.taxableAmount * (gstPercent / 100);
    item.cgstAmount = item.taxableAmount * (cgstPercent / 100);
    item.sgstAmount = item.taxableAmount * (sgstPercent / 100);
    item.totalAmount = item.taxableAmount + item.gstAmount;

    return item;
  };

  // Check batch warning
  const checkBatchWarning = async (medicineId, batchNumber, index) => {
    const result = await checkBatchExists(medicineId, batchNumber);
    if (result?.exists) {
      setBatchWarnings(prev => ({
        ...prev,
        [index]: `Batch exists! Stock: ${result.data.quantityAvailable}`
      }));
    } else {
      setBatchWarnings(prev => {
        const newWarnings = { ...prev };
        delete newWarnings[index];
        return newWarnings;
      });
    }
  };

  // Remove item
  const removeItem = (index) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
    setBatchWarnings(prev => {
      const newWarnings = { ...prev };
      delete newWarnings[index];
      return newWarnings;
    });
  };

  // Calculate totals
  const calculateTotals = useCallback(() => {
    const subtotal = purchaseItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const totalDiscount = purchaseItems.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
    const totalGst = purchaseItems.reduce((sum, item) => sum + (item.gstAmount || 0), 0);
    const totalCgst = purchaseItems.reduce((sum, item) => sum + (item.cgstAmount || 0), 0);
    const totalSgst = purchaseItems.reduce((sum, item) => sum + (item.sgstAmount || 0), 0);
    const itemTotal = purchaseItems.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
    const extraAmount = parseFloat(miscellaneousAmount) || 0;
    const grandTotal = itemTotal + extraAmount;
    return { subtotal, totalDiscount, totalGst, totalCgst, totalSgst, miscellaneousAmount: extraAmount, grandTotal };
  }, [miscellaneousAmount, purchaseItems]);

  // Memoized totals
  const totals = useMemo(() => calculateTotals(), [calculateTotals]);

  // Handle cell focus
  const handleCellFocus = (row, col) => {
    setActiveCell({ row, col });
    setSearchRowIndex(-1);
  };

  // Trigger medicine search for a row
  const handleSelectMedicine = (index) => {
    setSearchRowIndex(index);
    setActiveCell({ row: index, col: 'product' });
    setMedicineSearch(purchaseItems[index]?.medicineName || '');
    searchMedicines(purchaseItems[index]?.medicineName || '', index);
  };

  // Keyboard navigation
  const handleKeyDown = (e, rowIndex, field) => {
    const currentColIndex = columnOrder.indexOf(field);
    
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // If in DISC column, create new row and focus on new row's product search
      if (field === 'disc') {
        addEmptyRow();
        return;
      }
      
      // If in amount field, create new row
      if (field === 'amount') {
        addEmptyRow();
        return;
      }
      
      // Move to next field
      if (currentColIndex < columnOrder.length - 1) {
        const nextCol = columnOrder[currentColIndex + 1];
        setActiveCell({ row: rowIndex, col: nextCol });
      } else {
        // Last column - create new row if not the last item
        if (rowIndex < purchaseItems.length - 1) {
          setActiveCell({ row: rowIndex + 1, col: 'batch' });
        } else {
          addEmptyRow();
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      
      if (e.shiftKey) {
        // Shift+Tab - move backward
        if (currentColIndex > 0) {
          const prevCol = columnOrder[currentColIndex - 1];
          setActiveCell({ row: rowIndex, col: prevCol });
        } else if (rowIndex > 0) {
          setActiveCell({ row: rowIndex - 1, col: 'disc' });
        }
      } else {
        // Tab - move forward
        if (currentColIndex < columnOrder.length - 1) {
          const nextCol = columnOrder[currentColIndex + 1];
          setActiveCell({ row: rowIndex, col: nextCol });
        } else if (rowIndex < purchaseItems.length - 1) {
          setActiveCell({ row: rowIndex + 1, col: 'batch' });
        } else {
          addEmptyRow();
        }
      }
    } else if (e.key === 'ArrowDown' && rowIndex < purchaseItems.length - 1) {
      e.preventDefault();
      setActiveCell({ row: rowIndex + 1, col: field });
    } else if (e.key === 'ArrowUp' && rowIndex > 0) {
      e.preventDefault();
      setActiveCell({ row: rowIndex - 1, col: field });
    } else if (e.key === 'ArrowRight' && field !== 'product') {
      e.preventDefault();
      if (currentColIndex < columnOrder.length - 1) {
        const nextCol = columnOrder[currentColIndex + 1];
        setActiveCell({ row: rowIndex, col: nextCol });
      }
    } else if (e.key === 'ArrowLeft' && field !== 'product') {
      e.preventDefault();
      if (currentColIndex > 0) {
        const prevCol = columnOrder[currentColIndex - 1];
        setActiveCell({ row: rowIndex, col: prevCol });
      }
    }
  };

  // Add empty row
  const addEmptyRow = () => {
    const newItem = {
      medicineId: null,
      medicineName: '',
      brandName: '',
      hsnCode: '',
      gstPercent: 0,
      unit: '',
      baseUnit: '',
      sellingUnit: '',
      conversionFactor: 1,
      batchNumber: '',
      expiryDate: '',
      mrp: 0,
      purchasePrice: 0,
      sellingPrice: 0,
      quantity: 1,
      freeQuantity: 0,
      discountPercent: 0,
      discountAmount: 0,
      subtotal: 0,
      taxableAmount: 0,
      gstAmount: 0,
      totalAmount: 0
    };
    
    const newItems = [...purchaseItems, newItem];
    setPurchaseItems(newItems);
    
    // Focus on product search of new row
    setTimeout(() => {
      const newIndex = newItems.length - 1;
      setActiveCell({ row: newIndex, col: 'product' });
      setSearchRowIndex(newIndex);
      setMedicineSearch('');
    }, 50);
  };

  // Save purchase
  const handleSavePurchase = async () => {
    const validationResult = validatePurchaseForm({
      selectedSupplier,
      purchaseDate,
      supplierInvoiceNumber,
      discountPercent,
      miscellaneousAmount,
      purchaseItems
    });

    if (validationResult.error) {
      alert(validationResult.error);
      if (validationResult.rowIndex !== undefined && validationResult.field) {
        setActiveCell({ row: validationResult.rowIndex, col: validationResult.field });
      }
      return;
    }

    try {
      setSaving(true);
      const purchaseData = {
        purchaseNumber,
        supplier: selectedSupplier,
        purchaseDate: purchaseDate,
        supplierInvoiceNumber: normalizeTextInput(supplierInvoiceNumber).trim(),
        items: purchaseItems.map(item => ({
          medicine: item.medicineId,
          hsnCode: String(item.hsnCode || '').trim(),
          gstPercent: parseFloat(item.gstPercent),
          unit: item.unit,
          baseUnit: item.baseUnit,
          sellingUnit: item.sellingUnit,
          conversionFactor: parseInt(item.conversionFactor) || 1,
          batchNumber: normalizeUppercase(item.batchNumber),
          expiryDate: item.expiryDate,
          mrp: parseFloat(item.mrp) || 0,
          purchasePrice: parseFloat(item.purchasePrice),
          sellingPrice: parseFloat(item.sellingPrice),
          quantity: parseInt(item.quantity),
          freeQuantity: parseInt(item.freeQuantity) || 0,
          discountPercent: parseFloat(item.discountPercent) || 0,
          discountAmount: item.discountAmount,
          subtotal: item.subtotal,
          taxableAmount: item.taxableAmount,
          gstAmount: item.gstAmount,
          totalAmount: item.totalAmount
        })),
        subtotal: totals.subtotal,
        totalGst: totals.totalGst,
        discountPercent: parseFloat(discountPercent),
        discountAmount: totals.totalDiscount,
        miscellaneousAmount: totals.miscellaneousAmount,
        grandTotal: totals.grandTotal,
        paymentMode: paymentMode,
        notes: normalizeTextInput(notes).trim()
      };

      const response = editingPurchaseId
        ? await api.put(`/purchases/${editingPurchaseId}`, purchaseData)
        : await api.post('/purchases', purchaseData);
      if (response.data.success) {
        alert(editingPurchaseId ? 'Purchase updated successfully!' : 'Purchase created successfully!');
        setShowAddModal(false);
        resetForm();
        fetchPurchases();
      }
    } catch (error) {
      console.error('Error saving purchase:', error);
      alert(error.response?.data?.message || (editingPurchaseId ? 'Error updating purchase. Please try again.' : 'Error creating purchase. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setEditingPurchaseId(null);
    setPurchaseNumber('');
    setSelectedSupplier('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setSupplierInvoiceNumber('');
    setPaymentMode('CASH');
    setDiscountPercent(0);
    setMiscellaneousAmount(0);
    setNotes('');
    setPurchaseItems([]);
    setMedicineSearch('');
    setBatchWarnings({});
    setActiveCell(null);
    setSearchRowIndex(-1);
  };

  const handleEditPurchase = async (purchaseId) => {
    try {
      const response = await api.get(`/purchases/${purchaseId}`);
      const purchase = response.data?.data;

      if (!purchase) {
        alert('Unable to load purchase details.');
        return;
      }

      setEditingPurchaseId(purchase._id);
      setPurchaseNumber(purchase.purchaseNumber || '');
      setSelectedSupplier(purchase.supplier?._id || '');
      setPurchaseDate(purchase.purchaseDate ? new Date(purchase.purchaseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      setSupplierInvoiceNumber(purchase.supplierInvoiceNumber || '');
      setPaymentMode(purchase.paymentMode || 'CASH');
      setDiscountPercent(purchase.discountPercent || 0);
      setMiscellaneousAmount(purchase.miscellaneousAmount || 0);
      setNotes(purchase.notes || '');
      setPurchaseItems(
        (purchase.items || []).map((item) => {
          const mappedItem = {
            medicineId: item.medicine?._id || item.medicine || null,
            medicineName: item.medicine?.medicineName || '',
            brandName: item.medicine?.brandName || '',
            hsnCode: item.hsnCode || '',
            gstPercent: item.gstPercent || 0,
            unit: item.unit || '',
            baseUnit: item.baseUnit || '',
            sellingUnit: item.sellingUnit || '',
            conversionFactor: item.conversionFactor || 1,
            batchNumber: item.batchNumber || '',
            expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().slice(0, 7) : '',
            mrp: item.mrp || 0,
            purchasePrice: item.purchasePrice || 0,
            sellingPrice: item.sellingPrice || 0,
            quantity: item.quantity || 1,
            freeQuantity: item.freeQuantity || 0,
            discountPercent: item.discountPercent || 0,
            discountAmount: item.discountAmount || 0,
            subtotal: item.subtotal || 0,
            taxableAmount: item.taxableAmount || 0,
            gstAmount: item.gstAmount || 0,
            cgstAmount: item.cgstAmount || 0,
            sgstAmount: item.sgstAmount || 0,
            totalAmount: item.totalAmount || 0
          };

          return calculateItemTotals(mappedItem);
        })
      );
      setMedicineSearch('');
      setSearchResults([]);
      setShowSearchResults(false);
      setBatchWarnings({});
      setActiveCell(null);
      setSearchRowIndex(-1);
      setShowAddModal(true);
    } catch (error) {
      console.error('Error loading purchase for edit:', error);
      alert(error.response?.data?.message || 'Unable to load purchase for editing.');
    }
  };

  // Delete purchase
  const handleDelete = async (id) => {
    try {
      await api.delete(`/purchases/${id}`);
      setDeleteConfirm(null);
      fetchPurchases();
    } catch (error) {
      console.error('Error deleting purchase:', error);
      alert('Error deleting purchase. Please try again.');
    }
  };

  // Toggle expand
  const toggleExpand = (purchaseId) => {
    setExpandedPurchase(expandedPurchase === purchaseId ? null : purchaseId);
  };

  // Get payment mode color
  const getPaymentModeColor = (mode) => {
    switch (mode) {
      case 'CASH': return 'bg-green-100 text-green-800';
      case 'UPI': return 'bg-emerald-100 text-emerald-800';
      case 'CARD': return 'bg-amber-100 text-amber-800';
      case 'CREDIT': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Calculate total items
  const calculateTotalItems = (items) => {
    return items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setMedicineSearch(value);
    searchMedicines(value, searchRowIndex >= 0 ? searchRowIndex : purchaseItems.length);
  };

  // Handle search key down
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowSearchResults(false);
      setSearchRowIndex(-1);
    } else if (e.key === 'Enter' && searchResults.length > 0) {
      addMedicineToPurchase(searchResults[0]);
    }
  };

  const closeMedicineSearch = useCallback(() => {
    setShowSearchResults(false);
    setSearchRowIndex(-1);
  }, []);

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.10),_transparent_30%),linear-gradient(180deg,_#fbfcf8_0%,_#f3f7ef_100%)] p-3 sm:p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Purchases</h1>
          <p className="mt-1 text-slate-600">Track and manage medicine purchases with batch-wise inventory control.</p>
        </div>
        <button onClick={() => {
          resetForm();
          setShowAddModal(true);
        }} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md">
          <Plus size={20} />
          New Purchase
        </button>
      </div>

      {/* Search */}
      <div className="mb-6 rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search by invoice number or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-3">
              <Package className="text-emerald-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Purchases</p>
              <p className="text-2xl font-bold text-slate-900">{purchases.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-3">
              <DollarSign className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Amount</p>
              <p className="text-2xl font-bold text-slate-900">Rs. {purchases.reduce((sum, p) => sum + (p.grandTotal || 0), 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-3">
              <Package className="text-orange-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Credit Purchases</p>
              <p className="text-2xl font-bold text-slate-900">{purchases.filter(p => p.paymentMode === 'CREDIT').length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-100 p-3">
              <Calendar className="text-amber-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">This Month</p>
              <p className="text-2xl font-bold text-slate-900">
                {purchases.filter(p => {
                  const date = new Date(p.purchaseDate);
                  const now = new Date();
                  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Purchases Table */}
      <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-sm backdrop-blur">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading purchases...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead className="border-b border-gray-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {purchases.map((purchase) => (
                    <React.Fragment key={purchase._id}>
                      <tr className="transition-colors hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <button onClick={() => toggleExpand(purchase._id)} className="rounded-lg p-1 transition-colors hover:bg-slate-200">
                            {expandedPurchase === purchase._id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </button>
                        </td>
                        <td className="px-4 py-4 font-medium text-gray-900">{purchase.purchaseNumber}</td>
<td className="px-4 py-4 text-sm text-gray-500">{purchase.supplierInvoiceNumber}</td>
                        <td className="px-4 py-4 text-sm text-gray-900">{purchase.supplier?.supplierName}</td>
                        <td className="px-4 py-4 text-sm text-gray-900">{new Date(purchase.purchaseDate).toLocaleDateString()}</td>
                        <td className="px-4 py-4 text-sm text-gray-900">{calculateTotalItems(purchase.items)} items</td>
                        <td className="px-4 py-4 text-sm font-medium text-gray-900">Rs. {purchase.grandTotal?.toLocaleString()}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentModeColor(purchase.paymentMode)}`}>
                            {purchase.paymentMode}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => toggleExpand(purchase._id)} className="rounded-xl p-2 text-emerald-600 transition-colors hover:bg-emerald-50">
                              <Eye size={18} />
                            </button>
                            <button onClick={() => handleEditPurchase(purchase._id)} className="rounded-xl p-2 text-amber-600 transition-colors hover:bg-amber-50" title="Edit Purchase">
                              <Pencil size={18} />
                            </button>
                            <button onClick={() => setDeleteConfirm(purchase)} className="rounded-xl p-2 text-red-600 transition-colors hover:bg-red-50">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedPurchase === purchase._id && (
                        <tr>
                          <td colSpan="9" className="bg-slate-50 px-4 py-4">
                            <div className="overflow-hidden rounded-xl border border-slate-200">
                              <table className="w-full">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Medicine</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">HSN</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Batch</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Expiry</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Qty</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Price</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">GST</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                  {purchase.items?.map((item, index) => (
                                    <tr key={index}>
                                      <td className="px-4 py-2 text-sm text-gray-900">{item.medicine?.medicineName}</td>
                                      <td className="px-4 py-2 text-sm text-gray-500">{item.hsnCode || '-'}</td>
                                      <td className="px-4 py-2 text-sm text-gray-500">{item.batchNumber}</td>
                                      <td className="px-4 py-2 text-sm text-gray-500">{formatExpiryDisplay(item.expiryDate)}</td>
                                      <td className="px-4 py-2 text-sm text-gray-900">{item.quantity}</td>
                                      <td className="px-4 py-2 text-sm text-gray-900">Rs. {item.purchasePrice?.toFixed(2)}</td>
                                      <td className="px-4 py-2 text-sm text-gray-500">{item.gstPercent}%</td>
                                      <td className="px-4 py-2 text-sm font-medium text-gray-900">Rs. {item.totalAmount?.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-gray-50">
                                  <tr>
                                    <td colSpan="7" className="px-4 py-2 text-right text-sm font-medium text-gray-600">Total GST:</td>
                                    <td className="px-4 py-2 text-sm font-medium text-gray-900">Rs. {(purchase.totalGst || 0).toFixed(2)}</td>
                                  </tr>
                                  <tr>
                                    <td colSpan="7" className="px-4 py-2 text-right text-sm font-medium text-gray-600">Miscellaneous:</td>
                                    <td className="px-4 py-2 text-sm font-medium text-gray-900">Rs. {(purchase.miscellaneousAmount || 0).toFixed(2)}</td>
                                  </tr>
                                  <tr>
                                    <td colSpan="7" className="px-4 py-2 text-right text-sm font-bold text-gray-900">Grand Total:</td>
                                    <td className="px-4 py-2 text-sm font-bold text-gray-900">Rs. {(purchase.grandTotal || 0).toFixed(2)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <div className="text-sm text-slate-500">Showing {purchases.length} results</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-xl border border-gray-300 p-2 transition-colors disabled:opacity-50 hover:bg-slate-50">
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm text-slate-600">Page {currentPage} of {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="rounded-xl border border-gray-300 p-2 transition-colors disabled:opacity-50 hover:bg-slate-50">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Purchase Modal - ERP Grid Style */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-2 backdrop-blur-sm md:p-4">
          <div className="flex min-h-full items-start justify-center md:items-center">
            <div className="flex min-h-[96vh] w-full max-w-7xl flex-col overflow-y-auto overflow-x-hidden rounded-[22px] border border-white/60 bg-white shadow-2xl sm:rounded-[28px] md:min-h-0 md:max-h-[95vh]">
            {/* Header */}
            <div className="flex flex-shrink-0 flex-col gap-3 border-b border-emerald-400/20 bg-gradient-to-r from-emerald-700 via-emerald-600 to-lime-500 p-4 text-white md:flex-row md:items-center md:justify-between md:p-6">
              <div className="pr-6">
                <h2 className="text-xl font-bold">{editingPurchaseId ? 'Edit Purchase Order' : 'New Purchase Order'}</h2>
                <p className="text-emerald-100 text-sm">ERP Mode - Tab/Enter to navigate â€¢ Enter in Amount adds new row</p>
              </div>
              <button onClick={() => {
                setShowAddModal(false);
                resetForm();
              }} className="rounded-xl p-2 transition-colors hover:bg-white/10">
                <X size={24} />
              </button>
            </div>
            
            {/* Header Form */}
            <div className="flex-shrink-0 border-b border-gray-200 bg-slate-50 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5 md:gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Purchase Number</label>
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded border border-gray-300">
                    <Hash size={16} className="text-gray-400" />
                    <span className="font-mono font-bold text-emerald-600">{purchaseNumber}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Supplier *</label>
                  <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" required>
                    <option value="">Select</option>
                    {suppliers.map(s => (<option key={s._id} value={s._id}>{s.supplierName}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date *</label>
                  <input type="date" value={purchaseDate} max={new Date().toISOString().split('T')[0]} onChange={(e) => setPurchaseDate(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Supplier Invoice *</label>
                  <input 
                    type="text" 
                    value={supplierInvoiceNumber} 
                    maxLength={50}
                    onChange={(e) => setSupplierInvoiceNumber(normalizeTextInput(e.target.value))} 
                    placeholder="Enter supplier invoice number"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Payment Mode</label>
                  <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500">
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Grid Layout - ERP Style */}
            <div className="flex min-h-[360px] flex-1 flex-col overflow-visible md:overflow-hidden">
              <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Purchase Items</p>
                  <p className="text-xs text-slate-500">Add medicines and continue entry row by row.</p>
                </div>
                <button
                  onClick={addEmptyRow}
                  className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <Plus size={18} />
                  Add Item
                </button>
              </div>

              {/* Table Header - Sticky */}
              <div className="overflow-x-auto flex-shrink-0 border-b border-gray-200 bg-slate-100/80">
                <table className="purchase-table w-full">
                  <thead className="sticky top-0 bg-gray-100 z-10">
                    <tr>
                      {GRID_COLUMNS.map((col) => (
                        <th key={col.key} className={col.className}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                </table>
              </div>

              {/* Table Body - Scrollable */}
              <div className="min-h-[220px] flex-1 overflow-auto" ref={tableBodyRef}>
                {purchaseItems.length > 0 ? (
                  <table className="purchase-table w-full">
                    <tbody className="divide-y divide-gray-200">
                      {purchaseItems.map((item, index) => (
                        <React.Fragment key={index}>
                          {batchWarnings[index] && (
                            <tr>
                              <td colSpan={GRID_COLUMNS.length} className="flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 text-xs">
                                <AlertTriangle size={14} />
                                {batchWarnings[index]}
                              </td>
                            </tr>
                          )}
                          <PurchaseRow
                            item={item}
                            index={index}
                            purchaseDate={purchaseDate}
                            activeCell={activeCell}
                            rowRef={(el) => (inputRefs.current[index] = el)}
                            onUpdateField={updateItemField}
                            onRemove={removeItem}
                            onSelectMedicine={handleSelectMedicine}
                            onKeyDown={handleKeyDown}
                            onCellFocus={handleCellFocus}
                            batchWarning={batchWarnings[index]}
                            unitOptions={UNIT_OPTIONS}
                            searchInputRef={searchInputRef}
                            inputRefs={inputRefs}
                            isFirstRow={index === 0}
                            onSearchChange={searchMedicines}
                            onSetSearchRowIndex={setSearchRowIndex}
                            searchResults={searchResults}
                            showSearchResults={showSearchResults}
                            searchRowIndex={searchRowIndex}
                            onAddMedicine={addMedicineToPurchase}
                            onCloseSearch={closeMedicineSearch}
                            hsnCodes={hsnCodes}
                            onHSNChange={handleHSNChange}
                          />
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex min-h-[220px] flex-col items-center justify-center py-12 text-center text-gray-500">
                    <Pill size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium text-slate-700">No items added yet</p>
                    <p className="mt-2 max-w-md text-sm text-slate-500">Start by adding your first purchase item. You can search the medicine and then continue filling the row.</p>
                    <button
                      onClick={addEmptyRow}
                      className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
                    >
                      <Plus size={18} />
                      Add First Item
                    </button>
                  </div>
                )}

                {/* Add Row Button */}
                <div className="sticky bottom-0 border-t border-gray-200 bg-slate-50/95 p-4 backdrop-blur">
                  <button
                    onClick={addEmptyRow}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-300 bg-white px-4 py-3 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-50"
                  >
                    <Plus size={20} />
                    Add Item (or press Enter in last Amount field)
                  </button>
                </div>
              </div>

              {/* Search Dropdown - Shows when searching - ERP Style Format */}
              {false && showSearchResults && searchResults.length > 0 && (
                <div className="absolute z-50 mt-12 ml-4 w-[500px] bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-auto">
                  {searchResults.map((medicine) => {
                    // Format: Medicine Name â€“ Strength â€“ Pack (e.g., Paracetamol 500mg â€“ Tablet â€“ Strip10)
                    const strength = medicine.strength || medicine.medicineStrength || '';
                    const pack = medicine.sellingUnit || medicine.packSize || medicine.baseUnit || '';
                    const displayText = `${medicine.medicineName}${strength ? ` â€“ ${strength}` : ''}${pack ? ` â€“ ${pack}` : ''}`;
                    
                    return (
                      <button 
                        key={medicine._id} 
                        onClick={() => addMedicineToPurchase(medicine)} 
                        className="w-full px-4 py-3 text-left hover:bg-emerald-50 border-b border-gray-100 last:border-0 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{displayText}</p>
                            <p className="text-sm text-gray-500">{medicine.brandName || 'Generic'}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer with Summary */}
            <div className="flex-shrink-0 border-t border-gray-200 bg-slate-50 p-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <input type="text" value={notes} onChange={(e) => setNotes(normalizeTextInput(e.target.value))} maxLength={250} placeholder="Any additional notes..." className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Miscellaneous Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={miscellaneousAmount}
                      onChange={(e) => setMiscellaneousAmount(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-lime-50 p-4 shadow-[0_14px_40px_rgba(148,163,184,0.18)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-lime-700">Purchase Insights</p>
                        <h3 className="mt-2 text-lg font-semibold text-slate-900">Entry Snapshot</h3>
                        <p className="mt-1 text-sm text-slate-500">A quick look at the purchase before saving.</p>
                      </div>
                      <div className="rounded-2xl bg-slate-900 px-3 py-2 text-right text-white shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Items</p>
                        <p className="mt-1 text-2xl font-bold">{purchaseItems.length}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">Payment Mode</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">{paymentMode || 'CASH'}</p>
                      </div>
                      <div className="rounded-2xl border border-violet-100 bg-violet-50/80 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600">Purchase Date</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">{purchaseDate || 'Not set'}</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">Discount Saved</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">Rs. {totals.totalDiscount.toFixed(2)}</p>
                      </div>
                      <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600">Extra Charges</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">Rs. {totals.miscellaneousAmount.toFixed(2)}</p>
                      </div>
                      <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600">CGST</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">Rs. {totals.totalCgst.toFixed(2)}</p>
                      </div>
                      <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600">SGST</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">Rs. {totals.totalSgst.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Notes Preview</p>
                      <p className="mt-2 text-sm text-slate-600">{notes.trim() || 'Add a short note to remember supplier terms, batch info, or delivery details.'}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
                    <div className="mb-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-900 px-4 py-4 text-white">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200">Live Totals</p>
                        <h3 className="mt-2 text-xl font-semibold">Purchase Summary</h3>
                        <p className="mt-1 text-sm text-slate-300">Review the purchase value as you update items.</p>
                      </div>
                      <div className="hidden rounded-2xl bg-white/10 px-4 py-3 text-right backdrop-blur-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100">Grand Total</p>
                        <p className="mt-1 text-2xl font-bold text-emerald-300">Rs. {totals.grandTotal.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Subtotal</p>
                        <p className="text-xl font-bold">Rs. {totals.subtotal.toFixed(2)}</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Discount</p>
                        <p className="text-xl font-bold text-green-400">-Rs. {totals.totalDiscount.toFixed(2)}</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Total GST</p>
                        <p className="text-xl font-bold">Rs. {totals.totalGst.toFixed(2)}</p>
                      </div>
                      <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">Miscellaneous</p>
                        <p className="text-xl font-bold">Rs. {totals.miscellaneousAmount.toFixed(2)}</p>
                      </div>
                      <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">CGST</p>
                        <p className="text-xl font-bold">Rs. {totals.totalCgst.toFixed(2)}</p>
                      </div>
                      <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">SGST</p>
                        <p className="text-xl font-bold">Rs. {totals.totalSgst.toFixed(2)}</p>
                      </div>
                      <div className="hidden rounded-2xl border border-slate-200 bg-slate-950 p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Grand Total</p>
                        <p className="text-2xl font-bold text-green-400">Rs. {totals.grandTotal.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="mt-4 overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.18),_transparent_35%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#052e2b_100%)] shadow-[0_24px_70px_rgba(2,6,23,0.28)]">
                      <div className="flex items-center justify-between gap-4 px-5 py-6">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-200/80">Grand Total</p>
                          <p className="mt-2 text-sm text-slate-300">Final payable amount including GST and extras</p>
                          <div className="mt-3 h-px w-24 bg-gradient-to-r from-emerald-300/80 to-transparent" />
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100/70">Amount Payable</p>
                          <p className="mt-2 text-4xl font-black tracking-tight text-white drop-shadow-[0_8px_24px_rgba(52,211,153,0.18)]">Rs. {totals.grandTotal.toFixed(2)}</p>
                          <div className="mt-3 inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-medium text-emerald-100 backdrop-blur-sm">
                            Updated live
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }} className="rounded-xl border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50">Cancel</button>
                <button onClick={handleSavePurchase} disabled={saving || purchaseItems.length === 0} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2 text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
                  <Save size={20} />
                  {saving ? 'Saving...' : editingPurchaseId ? 'Update Purchase' : 'Save Purchase'}
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Confirm Delete</h3>
            </div>
<p className="text-gray-600 mb-6">Are you sure you want to delete purchase <strong>{deleteConfirm.purchaseNumber || deleteConfirm.supplierInvoiceNumber}</strong>? This will also restore the inventory stock.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm._id)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

