# Billing Stock Issue Fix Plan

## Problem
Inventory shows available stock but Billing shows 0 quantity when selecting medicine.

## Root Causes Identified:
1. Status filtering issue in backend inventory queries for billing
2. Pre-save middleware may incorrectly mark batches as EXPIRED/EXHAUSTED  
3. Potential Medicine ID mismatch between tables

## Tasks:
- [ ] 1. Fix inventoryController.js - Add proper status filtering in getInventoryByMedicine function
- [ ] 2. Update Inventory model pre-save middleware to not auto-expire items that still have stock  
- [ ] 3. Add debug logging in billController.js for better troubleshooting
- [ ] 4. Test the fix end-to-end

## Files to Edit:
1. backend/controllers/inventoryController.js - getInventoryByMedicine function (line ~180)
2. backend/models/Inventory.js - pre-save middleware (line ~90)
