# Purchase Module Upgrade Plan

## Current System Analysis

### Backend Models
1. **Medicine Model** - Already has HSN/GST fields (hsnCode, hsnCodeString, gstPercent) and unit conversion (baseUnit, sellingUnit, conversionFactor)
2. **Purchase Model** - Already has hsnCode/gstPercent per item, creates inventory
3. **Inventory Model** - Already has batch-level tracking with hsnCode/gstPercent

### Frontend
- Purchase page has basic medicine autocomplete, HSN/GST per item
- Missing: purchaseNumber, keyboard navigation, unit conversion, last price suggestion, batch warning

---

## Implementation Plan

### Phase 1: Backend Changes

#### 1.1 Update Purchase Model (backend/models/Purchase.js)
- Add `purchaseNumber` field (String, auto-generated P000001 format)
- Add `purchaseTime` field (String)
- Add `discountPercent` to purchaseItemSchema (item-level discount)
- Add `unit` field to purchaseItemSchema
- Add `mrp` field to purchaseItemSchema
- Add `discountAmount` to purchaseItemSchema (calculated)
- Add `taxableAmount` to purchaseItemSchema (calculated)
- Update `invoiceNumber` generation logic (keep existing or add purchaseNumber)

#### 1.2 Update Purchase Controller (backend/controllers/purchaseController.js)
- Update `generatePurchaseNumber()` for P000001 format
- Add `getLastPurchasePrice(medicineId)` function
- Update `addPurchase` to:
  - Generate purchaseNumber
  - Calculate item-level discount/taxableAmount
  - Apply unit conversion for inventory
  - Include hsnCode/gstPercent in inventory creation

#### 1.3 Add New Routes
- GET `/api/purchases/last-price/:medicineId` - Get last purchase price

---

### Phase 2: Frontend Changes

#### 2.1 Update Purchases.jsx - Header Section
- Add `purchaseNumber` display (auto-generated)
- Add `purchaseTime` field
- Show `invoiceNumber` (existing)

#### 2.2 Update Purchase Item Table
- Add columns: Unit, MRP, Discount %, Discount Amt, Taxable Amt
- Add discountPercent input per row
- Add unit field (from medicine)
- Add mrp field
- Show calculated amounts in real-time

#### 2.3 Implement Fast Entry (Keyboard Navigation)
- Enter → move to next column
- Enter at last column → add new row
- Tab → move forward
- Shift+Tab → move backward

#### 2.4 Medicine Autocomplete Enhancement
- Show unit info (baseUnit, sellingUnit, conversionFactor)
- Fetch and display last purchase price
- Auto-fill unit fields when medicine selected

#### 2.5 Real-Time Calculations
```
subtotal = quantity × purchasePrice
discountAmount = subtotal × discountPercent / 100
taxableAmount = subtotal - discountAmount
gstAmount = taxableAmount × gstPercent / 100
totalAmount = taxableAmount + gstAmount
```

#### 2.6 Batch Validation
- Check if batch exists when batchNumber is entered
- Show warning if batch exists for same medicine

#### 2.7 Purchase Summary Section
- Subtotal
- Total Discount
- Total GST
- Grand Total

---

### Phase 3: Testing & Integration

#### 3.1 Backend Tests
- Test purchase number generation
- Test last purchase price API
- Test inventory creation with unit conversion
- Test batch validation

#### 3.2 Frontend Tests
- Test keyboard navigation
- Test real-time calculations
- Test batch warning display

---

## File Changes Summary

### Backend Files to Modify:
1. `backend/models/Purchase.js` - Add purchaseNumber, purchaseTime, discountPercent per item, unit, mrp
2. `backend/controllers/purchaseController.js` - Add purchaseNumber generation, last price API, update calculations
3. `backend/routes/purchases.js` - Add new route for last price

### Frontend Files to Modify:
1. `frontend/src/pages/Purchases.jsx` - Complete overhaul for ERP-style entry

---

## Notes

- Medicine module HSN/GST fields will remain for reference but will be overridden by purchase-level values
- Inventory model already supports hsnCode/gstPercent - no changes needed
- Unit conversion: quantity * conversionFactor = base units for inventory

