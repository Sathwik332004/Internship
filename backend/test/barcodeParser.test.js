const { parseBarcode, parsePurchaseBarcode } = require('../utils/barcode');

describe('parseBarcode', () => {
  test('accepts plain GTIN-13 and marks Indian prefix', () => {
    expect(parseBarcode('8904103324815')).toEqual({
      gtin: '8904103324815',
      isValid: true,
      country: 'India',
      isIndian: true,
      meta: {
        inputTypeDetected: 'GTIN',
        conversionApplied: null,
        countryDetected: 'India'
      }
    });
  });

  test('converts GTIN-14 with leading zero to GTIN-13', () => {
    expect(parseBarcode('08904103324815')).toMatchObject({
      gtin: '8904103324815',
      isValid: true,
      country: 'India',
      isIndian: true,
      meta: {
        inputTypeDetected: 'GTIN',
        conversionApplied: '14->13',
        countryDetected: 'India'
      }
    });
  });

  test('extracts GTIN from bracketed GS1 input', () => {
    expect(parseBarcode('(01)08904103324815(17)280101')).toMatchObject({
      gtin: '8904103324815',
      isValid: true,
      meta: {
        inputTypeDetected: 'GS1',
        conversionApplied: '14->13',
        countryDetected: 'India'
      }
    });
  });

  test('extracts GTIN from raw GS1 input', () => {
    expect(parseBarcode('01089041033248151728010110ABC123')).toMatchObject({
      gtin: '8904103324815',
      isValid: true,
      meta: {
        inputTypeDetected: 'GS1',
        conversionApplied: '14->13',
        countryDetected: 'India'
      }
    });
  });

  test('extracts GTIN from GS1 Digital Link URL', () => {
    expect(parseBarcode('https://example.org/01/08904103324815/10/BATCH1')).toMatchObject({
      gtin: '8904103324815',
      isValid: true,
      meta: {
        inputTypeDetected: 'URL',
        conversionApplied: '14->13',
        countryDetected: 'India'
      }
    });
  });

  test('returns warning for non-Indian GTIN values', () => {
    expect(parseBarcode('06200000094445')).toMatchObject({
      gtin: '6200000094445',
      isValid: true,
      country: 'Unknown / Non-India',
      isIndian: false,
      warning: 'Non-Indian GTIN detected'
    });
  });

  test('rejects invalid and unsupported inputs', () => {
    expect(parseBarcode('BATCHONLY123')).toMatchObject({
      gtin: null,
      isValid: false,
      country: '',
      isIndian: false,
      meta: {
        inputTypeDetected: 'INVALID',
        conversionApplied: null,
        countryDetected: ''
      }
    });
  });
});

describe('parsePurchaseBarcode', () => {
  test('extracts gtin, batch, and expiry from GS1 Digital Link', () => {
    expect(parsePurchaseBarcode('https://domain.com/01/08901117243870/10/ABC123/21/XYZ?17=270430')).toEqual({
      gtin: '8901117243870',
      batch: 'abc123',
      expiry: '2027-04-30',
      isValid: true,
      detectedFormat: 'DIGITAL_LINK'
    });
  });

  test('extracts gtin, batch, and expiry from GS1 raw input', () => {
    expect(parsePurchaseBarcode('01089011172438701727043010ABC12321XYZ')).toEqual({
      gtin: '8901117243870',
      batch: 'abc123',
      expiry: '2027-04-30',
      isValid: true,
      detectedFormat: 'GS1_RAW'
    });
  });

  test('keeps batch and expiry null when raw GS1 payload only has other AIs', () => {
    expect(parsePurchaseBarcode('01089022816102562171088600274998')).toEqual({
      gtin: '8902281610256',
      batch: null,
      expiry: null,
      isValid: true,
      detectedFormat: 'GS1_RAW'
    });
  });

  test('extracts gtin, batch, and expiry from GS1 bracket input', () => {
    expect(parsePurchaseBarcode('(01)08901117243870(17)270430(10)ABC123')).toEqual({
      gtin: '8901117243870',
      batch: 'abc123',
      expiry: '2027-04-30',
      isValid: true,
      detectedFormat: 'GS1_BRACKET'
    });
  });

  test('returns gtin only for plain barcode input', () => {
    expect(parsePurchaseBarcode('8904103324815')).toEqual({
      gtin: '8904103324815',
      batch: null,
      expiry: null,
      isValid: true,
      detectedFormat: 'GTIN_ONLY'
    });
  });

  test('returns invalid payload for unsupported purchase scan', () => {
    expect(parsePurchaseBarcode('SHORT-LINK')).toEqual({
      gtin: null,
      batch: null,
      expiry: null,
      isValid: false,
      detectedFormat: 'INVALID'
    });
  });
});
