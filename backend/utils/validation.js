const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;
const GST_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const HSN_REGEX = /^\d{4,8}$/;
const BARCODE_REGEX = /^\d{8,14}$/;
const GTIN_REGEX = /^\d{8,14}$/;
const OTP_REGEX = /^\d{6}$/;
const BATCH_REGEX = /^[A-Z0-9][A-Z0-9/_-]{0,49}$/;

const normalizeWhitespace = (value = '') => String(value).replace(/\s+/g, ' ').trim();
const normalizeEmail = (value = '') => normalizeWhitespace(value).toLowerCase();
const normalizePhone = (value = '') => String(value).replace(/\D/g, '').slice(0, 10);
const normalizeUppercase = (value = '') => normalizeWhitespace(value).toUpperCase();
const normalizeOptionalText = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = normalizeWhitespace(value);
  return normalized || null;
};

const isValidEmail = (value = '') => EMAIL_REGEX.test(normalizeEmail(value));
const isValidPhone = (value = '') => PHONE_REGEX.test(normalizePhone(value));
const isValidGST = (value = '') => GST_REGEX.test(normalizeUppercase(value));
const isValidHSN = (value = '') => HSN_REGEX.test(String(value).trim());
const isValidBarcode = (value = '') => BARCODE_REGEX.test(String(value).trim());
const isValidGTIN = (value = '') => GTIN_REGEX.test(String(value).trim());
const isValidOtp = (value = '') => OTP_REGEX.test(String(value).trim());
const isValidBatchNumber = (value = '') => BATCH_REGEX.test(normalizeUppercase(value));

const toNumber = (value) => Number(value);
const isNonNegativeNumber = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;
const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
const isNonNegativeInteger = (value) => Number.isInteger(Number(value)) && Number(value) >= 0;

const isFutureDate = (value) => {
  if (!value) return false;

  const inputDate = new Date(value);
  if (Number.isNaN(inputDate.getTime())) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  inputDate.setHours(0, 0, 0, 0);

  return inputDate > today;
};

const isPastMonth = (value) => {
  if (!value) return true;

  const [year, month] = String(value).split('-').map(Number);
  if (!year || !month) return true;

  const current = new Date();
  const currentMonth = new Date(current.getFullYear(), current.getMonth(), 1);
  const inputMonth = new Date(year, month - 1, 1);

  return inputMonth < currentMonth;
};

module.exports = {
  EMAIL_REGEX,
  PHONE_REGEX,
  GST_REGEX,
  HSN_REGEX,
  BARCODE_REGEX,
  GTIN_REGEX,
  OTP_REGEX,
  BATCH_REGEX,
  normalizeWhitespace,
  normalizeEmail,
  normalizePhone,
  normalizeUppercase,
  normalizeOptionalText,
  isValidEmail,
  isValidPhone,
  isValidGST,
  isValidHSN,
  isValidBarcode,
  isValidGTIN,
  isValidOtp,
  isValidBatchNumber,
  toNumber,
  isNonNegativeNumber,
  isPositiveInteger,
  isNonNegativeInteger,
  isFutureDate,
  isPastMonth
};
