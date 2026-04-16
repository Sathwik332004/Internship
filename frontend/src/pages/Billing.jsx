import React, { useEffect, useRef, useState } from 'react';
import { 
  Search, 
  Trash2, 
  Save, 
  Printer,
  RotateCcw,
  X,
  User,
  ShoppingCart,
  CreditCard,
  Banknote,
  Landmark,
  Smartphone,
  QrCode,
  AlertCircle,
  Boxes,
  Pill,
  Receipt,
  Package2,
  BadgePercent
} from 'lucide-react';
import api from '../services/api';
import BillPrintDocument from '../components/BillPrintDocument';
import {
  normalizePhone,
  normalizeTextInput,
  validateBillingForm
} from '../utils/validation';
import { toast } from 'react-toastify';

const SHOP_INFO = {
  name: 'BHAGYA MEDICALS',
  addressLine1: 'GROUND FLOOR PRIME CITY CENTRE MALL',
  addressLine2: 'OPP GOVT. COLLEGE KARKALA UDUPI',
  phone: '8829063939',
  email: 'devarajshetty.56@gmail.com',
  gstin: '29AEQPD2184N1ZW',
  dlNo: 'KA-UD1-267389',
  state: 'Maharashtra'
};

const BILLING_DRAFT_STORAGE_KEY = 'billing-entry-draft-v1';

export default function Billing() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchingMedicines, setSearchingMedicines] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  
  const [customerDetails, setCustomerDetails] = useState({
    name: '',
    phone: '',
    state: '',
    address: '',
    doctorName: '',
    doctorRegNo: ''
  });
  
  const [billItems, setBillItems] = useState([]);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [amountPaid, setAmountPaid] = useState('');
  const [discountType, setDiscountType] = useState('PERCENT');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmountInput, setDiscountAmountInput] = useState(0);
  const [lastSavedBill, setLastSavedBill] = useState(null);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  
  const [saving, setSaving] = useState(false);
  
  const [shopState, setShopState] = useState('Maharashtra'); // Default shop state
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerStream, setScannerStream] = useState('');
  const [lastAddedItemKey, setLastAddedItemKey] = useState('');

  const scannerInputRef = useRef(null);
  const lastScanRef = useRef({ value: '', ts: 0 });
  const highlightTimerRef = useRef(null);

  const getEmptyCustomerDetails = () => ({
    name: '',
    phone: '',
    state: '',
    address: '',
    doctorName: '',
    doctorRegNo: ''
  });

  const clearBillingFormState = () => {
    setBillItems([]);
    setCustomerDetails(getEmptyCustomerDetails());
    setPaymentMode('CASH');
    setDiscountType('PERCENT');
    setDiscountPercent(0);
    setDiscountAmountInput(0);
    setAmountPaid('');
    setErrorMessage('');
  };

  const removeBillingDraft = () => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(BILLING_DRAFT_STORAGE_KEY);
    setHasSavedDraft(false);
  };

  const clearSavedBillingDraft = () => {
    removeBillingDraft();
    clearBillingFormState();
    toast.info('Saved billing draft cleared.');
  };

  const getBillItemKey = (item = {}) =>
    String(item.inventoryBatchId || `${item.medicineId || ''}:${String(item.batchNumber || '').toUpperCase()}`);

  const mapInventoryToSearchResults = (inventoryItems = []) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const groupedMedicines = new Map();

    inventoryItems.forEach((item) => {
      const medicine = item.medicine;
      if (!medicine || !medicine._id) return;
      if ((item.quantityAvailable || 0) <= 0) return;

      const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
      if (!expiryDate || expiryDate < today) return;

      const existing = groupedMedicines.get(medicine._id);

      if (!existing) {
        groupedMedicines.set(medicine._id, {
          _id: medicine._id,
          medicineName: medicine.medicineName,
          brandName: medicine.brandName,
          hsnCodeString: medicine.hsnCodeString || item.hsnCodeString || '',
          strength: medicine.strength,
          packSize: medicine.packSize,
          baseUnit: medicine.baseUnit,
          sellingUnit: medicine.sellingUnit,
          conversionFactor: Number(medicine.conversionFactor) || 1,
          quantity: item.quantityAvailable || 0,
          expiryDate: item.expiryDate,
          defaultSellingPrice: item.mrp || 0,
          inventoryBatches: [{
            _id: item._id,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            quantityAvailable: item.quantityAvailable,
            mrp: item.mrp,
            gstPercent: item.gstPercent,
            hsnCodeString: item.hsnCodeString || medicine.hsnCodeString || ''
          }]
        });
        return;
      }

      existing.quantity += item.quantityAvailable || 0;
      existing.inventoryBatches.push({
        _id: item._id,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        quantityAvailable: item.quantityAvailable,
        mrp: item.mrp,
        gstPercent: item.gstPercent,
        hsnCodeString: item.hsnCodeString || medicine.hsnCodeString || ''
      });

      if (new Date(existing.expiryDate) > expiryDate) {
        existing.expiryDate = item.expiryDate;
        existing.defaultSellingPrice = item.mrp || existing.defaultSellingPrice;
      }
    });

    return Array.from(groupedMedicines.values())
      .sort((a, b) => (a.medicineName || '').localeCompare(b.medicineName || ''))
      .slice(0, 10);
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const savedDraft = window.localStorage.getItem(BILLING_DRAFT_STORAGE_KEY);
      if (!savedDraft) {
        setHasSavedDraft(false);
        return;
      }

      const draft = JSON.parse(savedDraft);
      setCustomerDetails({
        ...getEmptyCustomerDetails(),
        ...(draft.customerDetails || {})
      });
      setBillItems(Array.isArray(draft.billItems) ? draft.billItems : []);
      setPaymentMode(draft.paymentMode || 'CASH');
      setAmountPaid(draft.amountPaid || '');
      setDiscountType(draft.discountType === 'AMOUNT' ? 'AMOUNT' : 'PERCENT');
      setDiscountPercent(Number(draft.discountPercent) || 0);
      setDiscountAmountInput(Number(draft.discountAmountInput) || 0);
      setHasSavedDraft(true);
    } catch (error) {
      console.error('Error restoring billing draft:', error);
      window.localStorage.removeItem(BILLING_DRAFT_STORAGE_KEY);
      setHasSavedDraft(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const hasContent = billItems.length > 0
      || Object.values(customerDetails).some((value) => String(value || '').trim() !== '')
      || paymentMode !== 'CASH'
      || String(amountPaid || '').trim() !== ''
      || discountType !== 'PERCENT'
      || Number(discountPercent) !== 0
      || Number(discountAmountInput) !== 0;

    if (!hasContent) {
      window.localStorage.removeItem(BILLING_DRAFT_STORAGE_KEY);
      setHasSavedDraft(false);
      return;
    }

    const draft = {
      customerDetails,
      billItems,
      paymentMode,
      amountPaid,
      discountType,
      discountPercent,
      discountAmountInput
    };

    window.localStorage.setItem(BILLING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    setHasSavedDraft(true);
  }, [amountPaid, billItems, customerDetails, discountAmountInput, discountPercent, discountType, paymentMode]);

  // Search medicines from backend so stock is sourced from inventory, not a stale preload
  useEffect(() => {
    const trimmedSearch = searchTerm.trim();

    if (trimmedSearch.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      setSearchingMedicines(false);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      try {
        setSearchingMedicines(true);
        const response = await api.get('/medicines/search', {
          params: {
            q: trimmedSearch,
            limit: 10
          }
        });

        let results = response.data.data || [];

        // Fallback to inventory search when medicine search returns nothing
        if (results.length === 0) {
          const inventoryResponse = await api.get('/inventory', {
            params: {
              search: trimmedSearch,
              page: 1,
              limit: 50,
              sortBy: 'expiryDate',
              sortOrder: 'asc'
            }
          });

          results = mapInventoryToSearchResults(inventoryResponse.data.data || []);
        }

        if (!isCancelled) {
          setSearchResults(results);
          setShowSearchResults(true);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Error searching medicines:', error);
          setSearchResults([]);
          setShowSearchResults(true);
        }
      } finally {
        if (!isCancelled) {
          setSearchingMedicines(false);
        }
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm]);

  // Fetch inventory batches for a medicine (FIFO - earliest expiry first)
  const fetchInventoryBatches = async (medicineId) => {
    try {
      const response = await api.get(`/inventory/medicine/${medicineId}?includeZeroStock=true`);
      console.debug('[BILLING DEBUG] inventory/medicine response', medicineId, response.data);
      if (response.data.success && response.data.data.length > 0) {
        // Filter out expired batches (include today) and sort by expiry (FIFO)
        const now = new Date();
        const validBatches = response.data.data
          .filter(b => {
            const expiry = new Date(b.expiryDate);
            expiry.setHours(23, 59, 59, 999); // include the full expiry day
            return expiry >= now && b.quantityAvailable > 0;
          })
          .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
        return validBatches;
      }
      return [];
    } catch (error) {
      console.error('Error fetching inventory batches:', error);
      return [];
    }
  };

  const findAllocatableBatchForMedicine = async (medicine, currentItems = billItems, preferredIsPack) => {
    const medicineLines = currentItems.filter((item) => item.medicineId === medicine._id);
    let batches = Array.isArray(medicine.inventoryBatches) ? [...medicine.inventoryBatches] : [];

    if (!batches.length || medicineLines.length > 0) {
      batches = await fetchInventoryBatches(medicine._id);
    } else {
      const now = new Date();
      batches = batches
        .filter((batch) => {
          const expiry = new Date(batch.expiryDate);
          expiry.setHours(23, 59, 59, 999);
          return expiry >= now && Number(batch.quantityAvailable || 0) > 0;
        })
        .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    }

    const conversionFactor = Number(medicine.conversionFactor) || 1;
    const baseUnit = medicine.baseUnit || 'TAB';
    const defaultIsPack = conversionFactor > 1 && baseUnit !== 'ml';
    const targetIsPack = typeof preferredIsPack === 'boolean' ? preferredIsPack : defaultIsPack;
    const requiredBaseQty = targetIsPack ? conversionFactor : 1;

    for (const batch of batches) {
      const existingLine = medicineLines.find((item) => item.inventoryBatchId === batch._id);
      const batchCapacity = Number(existingLine?.availableStock || batch.quantityAvailable || 0);
      const allocatedBaseQty = existingLine
        ? (existingLine.isPack
          ? Number(existingLine.quantity || 0) * Number(existingLine.conversionFactor || 1)
          : Number(existingLine.quantity || 0))
        : 0;
      const remainingBaseQty = batchCapacity - allocatedBaseQty;

      if (remainingBaseQty >= requiredBaseQty) {
        return {
          batch,
          existingLine,
          batchCapacity,
          targetIsPack,
          conversionFactor,
          baseUnit
        };
      }
    }

    return {
      batch: null,
      existingLine: null,
      batchCapacity: 0,
      targetIsPack,
      conversionFactor,
      baseUnit
    };
  };

  const allocateAdditionalUnits = async (medicine, unitCount, preferredIsPack, currentItems = billItems) => {
    if (!medicine?._id || unitCount <= 0) {
      return false;
    }

    let nextItems = [...currentItems];

    for (let index = 0; index < unitCount; index += 1) {
      const allocation = await findAllocatableBatchForMedicine(medicine, nextItems, preferredIsPack);

      if (!allocation.batch) {
        setErrorMessage(`Insufficient stock for ${medicine.medicineName}`);
        return false;
      }

      if (allocation.existingLine) {
        nextItems = nextItems.map((item) => {
          if (getBillItemKey(item) !== getBillItemKey(allocation.existingLine)) {
            return item;
          }

          const nextQuantity = Number(item.quantity || 0) + 1;
          const unitMrp = item.isPack ? item.packMrp : item.looseMrp;
          return {
            ...item,
            quantity: nextQuantity,
            amount: unitMrp * nextQuantity
          };
        });
        continue;
      }

      const packMrp = Number(allocation.batch.mrp || medicine.defaultSellingPrice || 0);
      const looseMrp = allocation.conversionFactor > 0 ? packMrp / allocation.conversionFactor : packMrp;
      const defaultQty = 1;

      nextItems.push({
        medicineId: medicine._id,
        medicineName: medicine.medicineName,
        brandName: medicine.brandName,
        packSize: medicine.packSize || '1',
        conversionFactor: allocation.conversionFactor,
        baseUnit: allocation.baseUnit,
        sellingUnit: medicine.sellingUnit || allocation.baseUnit,
        isPack: allocation.targetIsPack,
        batchNumber: String(allocation.batch.batchNumber || '').toUpperCase(),
        expiryDate: allocation.batch.expiryDate,
        quantity: defaultQty,
        availableStock: allocation.batchCapacity,
        mrp: allocation.batch.mrp,
        packMrp,
        looseMrp,
        gstPercent: allocation.batch.gstPercent || 12,
        hsnCode: allocation.batch.hsnCodeString || medicine.hsnCodeString || medicine.hsnCode || '',
        inventoryBatchId: allocation.batch._id,
        amount: (allocation.targetIsPack ? packMrp : looseMrp) * defaultQty
      });
    }

    setBillItems(nextItems);
    setErrorMessage('');
    return true;
  };

  // Add medicine to bill with FIFO batch selection
  const addToBill = async (medicine) => {
    // Clear previous error
    setErrorMessage('');
    
    // Get conversion factor and pack info from medicine
    const conversionFactor = Number(medicine.conversionFactor) || 1;
    const packSize = medicine.packSize || '1';
    const baseUnit = medicine.baseUnit || 'TAB';
    const sellingUnit = medicine.sellingUnit || baseUnit;
    
    // Determine default unit (prefer pack if conversionFactor > 1, never for liquids)
    const defaultIsPack = conversionFactor > 1 && baseUnit !== 'ml';
    
    const existingItem = billItems.find(item => item.medicineId === medicine._id);
    if (existingItem) {
      await allocateAdditionalUnits(medicine, 1, existingItem.isPack);
      setSearchTerm('');
      setShowSearchResults(false);
      return;
    }

    // Fetch FIFO batches for this medicine
    let batches = medicine.inventoryBatches || [];

    if (batches.length === 0) {
      setLoadingBatches(prev => ({ ...prev, [medicine._id]: true }));
      batches = await fetchInventoryBatches(medicine._id);
      setLoadingBatches(prev => ({ ...prev, [medicine._id]: false }));
    } else {
      batches = [...batches].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    }

    if (batches.length === 0) {
      let backendStock = 0;
      try {
        const medicineResponse = await api.get(`/medicines/${medicine._id}`);
        backendStock = medicineResponse.data?.data?.quantity || 0;
      } catch (fetchError) {
        console.error('Error fetching medicine stock fallback:', fetchError);
      }

      if (backendStock > 0) {
        setErrorMessage(`Stock exists (${backendStock}) for ${medicine.medicineName}, but no suitable active/non-expired batch is available for billing.`);
      } else {
        setErrorMessage(`No stock available for ${medicine.medicineName}`);
      }

      return;
    }

    const allocation = await findAllocatableBatchForMedicine({ ...medicine, inventoryBatches: batches }, billItems, defaultIsPack);

    if (!allocation.batch) {
      setErrorMessage(`Insufficient stock for ${medicine.medicineName}`);
      return;
    }

    const defaultQty = 1;
    const newItem = {
      medicineId: medicine._id,
      medicineName: medicine.medicineName,
      brandName: medicine.brandName,
      packSize: packSize,
      conversionFactor: conversionFactor,
      baseUnit: baseUnit,
      sellingUnit: sellingUnit,
      // Unit selection (pack or loose)
      isPack: allocation.targetIsPack,
      batchNumber: allocation.batch.batchNumber.toUpperCase(),
      expiryDate: allocation.batch.expiryDate,
      quantity: defaultQty,
      availableStock: allocation.batchCapacity,
      mrp: allocation.batch.mrp,
      packMrp: allocation.batch.mrp,
      looseMrp: conversionFactor > 0 ? allocation.batch.mrp / conversionFactor : allocation.batch.mrp,
      gstPercent: allocation.batch.gstPercent || 12,
      hsnCode: allocation.batch.hsnCodeString || medicine.hsnCodeString || medicine.hsnCode || '',
      inventoryBatchId: allocation.batch._id,
      amount: (allocation.targetIsPack ? allocation.batch.mrp : allocation.batch.mrp / conversionFactor) * defaultQty
    };

    setBillItems([...billItems, newItem]);
    setSearchTerm('');
    setShowSearchResults(false);
  };

  // Toggle between pack and loose units
  const togglePackUnit = (medicineId) => {
    const item = billItems.find(i => getBillItemKey(i) === medicineId);
    if (!item || item.conversionFactor <= 1 || item.baseUnit === 'ml') {
      if (item?.baseUnit === 'ml') {
        setErrorMessage('Liquid medicines (ml) cannot be toggled to pack/loose. Use ml/bottle quantities directly.');
        setTimeout(() => setErrorMessage(''), 3000);
      }
      return;
    }
    
    const newIsPack = !item.isPack;
    const conversionFactor = Number(item.conversionFactor) || 1;
    
    // Convert quantity to maintain same base amount
    const currentBaseQty = item.isPack ? item.quantity * conversionFactor : item.quantity;
    const newQty = newIsPack ? Math.ceil(currentBaseQty / conversionFactor) : currentBaseQty;
    const nextBaseQty = newIsPack ? newQty * conversionFactor : newQty;
    
    // Validate stock after the toggle conversion
    if (nextBaseQty > item.availableStock) {
      setErrorMessage(`Insufficient stock. Available: ${item.availableStock} ${item.baseUnit}`);
      return;
    }
    
    // Calculate new amount based on unit
    const unitMrp = newIsPack ? item.packMrp : item.looseMrp;
    const newAmount = unitMrp * newQty;
    
    setBillItems(billItems.map(i => {
      if (getBillItemKey(i) === medicineId) {
        return {
          ...i,
          isPack: newIsPack,
          quantity: newQty,
          amount: newAmount
        };
      }
      return i;
    }));
    setErrorMessage('');
  };

  // Update quantity with stock validation
  const updateQuantity = async (medicineId, newQuantity) => {
    const normalizedQuantity = Math.max(0, Number(newQuantity));

    if (!Number.isFinite(normalizedQuantity)) {
      return;
    }

    const item = billItems.find(i => getBillItemKey(i) === medicineId);
    if (!item) {
      return;
    }

    const nextBaseQty = item.isPack ? normalizedQuantity * Number(item.conversionFactor || 1) : normalizedQuantity;

    if (nextBaseQty > Number(item.availableStock || 0)) {
      const medicine = {
        _id: item.medicineId,
        medicineName: item.medicineName,
        brandName: item.brandName,
        packSize: item.packSize,
        conversionFactor: item.conversionFactor,
        baseUnit: item.baseUnit,
        sellingUnit: item.sellingUnit,
        defaultSellingPrice: item.packMrp,
        hsnCodeString: item.hsnCode
      };
      const additionalUnitsNeeded = normalizedQuantity - Number(item.quantity || 0);
      if (additionalUnitsNeeded > 0) {
        const baseLineQuantity = item.isPack
          ? Math.floor(Number(item.availableStock || 0) / Number(item.conversionFactor || 1))
          : Number(item.availableStock || 0);
        const cappedItems = billItems.map((entry) => (
          getBillItemKey(entry) === medicineId
            ? { ...entry, quantity: baseLineQuantity, amount: (entry.isPack ? entry.packMrp : entry.looseMrp) * baseLineQuantity }
            : entry
        ));
        setBillItems(cappedItems);
        await allocateAdditionalUnits(medicine, additionalUnitsNeeded, item.isPack, cappedItems);
      }
      return;
    }

    setErrorMessage('');

    setBillItems(billItems.map(item => {
      if (getBillItemKey(item) === medicineId) {
        const currentUnitMrp = item.isPack ? item.packMrp : item.looseMrp;
        return {
          ...item,
          quantity: normalizedQuantity,
          amount: currentUnitMrp * normalizedQuantity
        };
      }
      return item;
    }));
  };

  const removeItem = (medicineId) => {
    setBillItems(billItems.filter(item => getBillItemKey(item) !== medicineId));
    setErrorMessage('');
  };

  const playSuccessBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.08);
    } catch (error) {
      // Keep scan flow non-blocking if audio fails.
    }
  };

  const upsertScannedItem = async (scanItem) => {
    const conversionFactor = Number(scanItem.conversionFactor) || 1;
    const baseUnit = scanItem.baseUnit || 'TAB';
    const sellingUnit = scanItem.sellingUnit || baseUnit;
    const defaultIsPack = conversionFactor > 1 && baseUnit !== 'ml';
    const packMrp = Number(scanItem.price || 0);
    const looseMrp = conversionFactor > 0 ? packMrp / conversionFactor : packMrp;
    const availableStock = Number(scanItem.availableStock || 0);
    let updatedItemKey = '';

    const existingItem = billItems.find((item) =>
      item.medicineId === scanItem.medicineId &&
      String(item.batchNumber || '').toUpperCase() === String(scanItem.batch || '').toUpperCase()
    );

    if (existingItem) {
      const nextQuantity = Number(existingItem.quantity || 0) + 1;
      const nextBaseQty = existingItem.isPack
        ? nextQuantity * Number(existingItem.conversionFactor || 1)
        : nextQuantity;

      if (nextBaseQty <= Number(existingItem.availableStock || 0)) {
        const unitMrp = existingItem.isPack ? existingItem.packMrp : existingItem.looseMrp;
        const updatedItems = billItems.map((item) => (
          getBillItemKey(item) === getBillItemKey(existingItem)
            ? {
              ...item,
              quantity: nextQuantity,
              amount: unitMrp * nextQuantity
            }
            : item
        ));
        setBillItems(updatedItems);
        updatedItemKey = getBillItemKey(existingItem);
      } else {
        const allocated = await allocateAdditionalUnits({
          _id: scanItem.medicineId,
          medicineName: scanItem.name,
          brandName: scanItem.brandName || '',
          packSize: scanItem.packSize || '',
          conversionFactor,
          baseUnit,
          sellingUnit,
          defaultSellingPrice: packMrp,
          hsnCodeString: scanItem.hsnCode || '',
          inventoryBatches: [{
            _id: scanItem.inventoryBatchId,
            batchNumber: scanItem.batch,
            expiryDate: scanItem.expiry,
            quantityAvailable: availableStock,
            mrp: packMrp,
            gstPercent: Number(scanItem.gstPercent || 0),
            hsnCodeString: scanItem.hsnCode || ''
          }]
        }, 1, existingItem.isPack);

        if (!allocated) {
          toast.error('Out of stock');
          return;
        }

        updatedItemKey = String(scanItem.inventoryBatchId || `${scanItem.medicineId}:${String(scanItem.batch || '').toUpperCase()}`);
      }
    } else {
      const newItem = {
        medicineId: scanItem.medicineId,
        inventoryBatchId: scanItem.inventoryBatchId,
        gtin: scanItem.gtin,
        medicineName: scanItem.name,
        brandName: scanItem.brandName || '',
        packSize: scanItem.packSize || '',
        conversionFactor,
        baseUnit,
        sellingUnit,
        isPack: defaultIsPack,
        batchNumber: String(scanItem.batch || '').toUpperCase(),
        expiryDate: scanItem.expiry,
        quantity: 1,
        availableStock,
        mrp: packMrp,
        packMrp,
        looseMrp,
        gstPercent: Number(scanItem.gstPercent || 0),
        hsnCode: scanItem.hsnCode || '',
        amount: defaultIsPack ? packMrp : looseMrp
      };
      updatedItemKey = getBillItemKey(newItem);
      setBillItems((previousItems) => [...previousItems, newItem]);
    }

    if (updatedItemKey) {
      setLastAddedItemKey(updatedItemKey);
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = setTimeout(() => {
        setLastAddedItemKey('');
      }, 1200);
    }
  };

  // Calculate totals and GST breakdown
  // Item prices already include GST, so GST is only extracted for display.
  const calculateTotals = () => {
    const isInterstate = customerDetails.state && 
      customerDetails.state.toLowerCase() !== shopState.toLowerCase();
    
    let subtotal = 0;
    let totalGst = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    billItems.forEach(item => {
      const { looseMrp, packMrp, gstPercent, quantity, isPack } = item;
      
      // Use appropriate MRP based on unit
      const unitMrp = isPack ? packMrp : looseMrp;
      
      // Extract base price from MRP (MRP includes GST)
      const basePrice = unitMrp / (1 + gstPercent / 100);
      const gstValue = unitMrp - basePrice;
      
      const itemBaseAmount = basePrice * quantity;
      const itemGstValue = gstValue * quantity;
      
      subtotal += unitMrp * quantity;
      totalGst += itemGstValue;

      if (isInterstate) {
        // IGST for interstate
        totalIgst += itemGstValue;
      } else {
        // CGST + SGST for intrastate (split equally)
        totalCgst += itemGstValue / 2;
        totalSgst += itemGstValue / 2;
      }
    });

    // Apply bill-level discount and round to nearest rupee for final bill amount
    const discountAmount = discountType === 'PERCENT'
      ? (subtotal * (discountPercent / 100))
      : Math.min(Number(discountAmountInput) || 0, subtotal);
    const totalAfterDiscount = subtotal - discountAmount;
    const grandTotal = Math.round(totalAfterDiscount);
    const roundOff = grandTotal - totalAfterDiscount;
    
    return {
      subtotal,
      totalGst,
      totalCgst,
      totalSgst,
      totalIgst,
      discountAmount,
      discountPercentApplied: discountType === 'PERCENT' ? Number(discountPercent || 0) : 0,
      roundOff,
      grandTotal,
      isInterstate
    };
  };

  const totals = calculateTotals();
  const parsedAmountPaid = Number.parseFloat(amountPaid);
  const effectiveAmountPaid = Number.isFinite(parsedAmountPaid) && parsedAmountPaid > 0
    ? parsedAmountPaid
    : totals.grandTotal;
  const balanceAmount = effectiveAmountPaid - totals.grandTotal;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  };

  const previewBill = billItems.length > 0
    ? {
        invoiceNumber: '',
        billDate: new Date().toISOString(),
        customerName: customerDetails.name,
        customerPhone: customerDetails.phone,
        customerState: customerDetails.state,
        customerAddress: customerDetails.address,
        doctorName: customerDetails.doctorName,
        doctorRegNo: customerDetails.doctorRegNo,
        isInterstate: totals.isInterstate,
        items: billItems.map((item) => ({
          medicineName: item.medicineName,
          brandName: item.brandName,
          hsnCode: item.hsnCode,
          packSize: item.packSize,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          quantity: item.quantity,
          quantityLabel: `${item.quantity} ${item.isPack ? 'pack' : item.baseUnit?.toLowerCase() || 'unit'}`,
          rate: item.isPack ? item.packMrp : item.looseMrp,
          gstPercent: item.gstPercent,
          total: item.amount,
          packQuantity: item.isPack ? item.quantity : 0,
          looseQuantity: item.isPack ? 0 : item.quantity
        })),
        subtotal: totals.subtotal,
        totalGst: totals.totalGst,
        totalCgst: totals.totalCgst,
        totalSgst: totals.totalSgst,
        totalIgst: totals.totalIgst,
        discountType,
        discountPercent: totals.discountPercentApplied,
        discountAmount: totals.discountAmount,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        paymentMode,
        amountPaid: effectiveAmountPaid,
        balance: balanceAmount
      }
    : lastSavedBill;

  const printPreview = () => {
    if (!previewBill) {
      return;
    }

    window.print();
  };

  // Save bill
  const handleSaveBill = async (shouldPrint = false) => {
    const validationError = validateBillingForm({
      customerDetails,
      discountType,
      discountPercent,
      discountAmount: discountAmountInput,
      subtotal: totals.subtotal,
      amountPaid,
      billItems
    });
    if (validationError) {
      setErrorMessage(validationError);
      toast.error(validationError);
      return;
    }

    setSaving(true);
    try {
      const normalizedCustomerDetails = {
        name: normalizeTextInput(customerDetails.name).trim(),
        phone: normalizePhone(customerDetails.phone),
        state: normalizeTextInput(customerDetails.state).trim(),
        address: normalizeTextInput(customerDetails.address).trim(),
        doctorName: normalizeTextInput(customerDetails.doctorName).trim(),
        doctorRegNo: normalizeTextInput(customerDetails.doctorRegNo).trim()
      };

      const billData = {
        customerName: normalizedCustomerDetails.name,
        customerPhone: normalizedCustomerDetails.phone,
        customerState: normalizedCustomerDetails.state,
        customerAddress: normalizedCustomerDetails.address,
        doctorName: normalizedCustomerDetails.doctorName,
        doctorRegNo: normalizedCustomerDetails.doctorRegNo,
        isInterstate: totals.isInterstate,
        items: billItems.map(item => {
          // Calculate base unit quantity for inventory deduction
          const baseQty = item.isPack ? item.quantity * item.conversionFactor : item.quantity;
          const unitMrp = item.isPack ? item.packMrp : item.looseMrp;
          
          return {
            medicine: item.medicineId,
            medicineName: item.medicineName,
            brandName: item.brandName,
            hsnCode: item.hsnCode,
            packSize: item.packSize,
            inventoryBatchId: item.inventoryBatchId,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            quantity: item.quantity,
            packQuantity: item.isPack ? item.quantity : 0,
            looseQuantity: item.isPack ? 0 : item.quantity,
            unitQuantity: baseQty, // Base units for inventory
            rate: unitMrp,
            gstPercent: item.gstPercent,
            cgstPercent: totals.isInterstate ? 0 : (Number(item.gstPercent || 0) / 2),
            sgstPercent: totals.isInterstate ? 0 : (Number(item.gstPercent || 0) / 2),
            discountPercent: 0,
            discountAmount: 0
          };
        }),
        subtotal: totals.subtotal,
        totalGst: totals.totalGst,
        totalCgst: totals.totalCgst,
        totalSgst: totals.totalSgst,
        totalIgst: totals.totalIgst,
        discountType,
        discountPercent: totals.discountPercentApplied,
        discountAmount: discountType === 'AMOUNT' ? (Number(discountAmountInput) || 0) : totals.discountAmount,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        paymentMode: paymentMode,
        amountPaid: effectiveAmountPaid,
        balance: balanceAmount
      };

      const response = await api.post('/bills', billData);
      const createdBill = response.data?.data || null;
      setLastSavedBill(createdBill);
      removeBillingDraft();
      
      // Reset form
      clearBillingFormState();
      toast.success(shouldPrint ? 'Bill saved. Print dialog opened.' : 'Bill saved successfully!');

      if (shouldPrint && createdBill) {
        setTimeout(() => {
          window.print();
        }, 150);
      }
    } catch (error) {
      console.error('Error saving bill:', error);
      console.error('Bill save response:', error.response?.data);
      const errorMsg = error.response?.data?.message || 'Error saving bill';
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const onBarcodeScanned = async (scanInput) => {
    try {
      const normalizedInput = String(scanInput || '').trim();
      if (!normalizedInput) return;

      const now = Date.now();
      const previous = lastScanRef.current;
      if (previous.value === normalizedInput && now - previous.ts < 300) {
        return;
      }
      lastScanRef.current = { value: normalizedInput, ts: now };

      const response = await api.post('/bills/scan', { scanInput: normalizedInput });
      const payload = response.data || {};

      if (!payload.success || !payload.item) {
        const message = payload.message || 'Invalid barcode';
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      upsertScannedItem(payload.item);
      setErrorMessage('');
      playSuccessBeep();

      if (Array.isArray(payload.warnings)) {
        payload.warnings.forEach((warning) => {
          if (warning) toast.warn(warning);
        });
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Invalid barcode';
      setErrorMessage(message);
      toast.error(message);
    }
  };

  const handleScannerInputKeyDown = (event) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    const raw = scannerStream;
    setScannerStream('');
    onBarcodeScanned(raw);
  };

  const handleScannerToggle = () => {
    setScannerActive((current) => !current);
    setScannerStream('');
  };

  useEffect(() => {
    if (!scannerActive) {
      return;
    }

    const focusInput = () => {
      scannerInputRef.current?.focus();
    };

    focusInput();
    const intervalId = setInterval(focusInput, 800);
    return () => clearInterval(intervalId);
  }, [scannerActive]);

  useEffect(() => () => {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
  }, []);

  const paymentModes = [
    { value: 'CASH', icon: Banknote, label: 'Cash' },
    { value: 'UPI', icon: Smartphone, label: 'UPI' },
    { value: 'CARD', icon: CreditCard, label: 'Card' },
    { value: 'BANK', icon: Landmark, label: 'Bank' }
  ];

  const totalUnits = billItems.reduce((sum, item) => sum + (Number(item.quantity || 0) || 0), 0);
  const nearExpiryItems = billItems.filter((item) => (
    new Date(item.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  )).length;

  return (
    <div className="min-h-screen bg-transparent p-3 sm:p-4 lg:p-6">
      <div className="no-print">
        <div className="mb-4 rounded-[20px] border border-[color:var(--border)] bg-[var(--surface)] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)] sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Billing</h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Create the bill, add medicines, and complete payment.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">Items: {billItems.length}</div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">Units: {totalUnits}</div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">Total: {formatCurrency(totals.grandTotal)}</div>
              <button
                onClick={handleScannerToggle}
                className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  scannerActive
                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                <QrCode size={16} />
                {scannerActive ? 'Scanner Active' : 'Start Scanner'}
              </button>
            </div>
          </div>

          <div className="hidden grid gap-3 border-t border-[#e3d785] bg-gradient-to-r from-[#dcc75b] via-[#e2ce67] to-[#d3be4f] px-4 py-3 text-[#4b4214] sm:grid-cols-3 sm:px-5 lg:px-6">
            <div className="rounded-[22px] border border-white/80 bg-white/80 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Receipt size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Invoice Value</p>
                  <p className="text-lg font-semibold text-slate-900">{formatCurrency(totals.subtotal)}</p>
                </div>
              </div>
            </div>
            <div className="rounded-[22px] border border-white/80 bg-white/80 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                  <Package2 size={20} />
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Dispense Queue</p>
                    <p className="text-lg font-semibold text-slate-900">{totalUnits} units across {billItems.length} lines</p>
                </div>
              </div>
            </div>
            <div className="rounded-[22px] border border-white/80 bg-white/80 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <BadgePercent size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">GST / Attention</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {formatCurrency(totals.totalGst)}
                    {totals.discountAmount > 0 ? ` • -${formatCurrency(totals.discountAmount)}` : ''}
                    </p>
                    <p className="text-xs text-slate-500">{nearExpiryItems} near-expiry item{nearExpiryItems === 1 ? '' : 's'} in bill</p>
                  </div>
              </div>
            </div>
          </div>
        </div>

        {scannerActive && (
          <div className="mb-4 rounded-[24px] border border-emerald-200 bg-gradient-to-r from-emerald-50 to-lime-50 px-4 py-4 shadow-sm">
            <p className="text-sm font-medium text-emerald-800">
              Continuous scan is active. Keep scanning to auto-add medicines directly into the active bill.
            </p>
            <input
              ref={scannerInputRef}
              type="text"
              value={scannerStream}
              onChange={(event) => setScannerStream(event.target.value)}
              onKeyDown={handleScannerInputKeyDown}
              onBlur={() => {
                if (scannerActive) {
                  setTimeout(() => scannerInputRef.current?.focus(), 0);
                }
              }}
              placeholder="Scanner input stream..."
              className="mt-3 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-[24px] border border-red-200 bg-red-50 p-4 text-red-700 shadow-sm">
            <AlertCircle size={20} />
            {errorMessage}
            <button onClick={() => setErrorMessage('')} className="ml-auto text-red-500 hover:text-red-700">
              <X size={20} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left Column - Search and Items */}
        <div className="space-y-5 xl:col-span-8">
          {/* Patient Details */}
          <div className="rounded-[28px] border border-[color:var(--border)] bg-[var(--surface)] p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--text)]">
                  <User size={20} /> Patient / Prescriber
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Keep patient, state, and doctor details visible before issuing medicines.</p>
              </div>
              {totals.isInterstate && (
                <div className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                  Interstate billing: IGST applied
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Customer Name</label>
                <input
                  type="text"
                  value={customerDetails.name}
                  maxLength={80}
                  onChange={(e) => setCustomerDetails({...customerDetails, name: normalizeTextInput(e.target.value)})}
                  placeholder="Enter customer name"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone Number</label>
                <input
                  type="tel"
                  value={customerDetails.phone}
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(e) => setCustomerDetails({...customerDetails, phone: normalizePhone(e.target.value)})}
                  placeholder="Enter phone number"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Customer State</label>
                <input
                  type="text"
                  value={customerDetails.state}
                  maxLength={50}
                  onChange={(e) => setCustomerDetails({...customerDetails, state: normalizeTextInput(e.target.value)})}
                  placeholder="e.g., Maharashtra, Karnataka"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Patient Address</label>
                <input
                  type="text"
                  value={customerDetails.address}
                  maxLength={150}
                  onChange={(e) => setCustomerDetails({...customerDetails, address: normalizeTextInput(e.target.value)})}
                  placeholder="Enter patient address"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Doctor Name</label>
                <input
                  type="text"
                  value={customerDetails.doctorName}
                  maxLength={80}
                  onChange={(e) => setCustomerDetails({...customerDetails, doctorName: normalizeTextInput(e.target.value)})}
                  placeholder="Enter doctor name"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Doctor Reg No.</label>
                <input
                  type="text"
                  value={customerDetails.doctorRegNo}
                  maxLength={40}
                  onChange={(e) => setCustomerDetails({...customerDetails, doctorRegNo: normalizeTextInput(e.target.value)})}
                  placeholder="Enter registration number"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </div>
            </div>
          </div>

          {/* Medicine Search */}
          <div className="rounded-[28px] border border-[color:var(--border)] bg-[var(--surface)] p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--text)]">
                  <Search size={20} /> Store Pharmacy
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Search medicines by generic name, brand, strength, or scanned barcode.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">Stock-aware search</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">Expiry-safe batches</span>
              </div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#fffdf8_0%,#ffffff_58%,#f1fbf8_100%)] p-3 sm:p-4">
            <div className="relative">
              <Search size={18} className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by generic name or brand name..."
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-32 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
              <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 sm:block">
                Enter 2+ chars
              </div>
              {showSearchResults && (
                <div className="absolute z-10 mt-3 max-h-72 w-full overflow-auto rounded-[24px] border border-slate-200 bg-white shadow-[0_22px_50px_rgba(15,23,42,0.12)]">
                  {searchingMedicines ? (
                    <div className="px-4 py-4 text-sm text-gray-500">Searching medicines...</div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((medicine) => (
                      <button
                        key={medicine._id}
                        onClick={() => addToBill(medicine)}
                        disabled={loadingBatches[medicine._id]}
                        className="w-full border-b border-slate-100 px-4 py-4 text-left transition hover:bg-emerald-50/60 last:border-b-0 disabled:opacity-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{medicine.medicineName}</p>
                            <p className="text-sm text-slate-500">{medicine.brandName} | {medicine.strength}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Stock: {medicine.quantity || 0} {medicine.baseUnit || ''}
                            </p>
                            {medicine.conversionFactor > 1 && (
                              <p className="mt-1 text-xs font-medium text-emerald-600">
                                Pack: {medicine.conversionFactor} {medicine.baseUnit || 'units'}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            {loadingBatches[medicine._id] ? (
                              <span className="text-xs text-gray-500 italic">Loading stock & price...</span>
                            ) : (
                              <div className="space-y-1 text-right">
                                <p className="text-sm font-bold text-slate-900">
                                  {formatCurrency(medicine.defaultSellingPrice || medicine.inventoryBatches?.[0]?.mrp || 0)}
                                </p>
                                <p className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">Add Qty: 1</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-4 text-sm text-gray-500">No medicines with available stock found.</div>
                  )}
                </div>
              )}
            </div>
            </div>
          </div>

          {/* Dispense Table */}
          <div className="overflow-hidden rounded-[28px] border border-[color:var(--border)] bg-[var(--surface)] shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
            <div className="border-b border-[#d8cf7a] bg-[linear-gradient(135deg,#121927_0%,#1b2334_68%,#202c40_100%)] px-5 py-5 text-white">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <ShoppingCart size={20} /> Store Pharmacy ({billItems.length})
                </h2>
                <p className="mt-1 text-sm text-slate-300">Review issue quantity, batch, stock, expiry, and amount before dispensing.</p>
              </div>
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                Live issue table
              </div>
            </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Line Items</p>
                  <p className="mt-1 text-xl font-semibold text-white">{billItems.length}</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Units</p>
                  <p className="mt-1 text-xl font-semibold text-white">{totalUnits}</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Payable</p>
                  <p className="mt-1 text-xl font-semibold text-white">{formatCurrency(totals.grandTotal)}</p>
                </div>
              </div>
            </div>
            
            {billItems.length === 0 ? (
              <div className="py-16 text-center text-gray-500">
                <ShoppingCart size={48} className="mx-auto mb-4 text-gray-300" />
                <p>No items added yet. Search for medicines above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-3 py-3 sm:px-4">
                <table className="w-full min-w-[1120px] overflow-hidden rounded-[22px]">
                  <thead>
                    <tr className="bg-[#f0f1e8]">
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Item Name / Generic</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pack</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Issue Unit</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Batch</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">HSN</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Expiry</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Issue Qty.</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Unit Rate</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">CGST</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">SGST</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Amount Payable</th>
                      <th className="px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 overflow-hidden rounded-b-[22px] bg-white">
                    {billItems.map((item, index) => (
                      <tr
                        key={`${getBillItemKey(item)}-${index}`}
                        className={`transition hover:bg-slate-50 ${lastAddedItemKey === getBillItemKey(item) ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-100' : ''}`}
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                              <Pill size={16} />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{item.medicineName}</p>
                              <p className="text-xs text-slate-500">{item.brandName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-sm text-slate-600">{item.packSize}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {item.conversionFactor > 1 && item.baseUnit !== 'ml' ? (
                            <button
                              onClick={() => togglePackUnit(getBillItemKey(item))}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                item.isPack 
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                                  : 'bg-orange-100 text-orange-700 border border-orange-300'
                              }`}
                              title="Click to toggle between pack and loose"
                            >
                              {item.isPack ? (
                                <>
                                  <Boxes size={12} /> Pack
                                </>
                              ) : (
                                <>
                                  <Pill size={12} /> Loose
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-sm font-mono text-slate-600">{item.batchNumber}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">{item.hsnCode || '-'}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-sm font-medium ${new Date(item.expiryDate) < new Date(Date.now() + 90*24*60*60*1000) ? 'text-orange-600' : 'text-slate-600'}`}>
                            {formatDate(item.expiryDate)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <input 
                              type="number" 
                              min="0"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(getBillItemKey(item), e.target.value)}
                              className="w-20 rounded-xl border border-slate-200 px-2 py-1.5 text-center font-medium outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              onWheel={(e) => e.preventDefault()}
                            />
                            <button
                              onClick={() => updateQuantity(getBillItemKey(item), item.quantity - 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                              disabled={item.quantity <= 0}
                            >-</button>
                            <button
                              onClick={() => updateQuantity(getBillItemKey(item), item.quantity + 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                            >+</button>
                          </div>
                          <p className="mt-1 text-center text-xs text-slate-400">
                            Stock: {item.availableStock} {item.baseUnit}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="font-medium text-slate-900">{formatCurrency(item.isPack ? item.packMrp : item.looseMrp)}</span>
                          {item.conversionFactor > 1 && (
                            <p className="text-xs text-slate-400">
                              ({item.isPack ? '1' : item.conversionFactor} {item.baseUnit})
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-sm text-slate-700">
                            {(Number(item.gstPercent || 0) / 2).toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-sm text-slate-700">
                            {(Number(item.gstPercent || 0) / 2).toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-lg font-bold text-slate-900">{formatCurrency(item.amount)}</span>
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => removeItem(getBillItemKey(item))}
                            className="rounded-xl p-2 text-red-600 transition hover:bg-red-50"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Prepared Lines</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{billItems.length} rows ready</p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">GST Captured</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(totals.totalGst)}</p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Bill Total</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(totals.grandTotal)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-5 xl:col-span-4">
          {/* Payment Details */}
          <div className="overflow-hidden rounded-[28px] border border-[color:var(--border)] bg-[var(--surface)] shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
            <div className="border-b border-[color:var(--border)] px-5 py-4">
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-900">Payments</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Select mode, amount collected, and billing discount.</p>
            </div>
            <div className="space-y-5 p-5">
            
            {/* Payment Mode */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Mode of Payment</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {paymentModes.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setPaymentMode(value)}
                    className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-xs font-semibold transition ${
                      paymentMode === value
                        ? 'border-[#171717] bg-[#171717] text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Paid */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Amount Collected</label>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="Leave blank for full payment"
                min="0"
                step="0.01"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            {/* Bill Discount */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Discounts</label>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType('PERCENT');
                    setDiscountAmountInput(0);
                  }}
                  className={`rounded-2xl border px-2 py-2 text-xs font-semibold transition ${discountType === 'PERCENT' ? 'border-[#171717] bg-[#171717] text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  Percent
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType('AMOUNT');
                    setDiscountPercent(0);
                  }}
                  className={`rounded-2xl border px-2 py-2 text-xs font-semibold transition ${discountType === 'AMOUNT' ? 'border-[#171717] bg-[#171717] text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  Amount
                </button>
              </div>
              {discountType === 'PERCENT' ? (
                <input
                  type="number"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Math.min(parseFloat(e.target.value) || 0, 100))}
                  min="0"
                  max="100"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              ) : (
                <input
                  type="number"
                  value={discountAmountInput}
                  onChange={(e) => setDiscountAmountInput(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              )}
            </div>
            </div>
          </div>

          {/* Bill Summary */}
          <div className="sticky top-4 overflow-hidden rounded-[30px] border border-[color:var(--border)] bg-[var(--surface)] shadow-[0_22px_44px_rgba(15,23,42,0.08)]">
            <div className="border-b border-[color:var(--border)] bg-gradient-to-br from-slate-950 via-slate-900 to-[#303722] px-5 py-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#e6eba8]">Summary</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-300">Payable Amount</p>
                  <p className="text-3xl font-semibold tracking-tight">{formatCurrency(totals.grandTotal)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Collected</p>
                  <p className="text-sm font-semibold">{formatCurrency(effectiveAmountPaid)}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-300">Mode</p>
                  <p className="mt-1 text-sm font-semibold">{paymentMode}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-300">Lines</p>
                  <p className="mt-1 text-sm font-semibold">{billItems.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-300">Due</p>
                  <p className="mt-1 text-sm font-semibold">{formatCurrency(Math.abs(balanceAmount))}</p>
                </div>
              </div>
            </div>
            <div className="text-sm text-slate-900">
              <div className="flex justify-between border-b border-slate-100 px-5 py-3">
                <span className="font-medium">Subtotal (Incl. GST)</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              
              {totals.discountAmount > 0 && (
                <div className="flex justify-between border-b border-slate-100 px-5 py-3">
                  <span className="font-medium">Discount ({discountType === 'PERCENT' ? `${Number(discountPercent || 0).toFixed(2)}%` : 'Amount'})</span>
                  <span>-{formatCurrency(totals.discountAmount)}</span>
                </div>
              )}
              
              {/* GST Breakdown */}
              <div>
                {totals.isInterstate ? (
                  <div className="flex justify-between border-b border-slate-100 px-5 py-3">
                    <span className="font-medium">IGST</span>
                    <span>{formatCurrency(totals.totalIgst)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between border-b border-slate-100 px-5 py-3">
                      <span className="font-medium">CGST</span>
                      <span>{formatCurrency(totals.totalCgst)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 px-5 py-3">
                      <span className="font-medium">SGST</span>
                      <span>{formatCurrency(totals.totalSgst)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between border-b border-slate-100 px-5 py-3 font-medium">
                  <span>Total GST</span>
                  <span>{formatCurrency(totals.totalGst)}</span>
                </div>
              </div>
              
              <div className="flex justify-between border-b border-slate-100 px-5 py-4 text-lg font-bold">
                <span>Invoice Total</span>
                <span>{formatCurrency(totals.grandTotal)}</span>
                </div>
              
              {/* Payment Info */}
              <div>
                <div className="flex justify-between border-b border-slate-100 px-5 py-3">
                  <span className="font-medium">Paid</span>
                  <span>{formatCurrency(effectiveAmountPaid)}</span>
                </div>
                <div className="flex justify-between px-5 py-3">
                  <span className="font-medium">{balanceAmount >= 0 ? 'Change / Balance' : 'Amount Due'}</span>
                  <span className={balanceAmount >= 0 ? 'text-gray-900' : 'text-red-700'}>
                    {formatCurrency(Math.abs(balanceAmount))}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 border-t border-slate-100 bg-slate-50/70 p-4">
              <button
                onClick={clearSavedBillingDraft}
                disabled={!hasSavedDraft && billItems.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw size={18} />
                Clear Saved Draft
              </button>
              <button
                onClick={() => handleSaveBill(false)}
                disabled={saving || billItems.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#171717] bg-[#171717] py-3 font-semibold text-white transition hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={20} />
                {saving ? 'Saving...' : 'Save Bill'}
              </button>
              <button
                onClick={() => handleSaveBill(true)}
                disabled={saving || billItems.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Printer size={20} />
                Save & Print
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>

      {previewBill && (
        <div className="mt-8">
          <div className="bill-print-controls no-print mb-4 flex flex-col gap-3 rounded-[28px] border border-[color:var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Invoice Preview</h2>
              <p className="text-sm text-slate-600">
                {billItems.length > 0
                  ? 'This preview uses one fixed customer bill format and is ready to print after save.'
                  : 'Last saved bill is ready for reprint in the same customer format.'}
              </p>
            </div>
            <button
              onClick={printPreview}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Printer size={18} />
              {billItems.length > 0 ? 'Print Preview' : 'Reprint Bill'}
            </button>
          </div>

          <BillPrintDocument
            bill={previewBill}
            shopInfo={{ ...SHOP_INFO, state: shopState }}
            isDraft={billItems.length > 0}
          />
        </div>
      )}
    </div>
  );
}

