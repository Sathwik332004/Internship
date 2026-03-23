# Liquid Medicine Billing Fix - TODO

## Approved Plan Implementation Steps

### 1. [x] Create TODO.md (DONE)
### 2. [x] Edit frontend/src/pages/Billing.jsx
   - Update `addToBill()` defaultIsPack logic  
   - Add guard in `togglePackUnit()` for liquids  
   - Update table render condition for Unit toggle button
   - Fix `updateQuantity()` to allow 0 quantity (no auto-remove)
   - Add manual qty input field in bill table
   - Show product MRP (x1) in search results
### 3. [ ] Test liquid medicine (baseUnit='ml')
   - Verify no pack/loose toggle shown
   - Verify direct quantity input works (ml/bottle)
### 4. [ ] Test non-liquid medicine (e.g., tablets/strips)
   - Verify pack/loose toggle still works
### 5. [ ] Verify stock/inventory logic unchanged
### 6. [ ] attempt_completion

**Status:** Frontend changes completed successfully
</xai:function_call >  
<xai:function_call name="edit_file">
<parameter name="path">frontend/src/pages/Billing.jsx
