export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^\d{10}$/;
export const GST_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
export const HSN_REGEX = /^\d{4,8}$/;
export const BARCODE_REGEX = /^\d{8,14}$/;
export const GTIN_REGEX = /^\d{8,14}$/;
export const OTP_REGEX = /^\d{6}$/;
export const BATCH_REGEX = /^[A-Z0-9][A-Z0-9/_-]{0,49}$/;

export const normalizeWhitespace = (value = "") =>
  value.replace(/\s+/g, " ").trim();

export const normalizeEmail = (value = "") =>
  normalizeWhitespace(value).toLowerCase();

export const normalizePhone = (value = "") => value.replace(/\D/g, "").slice(0, 10);

export const normalizeUppercase = (value = "") =>
  normalizeWhitespace(value).toUpperCase();

export const normalizeTextInput = (value = "") => value.replace(/\s+/g, " ");

export const normalizeNotes = (value = "") => normalizeWhitespace(value);

export const isValidEmail = (value = "") => EMAIL_REGEX.test(normalizeEmail(value));
export const isValidPhone = (value = "") => PHONE_REGEX.test(normalizePhone(value));
export const isValidGST = (value = "") => GST_REGEX.test(normalizeUppercase(value));
export const isValidHSN = (value = "") => HSN_REGEX.test(String(value).trim());
export const isValidBarcode = (value = "") => BARCODE_REGEX.test(String(value).trim());
export const isValidGTIN = (value = "") => GTIN_REGEX.test(String(value).trim());
export const isValidOtp = (value = "") => OTP_REGEX.test(String(value).trim());
export const isValidBatchNumber = (value = "") => BATCH_REGEX.test(normalizeUppercase(value));

const isFiniteNumber = (value) => Number.isFinite(Number(value));

export const isNonNegativeNumber = (value) =>
  value === "" || value === null || value === undefined || (isFiniteNumber(value) && Number(value) >= 0);

export const isPositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
};

export const isNonNegativeInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0;
};

export const isFutureDate = (value) => {
  if (!value) return false;
  const inputDate = new Date(value);
  if (Number.isNaN(inputDate.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  inputDate.setHours(0, 0, 0, 0);

  return inputDate > today;
};

export const isPastMonth = (value) => {
  if (!value) return false;
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return true;

  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const inputMonth = new Date(year, month - 1, 1);
  return inputMonth < currentMonth;
};

export const isMonthBeforeDate = (value, referenceDate) => {
  if (!value) return false;

  const [year, month] = String(value).split("-").map(Number);
  if (!year || !month) return true;

  const reference = new Date(referenceDate);
  if (Number.isNaN(reference.getTime())) return true;

  const inputMonth = new Date(year, month - 1, 1);
  const referenceMonth = new Date(reference.getFullYear(), reference.getMonth(), 1);

  return inputMonth < referenceMonth;
};

export const validateLoginForm = ({ email, password }) => {
  if (!isValidEmail(email)) {
    return "Enter a valid email address";
  }

  if (!normalizeWhitespace(password)) {
    return "Password is required";
  }

  return "";
};

export const validateOtp = (otp) => {
  if (!isValidOtp(otp)) {
    return "Enter a valid 6-digit OTP";
  }

  return "";
};

export const validateResetPasswordForm = ({ email, otp, password, confirmPassword }) => {
  if (!isValidEmail(email)) {
    return "Enter a valid email address";
  }

  if (!isValidOtp(otp)) {
    return "Enter a valid 6-digit OTP";
  }

  if (!normalizeWhitespace(password) || password.length < 6) {
    return "Password must be at least 6 characters";
  }

  if (password !== confirmPassword) {
    return "Passwords do not match";
  }

  return "";
};

export const validateUserForm = (formData, { editingUser = false } = {}) => {
  const name = normalizeWhitespace(formData.name);
  const email = normalizeEmail(formData.email);
  const phone = normalizePhone(formData.phone);

  if (name.length < 2) {
    return "Full name must be at least 2 characters";
  }

  if (!isValidEmail(email)) {
    return "Enter a valid email address";
  }

  if (phone && !isValidPhone(phone)) {
    return "Phone number must be 10 digits";
  }

  if (!["admin", "staff"].includes(formData.role)) {
    return "Select a valid role";
  }

  if (!editingUser && (!formData.password || formData.password.length < 6)) {
    return "Password must be at least 6 characters";
  }

  if (editingUser && formData.password && formData.password.length < 6) {
    return "New password must be at least 6 characters";
  }

  return "";
};

export const validateSupplierForm = (formData) => {
  const supplierName = normalizeWhitespace(formData.supplierName);
  const contactPerson = normalizeWhitespace(formData.contactPerson);
  const phone = normalizePhone(formData.phone);
  const email = normalizeEmail(formData.email);
  const gstNumber = normalizeUppercase(formData.gstNumber);

  if (supplierName.length < 2) {
    return "Supplier name must be at least 2 characters";
  }

  if (!isValidPhone(phone)) {
    return "Phone number must be 10 digits";
  }

  if (email && !isValidEmail(email)) {
    return "Enter a valid supplier email address";
  }

  if (contactPerson && contactPerson.length < 2) {
    return "Contact person name must be at least 2 characters";
  }

  if (gstNumber && !isValidGST(gstNumber)) {
    return "Enter a valid 15-character GST number";
  }

  return "";
};

export const validateMedicineForm = (formData, unitOptions = []) => {
  const medicineName = normalizeWhitespace(formData.medicineName);
  const barcode = normalizeWhitespace(formData.barcode);
  const gtin = normalizeWhitespace(formData.gtin);
  const conversionFactor = Number(formData.conversionFactor);
  const reorderLevel = Number(formData.reorderLevel);
  const defaultSellingPrice = Number(formData.defaultSellingPrice);
  const baseUnit = formData.baseUnit || "";
  const sellingUnit = formData.sellingUnit || "";

  if (medicineName.length < 2) {
    return "Medicine name must be at least 2 characters";
  }

  if (barcode && !isValidBarcode(barcode)) {
    return "Barcode must be 8 to 14 digits";
  }

  if (gtin && !isValidGTIN(gtin)) {
    return "GTIN must be 8 to 14 digits";
  }

  if ((baseUnit && !sellingUnit) || (!baseUnit && sellingUnit)) {
    return "Select both base unit and selling unit together";
  }

  if (baseUnit && !unitOptions.includes(baseUnit)) {
    return "Select a valid base unit";
  }

  if (sellingUnit && !unitOptions.includes(sellingUnit)) {
    return "Select a valid selling unit";
  }

  if (!Number.isInteger(conversionFactor) || conversionFactor < 1) {
    return "Conversion factor must be a whole number greater than 0";
  }

  if (!isNonNegativeNumber(formData.defaultSellingPrice)) {
    return "Default selling price cannot be negative";
  }

  if (formData.defaultSellingPrice !== "" && Number.isNaN(defaultSellingPrice)) {
    return "Enter a valid default selling price";
  }

  if (!Number.isInteger(reorderLevel) || reorderLevel < 0) {
    return "Reorder level must be a whole number 0 or higher";
  }

  if (!["ACTIVE", "INACTIVE"].includes(formData.status)) {
    return "Select a valid medicine status";
  }

  return "";
};

export const validateAssetForm = (formData) => {
  const assetName = normalizeWhitespace(formData.assetName);
  const cost = Number(formData.cost);

  if (assetName.length < 2) {
    return "Asset name must be at least 2 characters";
  }

  if (!formData.purchaseDate) {
    return "Purchase date is required";
  }

  if (isFutureDate(formData.purchaseDate)) {
    return "Purchase date cannot be in the future";
  }

  if (!isNonNegativeNumber(formData.cost) || Number.isNaN(cost)) {
    return "Asset cost must be 0 or higher";
  }

  if (!["FURNITURE", "ELECTRONICS", "VEHICLE", "MACHINERY", "OTHER"].includes(formData.assetType)) {
    return "Select a valid asset type";
  }

  if (!["NEW", "GOOD", "FAIR", "POOR"].includes(formData.condition)) {
    return "Select a valid asset condition";
  }

  if (!["IN_USE", "UNDER_REPAIR", "SCRAP", "DISPOSED"].includes(formData.status)) {
    return "Select a valid asset status";
  }

  return "";
};

export const validateHSNForm = (formData) => {
  if (!isValidHSN(formData.hsnCode)) {
    return "HSN code must be 4 to 8 digits";
  }

  const gstPercent = Number(formData.gstPercent);
  if (
    String(formData.gstPercent).trim() === "" ||
    !Number.isFinite(gstPercent) ||
    gstPercent < 0 ||
    gstPercent > 28
  ) {
    return "Enter a valid GST percentage between 0 and 28";
  }

  if (!["ACTIVE", "INACTIVE"].includes(formData.status)) {
    return "Select a valid HSN status";
  }

  return "";
};

export const validateProfileForm = (profile) => {
  if (normalizeWhitespace(profile.name).length < 2) {
    return "Name must be at least 2 characters";
  }

  if (!isValidEmail(profile.email)) {
    return "Enter a valid email address";
  }

  if (profile.phone && !isValidPhone(profile.phone)) {
    return "Phone number must be 10 digits";
  }

  return "";
};

export const validatePasswordChangeForm = (passwordData) => {
  if (!normalizeWhitespace(passwordData.currentPassword)) {
    return "Current password is required";
  }

  if (!normalizeWhitespace(passwordData.newPassword) || passwordData.newPassword.length < 6) {
    return "New password must be at least 6 characters";
  }

  if (passwordData.newPassword === passwordData.currentPassword) {
    return "New password must be different from current password";
  }

  if (passwordData.newPassword !== passwordData.confirmPassword) {
    return "Passwords do not match";
  }

  return "";
};

export const validateDisposeForm = (disposeForm, selectedItem) => {
  const quantity = Number(disposeForm.quantity);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return "Enter a valid disposal quantity";
  }

  if (selectedItem && quantity > Number(selectedItem.quantityAvailable || 0)) {
    return "Disposal quantity cannot exceed available stock";
  }

  if (!["DAMAGED", "EXPIRED", "OTHER"].includes(disposeForm.reason)) {
    return "Select a valid disposal reason";
  }

  if (disposeForm.reason === "OTHER" && normalizeWhitespace(disposeForm.notes).length < 3) {
    return "Please add a note when disposal reason is Other";
  }

  return "";
};

export const validatePurchaseForm = ({
  selectedSupplier,
  purchaseDate,
  supplierInvoiceNumber,
  miscellaneousAmount,
  purchaseItems
}) => {
  if (!selectedSupplier) {
    return { error: "Please select a supplier" };
  }

  if (!purchaseDate) {
    return { error: "Please select a purchase date" };
  }

  if (isFutureDate(purchaseDate)) {
    return { error: "Purchase date cannot be in the future" };
  }

  if (normalizeWhitespace(supplierInvoiceNumber).length < 2) {
    return { error: "Please enter a valid supplier invoice number" };
  }

  if (!isNonNegativeNumber(miscellaneousAmount || 0)) {
    return { error: "Miscellaneous amount must be 0 or higher" };
  }

  if (!purchaseItems.length) {
    return { error: "Please add at least one medicine" };
  }

  for (let index = 0; index < purchaseItems.length; index += 1) {
    const item = purchaseItems[index];

    if (!item.medicineId) {
      return { error: `Select a medicine for item ${index + 1}`, rowIndex: index, field: "product" };
    }

    if (item.batchNumber && !isValidBatchNumber(item.batchNumber || "")) {
      return { error: `Enter a valid batch number for item ${index + 1}`, rowIndex: index, field: "batch" };
    }

    if (!item.expiryDate || isMonthBeforeDate(item.expiryDate, purchaseDate)) {
      return { error: `Expiry month cannot be earlier than purchase date for item ${index + 1}`, rowIndex: index, field: "expiry" };
    }

    if (!isPositiveInteger(item.quantity)) {
      return { error: `Quantity must be greater than 0 for item ${index + 1}`, rowIndex: index, field: "qty" };
    }

    if (!isNonNegativeInteger(item.freeQuantity || 0)) {
      return { error: `Free quantity cannot be negative for item ${index + 1}`, rowIndex: index, field: "free" };
    }

    if (!isNonNegativeNumber(item.mrp)) {
      return { error: `MRP cannot be negative for item ${index + 1}`, rowIndex: index, field: "mrp" };
    }

    if (!isNonNegativeNumber(item.purchasePrice)) {
      return { error: `Purchase rate cannot be negative for item ${index + 1}`, rowIndex: index, field: "rate" };
    }

    if (!isValidHSN(item.hsnCode || "")) {
      return { error: `Select a valid HSN code for item ${index + 1}`, rowIndex: index, field: "hsn" };
    }

    const discountType = item.discountType === "AMOUNT" ? "AMOUNT" : "PERCENT";
    const itemSubtotal = (Number(item.quantity) || 0) * (Number(item.purchasePrice) || 0);

    if (discountType === "PERCENT") {
      if (!isNonNegativeNumber(item.discountPercent) || Number(item.discountPercent) > 100) {
        return { error: `Discount must be between 0 and 100 for item ${index + 1}`, rowIndex: index, field: "disc" };
      }
    }

    if (discountType === "AMOUNT") {
      if (!isNonNegativeNumber(item.discountAmount)) {
        return { error: `Discount amount cannot be negative for item ${index + 1}`, rowIndex: index, field: "disc" };
      }

      if (Number(item.discountAmount || 0) > itemSubtotal) {
        return { error: `Discount amount cannot exceed subtotal for item ${index + 1}`, rowIndex: index, field: "disc" };
      }
    }
  }

  return { error: "" };
};

export const validateBillingForm = ({
  customerDetails,
  discountType,
  discountPercent,
  discountAmount,
  subtotal,
  amountPaid,
  billItems
}) => {
  if (customerDetails.name && normalizeWhitespace(customerDetails.name).length < 2) {
    return "Customer name must be at least 2 characters";
  }

  if (customerDetails.phone && !isValidPhone(customerDetails.phone)) {
    return "Customer phone number must be 10 digits";
  }

  if (customerDetails.state && normalizeWhitespace(customerDetails.state).length < 2) {
    return "Customer state must be at least 2 characters";
  }

  if (discountType === "PERCENT") {
    if (!isNonNegativeNumber(discountPercent) || Number(discountPercent) > 100) {
      return "Discount must be between 0 and 100";
    }
  }

  if (discountType === "AMOUNT") {
    if (!isNonNegativeNumber(discountAmount)) {
      return "Discount amount cannot be negative";
    }

    if (Number(discountAmount || 0) > Number(subtotal || 0)) {
      return "Discount amount cannot exceed subtotal";
    }
  }

  if (amountPaid !== "" && (!isNonNegativeNumber(amountPaid) || Number(amountPaid) < 0)) {
    return "Amount paid cannot be negative";
  }

  if (!billItems.length) {
    return "Please add at least one item to the bill";
  }

  for (const item of billItems) {
    if (!item.medicineId || (!item.inventoryBatchId && !item.batchNumber)) {
      return `Selected batch is missing for ${item.medicineName || "an item"}`;
    }

    if (!isPositiveInteger(item.quantity)) {
      return `Quantity must be greater than 0 for ${item.medicineName}`;
    }

    const availableStock = Number(item.availableStock || 0);
    const baseQty = item.isPack ? Number(item.quantity) * Number(item.conversionFactor || 1) : Number(item.quantity);

    if (baseQty > availableStock) {
      return `Insufficient stock for ${item.medicineName}`;
    }
  }

  return "";
};
