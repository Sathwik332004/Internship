# Purchase Entry Grid UI Upgrade Plan

## Information Gathered

### Current Implementation Analysis
- **File**: `frontend/src/pages/Purchases.jsx`
- Current column widths use fixed Tailwind classes (w-48, w-24, w-28, etc.)
- Product column uses a button that triggers search, not an input field
- Autocomplete shows basic medicine info (name, brand, unit)
- Modal does not auto-focus on Product search when opened
- Keyboard navigation exists but can be improved

### Current GRID_COLUMNS Configuration
```javascript
const GRID_COLUMNS = [
  { key: 'product', label: 'Product', width: 'w-48', editable: true, isSearch: true },
  { key: 'pack', label: 'Pack', width: 'w-24', editable: true },
  { key: 'batch', label: 'Batch', width: 'w-28', editable: true },
  { key: 'expiry', label: 'Expiry', width: 'w-32', editable: true },
  { key: 'qty', label: 'Qty', width: 'w-20', editable: true },
  { key: 'free', label: 'Free', width: 'w-16', editable: true },
  { key: 'rate', label: 'Rate', width: 'w-24', editable: true },
  { key: 'disc', label: 'Disc%', width: 'w-16', editable: true },
  { key: 'amount', label: 'Amount', width: 'w-28', editable: false, isAmount: true },
  { key: 'actions', label: '', width: 'w-12', editable: false }
];
```

## Plan

### 1. Update Column Width Configuration
- Replace fixed width classes with percentage-based widths using Tailwind CSS
- New distribution:
  - Product: 35% (`w-[35%]`)
  - Pack: 8% (`w-[8%]`)
  - Batch: 10% (`w-[10%]`)
  - Expiry: 10% (`w-[10%]`)
  - Qty: 7% (`w-[7%]`)
  - Free: 7% (`w-[7%]`)
  - Rate: 8% (`w-[8%]`)
  - Disc%: 5% (`w-[5%]`)
  - Amount: 8% (`w-[8%]`)
  - Delete: 2% (`w-[2%]`)

### 2. Convert Product Column to Search Input
- Replace button with actual input field
- Add placeholder: "Search medicine name, brand or barcode..."
- Make input full-width within the column
- Style for better visibility

### 3. Add Auto-Focus on Modal Open
- Use useEffect to focus Product search input when modal opens
- Add ref for product search input
- Trigger focus after modal animation

### 4. Improve Autocomplete Dropdown Format
- Change display format to: "Medicine Name – Strength – Pack"
- Example: "Paracetamol 500mg – Tablet – Strip10"
- Use medicine strength and pack size fields if available

### 5. Improve Table Layout
- Add sticky header with proper styling
- Ensure row highlighting works correctly
- Keep green highlight for Amount column
- Compact numeric inputs for non-product columns

### 6. Ensure Keyboard Navigation
- Maintain existing workflow: Product → Batch → Expiry → Qty → Free → Rate → Disc → Amount → Enter → New Row
- Test Enter key in Amount field creates new row

### 7. Use Tailwind CSS Table Layout
- Use `table-layout: fixed` for consistent column widths
- Apply percentage widths to each column

## Files to Modify
1. `frontend/src/pages/Purchases.jsx` - Complete UI overhaul

## Changes Summary

### Purchases.jsx Changes:
1. Update `GRID_COLUMNS` with percentage-based widths
2. Add `productSearchRef` for auto-focus
3. Modify `PurchaseRow` component to have actual input in Product column
4. Update autocomplete dropdown format
5. Add auto-focus effect when modal opens
6. Maintain all existing backend logic unchanged

## Follow-up Steps
1. Test the modal opens and focuses correctly
2. Verify column widths match requirements
3. Test autocomplete shows new format
4. Verify keyboard navigation works
5. Ensure all calculations still work correctly

