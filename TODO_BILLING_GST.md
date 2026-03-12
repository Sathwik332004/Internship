# Billing System GST Update - TODO List

## Phase 1: Frontend Changes (Billing.jsx)
- [x] 1.1 Update medicine search to fetch inventory batch data (mrp, gstPercent, batchNumber, expiryDate, availableStock)
- [x] 1.2 Implement FEFO batch selection (earliest expiry first)
- [x] 1.3 Update billing table columns: Item | Pack | Batch | Expiry | Qty | MRP | Amount (NO GST column)
- [x] 1.4 Update amount calculation: Amount = MRP * Quantity (MRP already includes GST)
- [x] 1.5 Add stock validation before adding item (check quantityAvailable >= quantity)
- [x] 1.6 Update bill summary to show: Subtotal, CGST, SGST, IGST, Total GST, Grand Total
- [x] 1.7 Add "Insufficient stock" error message
- [x] 1.8 Update UI layout for modern pharmacy POS

## Phase 2: Backend Changes (billController.js)
- [x] 2.1 Add calculateTax function (extract GST from MRP)
- [x] 2.2 Update GST calculation: BasePrice = MRP / (1 + GST/100), GSTValue = MRP - BasePrice
- [x] 2.3 Update stock deduction logic
- [x] 2.4 Add validation: medicine exists, batch exists, batch not expired, stock available, quantity > 0

## Phase 3: Testing
- [ ] 3.1 Test medicine selection and batch fetching
- [ ] 3.2 Test stock validation
- [ ] 3.3 Test bill save and stock update
- [ ] 3.4 Verify GST breakdown in bill summary

