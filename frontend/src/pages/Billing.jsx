import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Trash2, 
  Save, 
  Printer,
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
  Pill
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

const BILLING_DRAFT_STORAGE_KEY = 'billing-entry-draft-v1';

const DEFAULT_CUSTOMER_DETAILS = {
  name: '',
  phone: '',
  state: '',
  address: '',
  doctorName: '',
  doctorRegNo: ''
};

const hasBillingDraftData = (draft = {}) => Boolean(
  (Array.isArray(draft.billItems) && draft.billItems.length > 0)
  || Object.values({ ...DEFAULT_CUSTOMER_DETAILS, ...(draft.customerDetails || {}) }).some((value) => String(value || '').trim())
  || (draft.paymentMode && draft.paymentMode !== 'CASH')
  || String(draft.amountPaid || '').trim()
  || (draft.discountType === 'AMOUNT' && Number(draft.discountAmountInput || 0) > 0)
  || (draft.discountType !== 'AMOUNT' && Number(draft.discountPercent || 0) > 0)
);

export default function Billing() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchingMedicines, setSearchingMedicines] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [billingDraftHydrated, setBillingDraftHydrated] = useState(false);
  
  const [customerDetails, setCustomerDetails] = useState(DEFAULT_CUSTOMER_DETAILS);
  
  const [billItems, setBillItems] = useState([]);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [amountPaid, setAmountPaid] = useState('');
  const [discountType, setDiscountType] = useState('PERCENT');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmountInput, setDiscountAmountInput] = useState(0);
  const [lastSavedBill, setLastSavedBill] = useState(null);
  
  const [saving, setSaving] = useState(false);
  
  const [shopState, setShopState] = useState('Maharashtra'); // Default shop state

  useEffect(() => {
    if (typeof window === 'undefined') {
      setBillingDraftHydrated(true);
      return;
    }

    try {
      const savedDraft = window.localStorage.getItem(BILLING_DRAFT_STORAGE_KEY);

      if (!savedDraft) {
        return;
      }

      const parsedDraft = JSON.parse(savedDraft);
      setCustomerDetails({ ...DEFAULT_CUSTOMER_DETAILS, ...(parsedDraft.customerDetails || {}) });
      setBillItems(Array.isArray(parsedDraft.billItems) ? parsedDraft.billItems : []);
      setPaymentMode(parsedDraft.paymentMode || 'CASH');
      setAmountPaid(parsedDraft.amountPaid ?? '');
      setDiscountType(parsedDraft.discountType === 'AMOUNT' ? 'AMOUNT' : 'PERCENT');
      setDiscountPercent(Number(parsedDraft.discountPercent) || 0);
      setDiscountAmountInput(Number(parsedDraft.discountAmountInput) || 0);
    } catch (error) {
      console.error('Error restoring billing draft:', error);
      window.localStorage.removeItem(BILLING_DRAFT_STORAGE_KEY);
    } finally {
      setBillingDraftHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!billingDraftHydrated || typeof window === 'undefined') {
      return;
    }

    const draftPayload = {
      customerDetails,
      billItems,
      paymentMode,
      amountPaid,
      discountType,
      discountPercent,
      discountAmountInput
    };

    if (hasBillingDraftData(draftPayload)) {
      window.localStorage.setItem(BILLING_DRAFT_STORAGE_KEY, JSON.stringify(draftPayload));
      return;
    }

    window.localStorage.removeItem(BILLING_DRAFT_STORAGE_KEY);
  }, [
    billingDraftHydrated,
    customerDetails,
    billItems,
    paymentMode,
    amountPaid,
    discountType,
    discountPercent,
    discountAmountInput
  ]);

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

  const getAllocatableBatchForMedicine = async (medicine) => {
    const medicineLines = billItems.filter((item) => item.medicineId === medicine._id);
    let batches = Array.isArray(medicine.inventoryBatches) ? [...medicine.inventoryBatches] : [];

    if (batches.length === 0 || medicineLines.length > 0) {
      setLoadingBatches(prev => ({ ...prev, [medicine._id]: true }));
      batches = await fetchInventoryBatches(medicine._id);
      setLoadingBatches(prev => ({ ...prev, [medicine._id]: false }));
    } else {
      batches = batches
        .filter((batch) => {
          const expiry = new Date(batch.expiryDate);
          expiry.setHours(23, 59, 59, 999);
          return expiry >= new Date() && Number(batch.quantityAvailable || 0) > 0;
        })
        .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    }

    if (!batches.length) {
      return { batches: [], selectedBatch: null, existingLine: null, batchCapacity: 0 };
    }

    for (const batch of batches) {
      const batchKey = getBatchKey(batch);
      const existingLine = medicineLines.find((item) => getBatchKey(item) === batchKey);
      const batchCapacity = existingLine
        ? Number(existingLine.availableStock || 0)
        : Number(batch.quantityAvailable || 0);
      const allocatedQuantity = existingLine ? getItemBaseQuantity(existingLine) : 0;

      if (allocatedQuantity < batchCapacity) {
        return { batches, selectedBatch: batch, existingLine, batchCapacity };
      }
    }

    return { batches, selectedBatch: null, existingLine: null, batchCapacity: 0 };
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
    
    const { batches, selectedBatch, existingLine, batchCapacity } = await getAllocatableBatchForMedicine(medicine);

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

    if (existingLine) {
      updateQuantity(getLineKey(existingLine), existingLine.quantity + 1);
      setSearchTerm('');
      setShowSearchResults(false);
      return;
    }

    if (!selectedBatch) {
      setErrorMessage(`Insufficient stock for ${medicine.medicineName}`);
      return;
    }

    const minQty = defaultIsPack ? conversionFactor : 1;
    
    if (batchCapacity < minQty) {
      setErrorMessage(`Insufficient stock for ${medicine.medicineName}`);
      return;
    }

    // Calculate default quantity based on unit
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
      isPack: defaultIsPack,
      // Batch info from FIFO
      batchNumber: selectedBatch.batchNumber.toUpperCase(),
      expiryDate: selectedBatch.expiryDate,
      quantity: defaultQty,
      // Stock in base units
      availableStock: batchCapacity,
      mrp: selectedBatch.mrp,
      // MRP for both pack and loose
      packMrp: selectedBatch.mrp,
      looseMrp: conversionFactor > 0 ? selectedBatch.mrp / conversionFactor : selectedBatch.mrp,
      gstPercent: selectedBatch.gstPercent || 12,
      hsnCode: selectedBatch.hsnCodeString || medicine.hsnCodeString || medicine.hsnCode || '',
      inventoryBatchId: selectedBatch._id,
      // Calculate amount: MRP * Qty (respecting pack/loose)
      amount: (defaultIsPack ? selectedBatch.mrp : selectedBatch.mrp / conversionFactor) * defaultQty
    };

    setBillItems([...billItems, newItem]);
    setSearchTerm('');
    setShowSearchResults(false);
  };

  // Toggle between pack and loose units
  const togglePackUnit = (lineKey) => {
    const item = billItems.find(i => getLineKey(i) === lineKey);
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
      if (getLineKey(i) === lineKey) {
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
  const updateQuantity = (lineKey, newQuantity) => {
    const normalizedQuantity = Math.max(0, Number(newQuantity));

    if (!Number.isFinite(normalizedQuantity)) {
      return;
    }

    // Find the item and check stock (allow 0 quantity)
    const item = billItems.find(i => getLineKey(i) === lineKey);
    if (item && normalizedQuantity > 0) {
      // Convert to base units for comparison (skip for qty=0)
      const baseQty = item.isPack ? normalizedQuantity * item.conversionFactor : normalizedQuantity;
      
      if (baseQty > item.availableStock) {
        setErrorMessage(`Insufficient stock for ${item.medicineName}. Available: ${item.availableStock} ${item.baseUnit}`);
        return;
      }
    }
    
    setErrorMessage('');
    
    // Calculate amount based on unit (0 qty = 0 amount)
    setBillItems(billItems.map(item => {
      if (getLineKey(item) === lineKey) {
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

  const removeItem = (lineKey) => {
    setBillItems(billItems.filter(item => getLineKey(item) !== lineKey));
    setErrorMessage('');
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

  const clearBillingDraft = (clearPreview = false) => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(BILLING_DRAFT_STORAGE_KEY);
    }

    setSearchTerm('');
    setSearchResults([]);
    setShowSearchResults(false);
    setSearchingMedicines(false);
    setLoadingBatches({});
    setErrorMessage('');
    setCustomerDetails({ ...DEFAULT_CUSTOMER_DETAILS });
    setBillItems([]);
    setPaymentMode('CASH');
    setAmountPaid('');
    setDiscountType('PERCENT');
    setDiscountPercent(0);
    setDiscountAmountInput(0);

    if (clearPreview) {
      setLastSavedBill(null);
    }
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
      
      // Reset form
      clearBillingDraft();
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

  // Handle QR code scan (placeholder)
  const handleQRScan = () => {
    toast.info('QR Code scanning feature - integrate with your QR scanner hardware');
  };

  const hasUnsavedBillingDraft = hasBillingDraftData({
    customerDetails,
    billItems,
    paymentMode,
    amountPaid,
    discountType,
    discountPercent,
    discountAmountInput
  });

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-6">
      <div className="no-print">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Billing / POS</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                clearBillingDraft();
                toast.success('Billing draft cleared.');
              }}
              disabled={!hasUnsavedBillingDraft}
              className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={18} />
              Clear Saved Draft
            </button>
            <button
              onClick={handleQRScan}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              <QrCode size={20} />
              Scan
            </button>
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle size={20} />
            {errorMessage}
            <button onClick={() => setErrorMessage('')} className="ml-auto text-red-500 hover:text-red-700">
              <X size={20} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Left Column - Search and Items */}
        <div className="lg:col-span-3 space-y-4">
          {/* Customer Details */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User size={20} /> Customer Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerDetails.name}
                  maxLength={80}
                  onChange={(e) => setCustomerDetails({...customerDetails, name: normalizeTextInput(e.target.value)})}
                  placeholder="Enter customer name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={customerDetails.phone}
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(e) => setCustomerDetails({...customerDetails, phone: normalizePhone(e.target.value)})}
                  placeholder="Enter phone number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer State
                  {totals.isInterstate && <span className="text-xs text-amber-600 ml-2">(Interstate - IGST)</span>}
                </label>
                <input
                  type="text"
                  value={customerDetails.state}
                  maxLength={50}
                  onChange={(e) => setCustomerDetails({...customerDetails, state: normalizeTextInput(e.target.value)})}
                  placeholder="e.g., Maharashtra, Karnataka"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient Address</label>
                <input
                  type="text"
                  value={customerDetails.address}
                  maxLength={150}
                  onChange={(e) => setCustomerDetails({...customerDetails, address: normalizeTextInput(e.target.value)})}
                  placeholder="Enter patient address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Doctor Name</label>
                <input
                  type="text"
                  value={customerDetails.doctorName}
                  maxLength={80}
                  onChange={(e) => setCustomerDetails({...customerDetails, doctorName: normalizeTextInput(e.target.value)})}
                  placeholder="Enter doctor name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Doctor Reg No.</label>
                <input
                  type="text"
                  value={customerDetails.doctorRegNo}
                  maxLength={40}
                  onChange={(e) => setCustomerDetails({...customerDetails, doctorRegNo: normalizeTextInput(e.target.value)})}
                  placeholder="Enter registration number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Medicine Search */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Search size={20} /> Search Medicines
            </h2>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, brand, or barcode..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
              {showSearchResults && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
                  {searchingMedicines ? (
                    <div className="px-4 py-3 text-sm text-gray-500">Searching medicines...</div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((medicine) => (
                      <button
                        key={medicine._id}
                        onClick={() => addToBill(medicine)}
                        disabled={loadingBatches[medicine._id]}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 disabled:opacity-50"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-gray-900">{medicine.medicineName}</p>
                            <p className="text-sm text-gray-500">{medicine.brandName} | {medicine.strength}</p>
                            <p className="text-xs text-gray-500">
                              Stock: {medicine.quantity || 0} {medicine.baseUnit || ''}
                            </p>
                            {medicine.conversionFactor > 1 && (
                              <p className="text-xs text-emerald-600">
                                Pack: {medicine.conversionFactor} {medicine.baseUnit || 'units'}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            {loadingBatches[medicine._id] ? (
                              <span className="text-xs text-gray-500 italic">Loading stock & price...</span>
                            ) : (
                              <div className="text-right space-y-0.5">
                                <p className="text-sm font-bold text-gray-900">
                                  {formatCurrency(medicine.defaultSellingPrice || medicine.inventoryBatches?.[0]?.mrp || 0)}
                                </p>
                                <p className="text-xs text-emerald-600 font-medium">Qty: 1</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-gray-500">No medicines with available stock found.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bill Items Table */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ShoppingCart size={20} /> Bill Items ({billItems.length})
            </h2>
            
            {billItems.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ShoppingCart size={48} className="mx-auto mb-4 text-gray-300" />
                <p>No items added yet. Search for medicines above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Pack</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Unit</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Batch</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">HSN</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Expiry</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">MRP</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">CGST</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">SGST</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {billItems.map((item) => (
                      <tr key={getLineKey(item)} className="hover:bg-gray-50">
                        <td className="px-3 py-3">
                          <p className="font-medium text-gray-900">{item.medicineName}</p>
                          <p className="text-xs text-gray-500">{item.brandName}</p>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-sm text-gray-600">{item.packSize}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {item.conversionFactor > 1 && item.baseUnit !== 'ml' ? (
                            <button
                              onClick={() => togglePackUnit(getLineKey(item))}
                              className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
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
                          <span className="text-sm font-mono text-gray-600">{item.batchNumber}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-sm text-gray-600">{item.hsnCode || '-'}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-sm ${new Date(item.expiryDate) < new Date(Date.now() + 90*24*60*60*1000) ? 'text-orange-600' : 'text-gray-600'}`}>
                            {formatDate(item.expiryDate)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <input 
                              type="number" 
                              min="0"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(getLineKey(item), e.target.value)}
                              className="w-20 text-center font-medium border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              onWheel={(e) => e.preventDefault()}
                            />
                            <button
                              onClick={() => updateQuantity(getLineKey(item), item.quantity - 1)}
                              className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                              disabled={item.quantity <= 0}
                            >-</button>
                            <button
                              onClick={() => updateQuantity(getLineKey(item), item.quantity + 1)}
                              className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                            >+</button>
                          </div>
                          <p className="text-xs text-center text-gray-400 mt-1">
                            Stock: {item.availableStock} {item.baseUnit}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="font-medium">{formatCurrency(item.isPack ? item.packMrp : item.looseMrp)}</span>
                          {item.conversionFactor > 1 && (
                            <p className="text-xs text-gray-400">
                              ({item.isPack ? '1' : item.conversionFactor} {item.baseUnit})
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-sm text-gray-700">
                            {(Number(item.gstPercent || 0) / 2).toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-sm text-gray-700">
                            {(Number(item.gstPercent || 0) / 2).toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="font-bold text-lg">{formatCurrency(item.amount)}</span>
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => removeItem(getLineKey(item))}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-4">
          {/* Payment Details */}
          <div className="bg-white border border-black">
            <div className="border-b border-black px-4 py-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-black">Payment</h2>
            </div>
            <div className="p-4">
            
            {/* Payment Mode */}
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-2">Mode</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { value: 'CASH', icon: Banknote, label: 'Cash' },
                  { value: 'UPI', icon: Smartphone, label: 'UPI' },
                  { value: 'CARD', icon: CreditCard, label: 'Card' },
                  { value: 'BANK', icon: Landmark, label: 'Bank' }
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setPaymentMode(value)}
                    className={`px-2 py-2 border flex flex-col items-center gap-1 text-xs ${
                      paymentMode === value
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-black hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Paid */}
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1">Amount Paid</label>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="Leave blank for full payment"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-black focus:ring-0"
              />
            </div>

            {/* Bill Discount */}
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1">Bill Discount</label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType('PERCENT');
                    setDiscountAmountInput(0);
                  }}
                  className={`border px-2 py-2 text-xs font-semibold ${discountType === 'PERCENT' ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-black hover:bg-gray-50'}`}
                >
                  Percent
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType('AMOUNT');
                    setDiscountPercent(0);
                  }}
                  className={`border px-2 py-2 text-xs font-semibold ${discountType === 'AMOUNT' ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-black hover:bg-gray-50'}`}
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
                  className="w-full px-3 py-2 border border-black focus:ring-0"
                />
              ) : (
                <input
                  type="number"
                  value={discountAmountInput}
                  onChange={(e) => setDiscountAmountInput(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-black focus:ring-0"
                />
              )}
            </div>
            </div>
          </div>

          {/* Bill Summary */}
          <div className="bg-white border border-black sticky top-4">
            <div className="border-b border-black px-4 py-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-black">Bill Summary</h2>
            </div>
            <div className="text-sm text-black">
              <div className="flex justify-between border-b border-black px-4 py-2">
                <span className="font-medium">Subtotal (Incl. GST)</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              
              {totals.discountAmount > 0 && (
                <div className="flex justify-between border-b border-black px-4 py-2">
                  <span className="font-medium">Discount ({discountType === 'PERCENT' ? `${Number(discountPercent || 0).toFixed(2)}%` : 'Amount'})</span>
                  <span>-{formatCurrency(totals.discountAmount)}</span>
                </div>
              )}
              
              {/* GST Breakdown */}
              <div>
                {totals.isInterstate ? (
                  <div className="flex justify-between border-b border-black px-4 py-2">
                    <span className="font-medium">IGST</span>
                    <span>{formatCurrency(totals.totalIgst)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between border-b border-black px-4 py-2">
                      <span className="font-medium">CGST</span>
                      <span>{formatCurrency(totals.totalCgst)}</span>
                    </div>
                    <div className="flex justify-between border-b border-black px-4 py-2">
                      <span className="font-medium">SGST</span>
                      <span>{formatCurrency(totals.totalSgst)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between border-b border-black px-4 py-2 font-medium">
                  <span>Total GST</span>
                  <span>{formatCurrency(totals.totalGst)}</span>
                </div>
              </div>
              
              <div className="flex justify-between px-4 py-3 text-2xl font-bold border-b border-black">
                <span>Grand Total</span>
                <span>{formatCurrency(totals.grandTotal)}</span>
                </div>
              
              {/* Payment Info */}
              <div>
                <div className="flex justify-between border-b border-black px-4 py-2">
                  <span className="font-medium">Paid</span>
                  <span>{formatCurrency(effectiveAmountPaid)}</span>
                </div>
                <div className="flex justify-between px-4 py-2">
                  <span className="font-medium">{balanceAmount >= 0 ? 'Change / Balance' : 'Amount Due'}</span>
                  <span className={balanceAmount >= 0 ? 'text-black' : 'text-red-700'}>
                    {formatCurrency(Math.abs(balanceAmount))}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 border-t border-black p-4">
              <p className="text-xs text-gray-500">Billing details save automatically in this browser while you type.</p>
              <button
                onClick={() => handleSaveBill(false)}
                disabled={saving || billItems.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-black text-white py-3 border border-black hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                <Save size={20} />
                {saving ? 'Saving...' : 'Save Bill'}
              </button>
              <button
                onClick={() => handleSaveBill(true)}
                disabled={saving || billItems.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-white text-gray-900 py-3 border border-black hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
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
          <div className="bill-print-controls no-print mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
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

