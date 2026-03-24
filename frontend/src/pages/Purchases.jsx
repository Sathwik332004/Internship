import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Plus, Eye, Trash2, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Calendar, DollarSign, Package, AlertTriangle, Clock, Hash, Save, Pill, Check } from 'lucide-react';
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

// Memoized row component for performance
const PurchaseRow = React.memo(({ 
  item, 
  index, 
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
      base += 'bg-blue-50 border-blue-500 ring-2 ring-blue-200 ';
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

  // Check if this row needs a search input (empty row or first row)
  const needsSearchInput = !item.medicineId || isFirstRow;

  return (
    <tr 
      ref={rowRef}
      className={`hover:bg-gray-50 ${activeCell?.row === index ? 'bg-blue-50/30' : ''}`}
      onClick={() => onCellFocus(index, 'product')}
    >
      {/* Product Column - Wide Search Input */}
      <td className={`${getCellClass('product')} relative`}>
        {needsSearchInput ? (
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
            className="w-full h-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-white"
          />
        ) : (
          <div className="flex items-center h-full px-3 py-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectMedicine(index);
              }}
              className="flex-1 text-left text-sm truncate text-gray-700 hover:text-blue-600 font-medium"
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
        <input
          type="month"
          value={item.expiryDate || ''}
          onChange={(e) => onUpdateField(index, 'expiryDate', e.target.value)}
          onKeyDown={(e) => onKeyDown(e, index, 'expiry')}
          onFocus={() => onCellFocus(index, 'expiry')}
          className={`${getInputClass('expiry')} text-xs`}
          placeholder="MM/YY"
        />
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
        <span className="text-green-700">₹{item.totalAmount?.toFixed(2) || '0.00'}</span>
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
    // Only search when query length >= 2
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      if (rowIndex !== undefined) {
        setSearchRowIndex(rowIndex);
      }
      return;
    }

    try {
      const response = await api.get('/medicines/search-all', {
        params: { q: query, limit: 15 }
      });

      const results = response?.data?.data || [];
      setSearchResults(results);
      setShowSearchResults(true);
      if (rowIndex !== undefined) {
        setSearchRowIndex(rowIndex);
      }
    } catch (error) {
      console.error("Medicine search error:", error);
      setSearchResults([]);
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

    item.subtotal = quantity * purchasePrice;
    item.discountAmount = item.subtotal * (discountPercent / 100);
    item.taxableAmount = item.subtotal - item.discountAmount;
    item.gstAmount = item.taxableAmount * (gstPercent / 100);
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
    const itemTotal = purchaseItems.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
    const extraAmount = parseFloat(miscellaneousAmount) || 0;
    const grandTotal = itemTotal + extraAmount;
    return { subtotal, totalDiscount, totalGst, miscellaneousAmount: extraAmount, grandTotal };
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

      const response = await api.post('/purchases', purchaseData);
      if (response.data.success) {
        alert('Purchase created successfully!');
        setShowAddModal(false);
        resetForm();
        fetchPurchases();
      }
    } catch (error) {
      console.error('Error saving purchase:', error);
      alert(error.response?.data?.message || 'Error creating purchase. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Reset form
  const resetForm = () => {
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
      case 'UPI': return 'bg-blue-100 text-blue-800';
      case 'CARD': return 'bg-purple-100 text-purple-800';
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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchases</h1>
          <p className="text-gray-600 mt-1">Track and manage medicine purchases with batch-wise inventory</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          <Plus size={20} />
          New Purchase
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by invoice number or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Purchases</p>
              <p className="text-2xl font-bold text-gray-900">{purchases.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">₹{purchases.reduce((sum, p) => sum + (p.grandTotal || 0), 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Package className="text-orange-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Credit Purchases</p>
              <p className="text-2xl font-bold text-gray-900">{purchases.filter(p => p.paymentMode === 'CREDIT').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Calendar className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900">
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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading purchases...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
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
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <button onClick={() => toggleExpand(purchase._id)} className="p-1 hover:bg-gray-200 rounded">
                            {expandedPurchase === purchase._id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </button>
                        </td>
                        <td className="px-4 py-4 font-medium text-gray-900">{purchase.purchaseNumber}</td>
<td className="px-4 py-4 text-sm text-gray-500">{purchase.supplierInvoiceNumber}</td>
                        <td className="px-4 py-4 text-sm text-gray-900">{purchase.supplier?.supplierName}</td>
                        <td className="px-4 py-4 text-sm text-gray-900">{new Date(purchase.purchaseDate).toLocaleDateString()}</td>
                        <td className="px-4 py-4 text-sm text-gray-900">{calculateTotalItems(purchase.items)} items</td>
                        <td className="px-4 py-4 text-sm font-medium text-gray-900">₹{purchase.grandTotal?.toLocaleString()}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentModeColor(purchase.paymentMode)}`}>
                            {purchase.paymentMode}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => toggleExpand(purchase._id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                              <Eye size={18} />
                            </button>
                            <button onClick={() => setDeleteConfirm(purchase)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedPurchase === purchase._id && (
                        <tr>
                          <td colSpan="9" className="px-4 py-4 bg-gray-50">
                            <div className="border rounded-lg overflow-hidden">
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
                                      <td className="px-4 py-2 text-sm text-gray-500">{new Date(item.expiryDate).toLocaleDateString()}</td>
                                      <td className="px-4 py-2 text-sm text-gray-900">{item.quantity}</td>
                                      <td className="px-4 py-2 text-sm text-gray-900">₹{item.purchasePrice?.toFixed(2)}</td>
                                      <td className="px-4 py-2 text-sm text-gray-500">{item.gstPercent}%</td>
                                      <td className="px-4 py-2 text-sm font-medium text-gray-900">₹{item.totalAmount?.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-gray-50">
                                  <tr>
                                    <td colSpan="7" className="px-4 py-2 text-right text-sm font-medium text-gray-600">Total GST:</td>
                                    <td className="px-4 py-2 text-sm font-medium text-gray-900">₹{(purchase.totalGst || 0).toFixed(2)}</td>
                                  </tr>
                                  <tr>
                                    <td colSpan="7" className="px-4 py-2 text-right text-sm font-medium text-gray-600">Miscellaneous:</td>
                                    <td className="px-4 py-2 text-sm font-medium text-gray-900">₹{(purchase.miscellaneousAmount || 0).toFixed(2)}</td>
                                  </tr>
                                  <tr>
                                    <td colSpan="7" className="px-4 py-2 text-right text-sm font-bold text-gray-900">Grand Total:</td>
                                    <td className="px-4 py-2 text-sm font-bold text-gray-900">₹{(purchase.grandTotal || 0).toFixed(2)}</td>
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
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">Showing {purchases.length} results</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border border-gray-300 disabled:opacity-50">
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-gray-300 disabled:opacity-50">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Purchase Modal - ERP Grid Style */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 md:p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-gray-200 flex justify-between items-center bg-blue-600 text-white flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold">New Purchase Order</h2>
                <p className="text-blue-100 text-sm">ERP Mode - Tab/Enter to navigate • Enter in Amount adds new row</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-blue-700 rounded-lg">
                <X size={24} />
              </button>
            </div>
            
            {/* Header Form */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Purchase Number</label>
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded border border-gray-300">
                    <Hash size={16} className="text-gray-400" />
                    <span className="font-mono font-bold text-blue-600">{purchaseNumber}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Supplier *</label>
                  <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" required>
                    <option value="">Select</option>
                    {suppliers.map(s => (<option key={s._id} value={s._id}>{s.supplierName}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date *</label>
                  <input type="date" value={purchaseDate} max={new Date().toISOString().split('T')[0]} onChange={(e) => setPurchaseDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Supplier Invoice *</label>
                  <input 
                    type="text" 
                    value={supplierInvoiceNumber} 
                    maxLength={50}
                    onChange={(e) => setSupplierInvoiceNumber(normalizeTextInput(e.target.value))} 
                    placeholder="Enter supplier invoice number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Payment Mode</label>
                  <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm">
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Grid Layout - ERP Style */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Table Header - Sticky */}
              <div className="overflow-x-auto flex-shrink-0">
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
              <div className="flex-1 overflow-auto" ref={tableBodyRef}>
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
                            hsnCodes={hsnCodes}
                            onHSNChange={handleHSNChange}
                          />
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Pill size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-lg">No items added. Press Enter or click below to add first item.</p>
                  </div>
                )}

                {/* Add Row Button */}
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={addEmptyRow}
                    className="flex items-center gap-2 px-4 py-2 text-blue-600 border-2 border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <Plus size={20} />
                    Add Item (or press Enter in last Amount field)
                  </button>
                </div>
              </div>

              {/* Search Dropdown - Shows when searching - ERP Style Format */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute z-50 mt-12 ml-4 w-[500px] bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-auto">
                  {searchResults.map((medicine) => {
                    // Format: Medicine Name – Strength – Pack (e.g., Paracetamol 500mg – Tablet – Strip10)
                    const strength = medicine.strength || medicine.medicineStrength || '';
                    const pack = medicine.sellingUnit || medicine.packSize || medicine.baseUnit || '';
                    const displayText = `${medicine.medicineName}${strength ? ` – ${strength}` : ''}${pack ? ` – ${pack}` : ''}`;
                    
                    return (
                      <button 
                        key={medicine._id} 
                        onClick={() => addMedicineToPurchase(medicine)} 
                        className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors"
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
            <div className="border-t border-gray-200 bg-gray-50 p-4 flex-shrink-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <input type="text" value={notes} onChange={(e) => setNotes(normalizeTextInput(e.target.value))} maxLength={250} placeholder="Any additional notes..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <div className="bg-gray-900 text-white p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3">Purchase Summary</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-400">Subtotal</p>
                        <p className="text-xl font-bold">₹{totals.subtotal.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Discount</p>
                        <p className="text-xl font-bold text-green-400">-₹{totals.totalDiscount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Total GST</p>
                        <p className="text-xl font-bold">₹{totals.totalGst.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Miscellaneous</p>
                        <p className="text-xl font-bold">₹{totals.miscellaneousAmount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Grand Total</p>
                        <p className="text-2xl font-bold text-green-400">₹{totals.grandTotal.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleSavePurchase} disabled={saving || purchaseItems.length === 0} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  <Save size={20} />
                  {saving ? 'Saving...' : 'Save Purchase'}
                </button>
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

