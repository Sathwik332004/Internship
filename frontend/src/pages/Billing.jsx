import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Trash2, 
  Save, 
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
    state: ''
  });
  
  const [billItems, setBillItems] = useState([]);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [amountPaid, setAmountPaid] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  
  const [saving, setSaving] = useState(false);
  
  const [shopState, setShopState] = useState('Maharashtra'); // Default shop state

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
            gstPercent: item.gstPercent
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
        gstPercent: item.gstPercent
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

  // Add medicine to bill with FIFO batch selection
  const addToBill = async (medicine) => {
    // Clear previous error
    setErrorMessage('');
    
    // Get conversion factor and pack info from medicine
    const conversionFactor = Number(medicine.conversionFactor) || 1;
    const packSize = medicine.packSize || '1';
    const baseUnit = medicine.baseUnit || 'TAB';
    const sellingUnit = medicine.sellingUnit || baseUnit;
    
    // Determine default unit (prefer pack if conversionFactor > 1)
    const defaultIsPack = conversionFactor > 1;
    
    // Check if already in bill - if so, just increment quantity
    const existingItem = billItems.find(item => item.medicineId === medicine._id);
    if (existingItem) {
      // Determine increment based on current unit
      const increment = 1;
      const newQty = existingItem.quantity + increment;
      const newQty = existingItem.quantity + 1;
      
      // Validate stock (convert to base units for comparison)
      const newBaseQty = existingItem.isPack 
        ? (existingItem.quantity + increment) * conversionFactor 
        : existingItem.quantity + increment;
      
      if (newBaseQty > existingItem.availableStock) {
        setErrorMessage(`Insufficient stock for ${medicine.medicineName}. Available: ${existingItem.availableStock} ${baseUnit}`);
        return;
      }
      
      updateQuantity(medicine._id, newQty);
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

    // Select FIFO batch (earliest expiry)
    const fifoBatch = batches[0];
    
    // Validate stock - use base unit quantity
    const availableBaseQty = fifoBatch.quantityAvailable;
    const minQty = defaultIsPack ? conversionFactor : 1;
    
    if (availableBaseQty < minQty) {
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
      batchNumber: fifoBatch.batchNumber.toUpperCase(),
      expiryDate: fifoBatch.expiryDate,
      quantity: defaultQty,
      // Stock in base units
      availableStock: availableBaseQty,
      mrp: fifoBatch.mrp,
      // MRP for both pack and loose
      packMrp: fifoBatch.mrp,
      looseMrp: conversionFactor > 0 ? fifoBatch.mrp / conversionFactor : fifoBatch.mrp,
      gstPercent: fifoBatch.gstPercent || 12,
      inventoryBatchId: fifoBatch._id,
      // Calculate amount: MRP * Qty (respecting pack/loose)
      amount: (defaultIsPack ? fifoBatch.mrp : fifoBatch.mrp / conversionFactor) * defaultQty
    };

    setBillItems([...billItems, newItem]);
    setSearchTerm('');
    setShowSearchResults(false);
  };

  // Toggle between pack and loose units
  const togglePackUnit = (medicineId) => {
    const item = billItems.find(i => i.medicineId === medicineId);
    if (!item || item.conversionFactor <= 1) return; // No conversion for single-unit medicines
    
    const newIsPack = !item.isPack;
    const conversionFactor = Number(item.conversionFactor) || 1;
    
    // Convert quantity to maintain same base amount
    const currentBaseQty = item.isPack ? item.quantity * conversionFactor : item.quantity;
    const newQty = newIsPack ? Math.ceil(currentBaseQty / conversionFactor) : currentBaseQty;
    
    // Validate stock - use current base qty before toggle
    if (currentBaseQty > item.availableStock) {
      setErrorMessage(`Insufficient stock. Available: ${item.availableStock} ${item.baseUnit}`);
      return;
    }
    
    // Calculate new amount based on unit
    const unitMrp = newIsPack ? item.packMrp : item.looseMrp;
    const newAmount = unitMrp * newQty;
    
    setBillItems(billItems.map(i => {
      if (i.medicineId === medicineId) {
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
  const updateQuantity = (medicineId, newQuantity) => {
    const normalizedQuantity = Number(newQuantity);

    if (!Number.isFinite(normalizedQuantity)) {
      return;
    }

    if (normalizedQuantity < 1) {
      removeItem(medicineId);
      return;
    }
  if (newQuantity < 1) {
    removeItem(medicineId);
    return;
  }

    // Find the item and check stock
    const item = billItems.find(i => i.medicineId === medicineId);
    if (item) {
      // Convert to base units for comparison
      const baseQty = item.isPack ? normalizedQuantity * item.conversionFactor : normalizedQuantity;
      
      if (baseQty > item.availableStock) {
        setErrorMessage(`Insufficient stock for ${item.medicineName}. Available: ${item.availableStock} ${item.baseUnit}`);
        return;
      }
    }
    
    setErrorMessage('');
    
    // Calculate amount based on unit
    setBillItems(billItems.map(item => {
      if (item.medicineId === medicineId) {
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
  const item = billItems.find(i => i.medicineId === medicineId);
  if (!item) return;

  // convert to base tablets
  const baseQty = item.isPack
    ? newQuantity * item.conversionFactor
    : newQuantity;

  if (baseQty > item.availableStock) {
    setErrorMessage(
      `Insufficient stock for ${item.medicineName}. Available: ${item.availableStock} ${item.baseUnit}`
    );
    return;
  }

  setErrorMessage("");

  const unitPrice = item.isPack ? item.packMrp : item.looseMrp;

  setBillItems(prev =>
    prev.map(i =>
      i.medicineId === medicineId
        ? {
            ...i,
            quantity: newQuantity,
            amount: unitPrice * newQuantity
          }
        : i
    )
  );
};

  const removeItem = (medicineId) => {
    setBillItems(billItems.filter(item => item.medicineId !== medicineId));
    setErrorMessage('');
  };

  // Calculate totals and GST breakdown
  // GST is extracted from MRP: BasePrice = MRP / (1 + GST/100)
  const calculateTotals = () => {
    const isInterstate = customerDetails.state && 
      customerDetails.state.toLowerCase() !== shopState.toLowerCase();
    
    let subtotal = 0; // Base price (without GST)
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
      
      subtotal += itemBaseAmount;
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

    // Apply discount
    const discountAmount = (subtotal * discountPercent) / 100;
    const grandTotal = subtotal + totalGst - discountAmount;
    
    return {
      subtotal,
      totalGst,
      totalCgst,
      totalSgst,
      totalIgst,
      discountAmount,
      grandTotal,
      isInterstate
    };
  };

  const totals = calculateTotals();

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

  // Save bill
  const handleSaveBill = async () => {
    if (billItems.length === 0) {
      alert('Please add at least one item to the bill');
      return;
    }

    // Final validation
    for (const item of billItems) {
      if (item.quantity <= 0) {
        alert('Quantity must be greater than 0');
        return;
      }
      
      // Calculate base unit quantity
      const baseQty = item.isPack ? item.quantity * item.conversionFactor : item.quantity;
      if (baseQty > item.availableStock) {
        alert(`Insufficient stock for ${item.medicineName}`);
        return;
      }
    }

    setSaving(true);
    try {
      const billData = {
        customerName: customerDetails.name,
        customerPhone: customerDetails.phone,
        customerState: customerDetails.state,
        isInterstate: totals.isInterstate,
        items: billItems.map(item => {
          // Calculate base unit quantity for inventory deduction
          const baseQty = item.isPack ? item.quantity * item.conversionFactor : item.quantity;
          const unitMrp = item.isPack ? item.packMrp : item.looseMrp;
          
          return {
            medicine: item.medicineId,
            medicineName: item.medicineName,
            brandName: item.brandName,
            inventoryBatchId: item.inventoryBatchId,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            quantity: item.quantity,
            packQuantity: item.isPack ? item.quantity : 0,
            looseQuantity: item.isPack ? 0 : item.quantity,
            unitQuantity: baseQty, // Base units for inventory
            rate: unitMrp,
            gstPercent: item.gstPercent,
            discountPercent: 0,
            discountAmount: 0
          };
        }),
        subtotal: totals.subtotal,
        totalGst: totals.totalGst,
        totalCgst: totals.totalCgst,
        totalSgst: totals.totalSgst,
        totalIgst: totals.totalIgst,
        discountPercent: discountPercent,
        discountAmount: totals.discountAmount,
        grandTotal: totals.grandTotal,
        paymentMode: paymentMode,
        amountPaid: parseFloat(amountPaid) || totals.grandTotal,
        balance: (parseFloat(amountPaid) || totals.grandTotal) - totals.grandTotal
      };

      await api.post('/bills', billData);
      
      // Reset form
      setBillItems([]);
      setCustomerDetails({ name: '', phone: '', state: '' });
      setDiscountPercent(0);
      setAmountPaid(0);
      setErrorMessage('');
      alert('Bill saved successfully!');
    } catch (error) {
      console.error('Error saving bill:', error);
      console.error('Bill save response:', error.response?.data);
      const errorMsg = error.response?.data?.message || 'Error saving bill';
      setErrorMessage(errorMsg);
      alert(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  // Handle QR code scan (placeholder)
  const handleQRScan = () => {
    alert('QR Code scanning feature - integrate with your QR scanner hardware');
  };

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Billing / POS</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleQRScan}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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
                  onChange={(e) => setCustomerDetails({...customerDetails, name: e.target.value})}
                  placeholder="Enter customer name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={customerDetails.phone}
                  onChange={(e) => setCustomerDetails({...customerDetails, phone: e.target.value})}
                  placeholder="Enter phone number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer State
                  {totals.isInterstate && <span className="text-xs text-purple-600 ml-2">(Interstate - IGST)</span>}
                </label>
                <input
                  type="text"
                  value={customerDetails.state}
                  onChange={(e) => setCustomerDetails({...customerDetails, state: e.target.value})}
                  placeholder="e.g., Maharashtra, Karnataka"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                              <p className="text-xs text-blue-600">
                                Pack: {medicine.conversionFactor} {medicine.baseUnit || 'units'}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            {loadingBatches[medicine._id] ? (
                              <span className="text-xs text-gray-400">Loading...</span>
                            ) : (
                              <p className="text-sm font-bold text-gray-900">₹{medicine.defaultSellingPrice || 0}</p>
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
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Expiry</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">MRP</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {billItems.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-3">
                          <p className="font-medium text-gray-900">{item.medicineName}</p>
                          <p className="text-xs text-gray-500">{item.brandName}</p>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-sm text-gray-600">{item.packSize}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {item.conversionFactor > 1 ? (
                            <button
                              onClick={() => togglePackUnit(item.medicineId)}
                              className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                                item.isPack 
                                  ? 'bg-blue-100 text-blue-700 border border-blue-300' 
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
                          <span className={`text-sm ${new Date(item.expiryDate) < new Date(Date.now() + 90*24*60*60*1000) ? 'text-orange-600' : 'text-gray-600'}`}>
                            {formatDate(item.expiryDate)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                updateQuantity(item.medicineId, item.quantity - 1);
                              }}
  onClick={() => {
    updateQuantity(item.medicineId, item.quantity - 1);
}}
                              className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                            >-</button>
                            <span className="w-16 text-center font-medium">{item.quantity}</span>
                            <button
                              onClick={() => {
                                updateQuantity(item.medicineId, item.quantity + 1);
                              }}
  onClick={() => {
    updateQuantity(item.medicineId, item.quantity + 1);
}}
                              className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                            >+</button>
                          </div>
                          <p className="text-xs text-center text-gray-400 mt-1">
                            Stock: {item.availableStock} {item.baseUnit}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="font-medium">₹{item.isPack ? item.packMrp.toFixed(2) : item.looseMrp.toFixed(2)}</span>
                          {item.conversionFactor > 1 && (
                            <p className="text-xs text-gray-400">
                              ({item.isPack ? '1' : item.conversionFactor} {item.baseUnit})
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="font-bold text-lg">₹{item.amount.toFixed(2)}</span>
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => removeItem(item.medicineId)}
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
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold mb-4">Payment</h2>
            
            {/* Payment Mode */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Mode</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'CASH', icon: Banknote, label: 'Cash' },
                  { value: 'UPI', icon: Smartphone, label: 'UPI' },
                  { value: 'CARD', icon: CreditCard, label: 'Card' },
                  { value: 'BANK', icon: Landmark, label: 'Bank' }
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setPaymentMode(value)}
                    className={`px-2 py-2 rounded-lg border flex flex-col items-center gap-1 ${
                      paymentMode === value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Paid */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid</label>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="Enter amount"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Bill Discount */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
              <input
                type="number"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Bill Summary */}
          <div className="bg-gray-900 text-white p-4 rounded-lg shadow-lg sticky top-4">
            <h2 className="text-lg font-semibold mb-4">Bill Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Subtotal (Base):</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              
              {totals.discountAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Discount:</span>
                  <span className="text-green-400">-{formatCurrency(totals.discountAmount)}</span>
                </div>
              )}
              
              {/* GST Breakdown */}
              <div className="border-t border-gray-700 pt-2 mt-2">
                {totals.isInterstate ? (
                  <div className="flex justify-between">
                    <span className="text-gray-400">IGST:</span>
                    <span>{formatCurrency(totals.totalIgst)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-400">CGST:</span>
                      <span>{formatCurrency(totals.totalCgst)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">SGST:</span>
                      <span>{formatCurrency(totals.totalSgst)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-medium">
                  <span className="text-gray-300">Total GST:</span>
                  <span>{formatCurrency(totals.totalGst)}</span>
                </div>
              </div>
              
              <div className="border-t border-gray-700 pt-2 mt-2">
                <div className="flex justify-between text-xl font-bold">
                  <span>Grand Total:</span>
                  <span className="text-green-400">{formatCurrency(totals.grandTotal)}</span>
                </div>
              </div>
              
              {/* Payment Info */}
              <div className="border-t border-gray-700 pt-2 mt-2 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Paid:</span>
                  <span>{formatCurrency(parseFloat(amountPaid) || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Balance:</span>
                  <span className={((parseFloat(amountPaid) || 0) - totals.grandTotal) >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {formatCurrency((parseFloat(amountPaid) || 0) - totals.grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 space-y-2">
              <button
                onClick={handleSaveBill}
                disabled={saving || billItems.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                <Save size={20} />
                {saving ? 'Saving...' : 'Save Bill'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

