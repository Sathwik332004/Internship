const COUNTRY_PREFIX_MAP = {
  '890': 'India'
};

const INVALID_RESULT = {
  gtin: null,
  isValid: false,
  country: '',
  isIndian: false
};

const INVALID_PURCHASE_RESULT = {
  gtin: null,
  batch: null,
  expiry: null,
  isValid: false
};

const detectCountry = (gtin) => {
  const prefix = String(gtin || '').slice(0, 3);
  const country = COUNTRY_PREFIX_MAP[prefix] || 'Unknown / Non-India';
  const isIndian = prefix === '890';

  return {
    country,
    isIndian
  };
};

const buildValidBarcodeResult = (gtin13) => {
  const { country, isIndian } = detectCountry(gtin13);
  const result = {
    gtin: gtin13,
    isValid: true,
    country,
    isIndian
  };

  if (!isIndian) {
    result.warning = 'Non-Indian GTIN detected';
  }

  return result;
};

const normalizeInput = (input = '') =>
  String(input)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const extractFromDigitalLink = (input) => {
  const gtinMatch = input.match(/\/01\/(\d{14})(?=\/|[?#]|$)/);
  const batchMatch = input.match(/\/10\/([^/?#]+)/);
  const expiryMatch = input.match(/[?&]17=(\d{6})(?=&|$)/);

  return {
    gtin: gtinMatch ? gtinMatch[1] : '',
    batch: batchMatch ? decodeURIComponent(batchMatch[1]) : null,
    expiryRaw: expiryMatch ? expiryMatch[1] : ''
  };
};

const extractFromBracketedGs1 = (input) => {
  const gtinMatch = input.match(/\(01\)\s*(\d{14})/);
  const expiryMatch = input.match(/\(17\)\s*(\d{6})/);
  const batchMatch = input.match(/\(10\)\s*([A-Za-z0-9/_-]+)/);

  return {
    gtin: gtinMatch ? gtinMatch[1] : '',
    batch: batchMatch ? batchMatch[1] : null,
    expiryRaw: expiryMatch ? expiryMatch[1] : ''
  };
};

const extractFromRawGs1 = (input) => {
  const gtinMatch = input.match(/^01(\d{14})/);
  if (!gtinMatch || input.length <= 16) {
    return { gtin: '', batch: null, expiryRaw: '' };
  }

  const payload = input.slice(16);
  let cursor = 0;
  let batch = null;
  let expiryRaw = '';

  while (cursor + 2 <= payload.length) {
    const ai = payload.slice(cursor, cursor + 2);

    if (ai === '17' && cursor + 8 <= payload.length) {
      expiryRaw = payload.slice(cursor + 2, cursor + 8);
      cursor += 8;
      continue;
    }

    if (ai === '10') {
      const valueStart = cursor + 2;
      let valueEnd = payload.length;

      for (let index = valueStart; index < payload.length - 1; index += 1) {
        const maybeNextAi = payload.slice(index, index + 2);
        if (maybeNextAi === '17' || maybeNextAi === '21') {
          valueEnd = index;
          break;
        }
      }

      batch = payload.slice(valueStart, valueEnd) || null;
      cursor = valueEnd;
      continue;
    }

    if (ai === '21') {
      break;
    }

    break;
  }

  return {
    gtin: gtinMatch[1],
    batch,
    expiryRaw
  };
};

const extractIntermediateGtin = (cleanedInput) => {
  if (!cleanedInput) {
    return { value: '', inputTypeDetected: 'INVALID' };
  }

  const digitalLinkData = extractFromDigitalLink(cleanedInput);
  if (digitalLinkData.gtin) {
    return { value: digitalLinkData.gtin, inputTypeDetected: 'URL' };
  }

  const bracketedData = extractFromBracketedGs1(cleanedInput);
  if (bracketedData.gtin) {
    return { value: bracketedData.gtin, inputTypeDetected: 'GS1' };
  }

  const rawGs1Data = extractFromRawGs1(cleanedInput);
  if (rawGs1Data.gtin) {
    return { value: rawGs1Data.gtin, inputTypeDetected: 'GS1' };
  }

  if (/^\d+$/.test(cleanedInput) && (cleanedInput.length === 13 || cleanedInput.length === 14)) {
    return { value: cleanedInput, inputTypeDetected: 'GTIN' };
  }

  return { value: '', inputTypeDetected: 'INVALID' };
};

const standardizeToGtin13 = (gtinValue) => {
  if (!/^\d{13,14}$/.test(gtinValue)) {
    return { gtin13: '', conversionApplied: null };
  }

  if (gtinValue.length === 13) {
    return { gtin13: gtinValue, conversionApplied: null };
  }

  if (gtinValue.startsWith('0')) {
    return { gtin13: gtinValue.slice(1), conversionApplied: '14->13' };
  }

  return { gtin13: gtinValue.slice(-13), conversionApplied: '14->13' };
};

const formatExpiry = (expiryRaw) => {
  if (!/^\d{6}$/.test(expiryRaw)) {
    return null;
  }

  const year = `20${expiryRaw.slice(0, 2)}`;
  const month = expiryRaw.slice(2, 4);
  const day = expiryRaw.slice(4, 6);

  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) {
    return null;
  }

  return `${year}-${month}-${day}`;
};

export function parseBarcode(input = '') {
  const cleanedInput = normalizeInput(input);
  const { value: intermediateGtin, inputTypeDetected } = extractIntermediateGtin(cleanedInput);
  const { gtin13, conversionApplied } = standardizeToGtin13(intermediateGtin);

  if (!/^\d{13}$/.test(gtin13)) {
    return {
      ...INVALID_RESULT,
      meta: {
        inputTypeDetected,
        conversionApplied,
        countryDetected: ''
      }
    };
  }

  const result = buildValidBarcodeResult(gtin13);

  return {
    ...result,
    meta: {
      inputTypeDetected,
      conversionApplied,
      countryDetected: result.country
    }
  };
}

export function parsePurchaseBarcode(input = '') {
  const cleanedInput = normalizeInput(input);

  let detectedFormat = 'INVALID';
  let extracted = { gtin: '', batch: null, expiryRaw: '' };

  const digitalLinkData = extractFromDigitalLink(cleanedInput);
  if (digitalLinkData.gtin) {
    detectedFormat = 'DIGITAL_LINK';
    extracted = digitalLinkData;
  } else {
    const bracketedData = extractFromBracketedGs1(cleanedInput);
    if (bracketedData.gtin) {
      detectedFormat = 'GS1_BRACKET';
      extracted = bracketedData;
    } else {
      const rawGs1Data = extractFromRawGs1(cleanedInput);
      if (rawGs1Data.gtin) {
        detectedFormat = 'GS1_RAW';
        extracted = rawGs1Data;
      } else if (/^\d+$/.test(cleanedInput) && (cleanedInput.length === 13 || cleanedInput.length === 14)) {
        detectedFormat = 'GTIN_ONLY';
        extracted = { gtin: cleanedInput, batch: null, expiryRaw: '' };
      }
    }
  }

  const parsedBarcode = parseBarcode(cleanedInput);
  if (!parsedBarcode.isValid) {
    return {
      ...INVALID_PURCHASE_RESULT,
      detectedFormat
    };
  }

  const result = {
    gtin: parsedBarcode.gtin,
    batch: extracted.batch || null,
    expiry: formatExpiry(extracted.expiryRaw),
    isValid: true,
    detectedFormat
  };

  if (parsedBarcode.warning) {
    result.warning = parsedBarcode.warning;
  }

  return result;
}
