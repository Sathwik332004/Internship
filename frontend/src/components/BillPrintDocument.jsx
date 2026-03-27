const defaultShopInfo = {
  name: 'Bhagya Medicals',
  address: '',
  addressLine1: '',
  addressLine2: '',
  phone: '',
  email: '',
  gstin: '',
  dlNo: '',
  state: 'Maharashtra'
};

const formatAmount = (amount) => (Number(amount) || 0).toFixed(2);

const formatDate = (value) => {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleDateString('en-GB');
};

const formatExpiry = (value) => {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleDateString('en-IN', {
    month: '2-digit',
    year: '2-digit'
  });
};

const getQuantityLabel = (item) => {
  if (item.packQuantity > 0) {
    return `${item.packQuantity} pack`;
  }

  if (item.looseQuantity > 0) {
    return `${item.looseQuantity} tablet`;
  }

  if (item.quantityLabel) {
    const normalized = String(item.quantityLabel).trim().toLowerCase();
    if (normalized.includes('pack')) {
      return item.quantityLabel;
    }
    return normalized.replace(/\b(tab|tabs|tablet|tablets|loose|unit|units)\b/g, 'tablet');
  }

  return `${item.quantity || item.unitQuantity || 0} tablet`;
};

export default function BillPrintDocument({ bill, shopInfo, isDraft = false }) {
  if (!bill) {
    return null;
  }

  const info = { ...defaultShopInfo, ...shopInfo };
  const customerName = bill.customerName?.trim() || 'Walk-in Customer';
  const customerAddress = bill.customerAddress?.trim() || '';
  const doctorName = bill.doctorName?.trim() || '';
  const doctorRegNo = bill.doctorRegNo?.trim() || '';
  const shopAddressLines = [info.addressLine1, info.addressLine2, info.address]
    .filter(Boolean)
    .flatMap((line) => String(line).split('\n').map((part) => part.trim()).filter(Boolean));

  const lineGrossTotal = (bill.items || []).reduce((sum, item) => {
    const lineTotal = Number(item.total ?? item.amount);
    return sum + (Number.isFinite(lineTotal) ? lineTotal : 0);
  }, 0);

  const displayGrossTotal = lineGrossTotal > 0 ? lineGrossTotal : Number(bill.grandTotal) || 0;
  const displayDiscount = Number(bill.discountAmount) || 0;
  const discountPercentValue = Number(bill.discountPercent) || 0;
  const discountTypeValue = bill.discountType || (discountPercentValue > 0 ? 'PERCENT' : 'AMOUNT');
  const displayDiscountType = discountTypeValue === 'PERCENT'
    ? `PERCENT (${discountPercentValue.toFixed(2)}%)`
    : 'AMOUNT';
  const displayTotalGst = Number(bill.totalGst) || 0;
  const displayCgst = Number(bill.totalCgst) || (displayTotalGst > 0 ? displayTotalGst / 2 : 0);
  const displaySgst = Number(bill.totalSgst) || (displayTotalGst > 0 ? displayTotalGst / 2 : 0);
  const displaySubtotal = displayGrossTotal - displayCgst - displaySgst;
  const grossAfterDiscount = displayGrossTotal - displayDiscount;
  const roundedGrandTotal = Math.round(grossAfterDiscount);
  const roundOff = roundedGrandTotal - grossAfterDiscount;

  return (
    <div className="bill-print-root">
      <article className="bill-print-document mx-auto max-w-5xl border border-black bg-white text-black">
        <header className="grid grid-cols-2 border-b border-black text-[13px]">
          <div className="border-r border-black p-[10px] leading-[1.35]">
            <p className="text-[32px] font-bold uppercase tracking-[0.2px]">{info.name}</p>
            {shopAddressLines.map((line, idx) => (
              <p key={`shop-line-${idx}`}>{line}</p>
            ))}
            {info.phone && <p>Phone : {info.phone}</p>}
            {info.email && <p>E-Mail : {info.email}</p>}
          </div>

          <div className="p-[10px] leading-[1.45]">
            <p>
              <span className="font-semibold">Patient Name :</span> {customerName}
            </p>
            <p>
              <span className="font-semibold">Patient Address :</span> {customerAddress}
            </p>
            <p>
              <span className="font-semibold">Dr Name :</span> {doctorName}
            </p>
            <p>
              <span className="font-semibold">Dr Reg No.</span> : {doctorRegNo}
            </p>
            {isDraft && <p className="mt-1 text-xs font-semibold uppercase">Draft Preview</p>}
          </div>
        </header>

        <section className="grid grid-cols-[2fr_1.5fr_1.8fr] border-b border-black text-[12px]">
          <div className="border-r border-black p-2">
            <p>GSTIN : {info.gstin || '-'}</p>
            <p>D.L.No. : {info.dlNo || '-'}</p>
          </div>
          <div className="flex items-center justify-center border-r border-black text-center text-[16px] font-bold tracking-[0.5px]">
            GST INVOICE
          </div>
          <div className="p-2">
            <p>
              <span className="font-semibold">Invoice No.</span> : {bill.invoiceNumber || 'PENDING'}
            </p>
            <p>
              <span className="font-semibold">Date</span>: {formatDate(bill.billDate || new Date())}
            </p>
          </div>
        </section>

        <section>
          <table className="bill-document-table w-full border-collapse text-[11px]">
            <colgroup>
              <col style={{ width: '3%' }} />
              <col style={{ width: '27%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="border border-black px-1 py-1 text-left font-bold uppercase">Sn.</th>
                <th className="border border-black px-1 py-1 text-left font-bold uppercase">Product Name</th>
                <th className="border border-black px-1 py-1 text-left font-bold uppercase">Pack</th>
                <th className="border border-black px-1 py-1 text-left font-bold uppercase">HSN</th>
                <th className="border border-black px-1 py-1 text-left font-bold uppercase">Batch</th>
                <th className="border border-black px-1 py-1 text-left font-bold uppercase">Exp.</th>
                <th className="border border-black px-1 py-1 text-right font-bold uppercase">Qty</th>
                <th className="border border-black px-1 py-1 text-right font-bold uppercase">MRP</th>
                <th className="border border-black px-1 py-1 text-right font-bold uppercase">SGST</th>
                <th className="border border-black px-1 py-1 text-right font-bold uppercase">CGST</th>
                <th className="border border-black px-1 py-1 text-right font-bold uppercase">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(bill.items || []).map((item, index) => {
                const gstPercent = Number(item.gstPercent) || 0;
                const itemSgstPercent = Number(item.sgstPercent || (gstPercent / 2));
                const itemCgstPercent = Number(item.cgstPercent || (gstPercent / 2));

                return (
                  <tr key={`${item.medicineName}-${item.batchNumber}-${index}`}>
                    <td className="border-x border-black px-1 py-[3px] align-top">{index + 1}.</td>
                    <td className="border-x border-black px-1 py-1 align-top uppercase">{item.medicineName || '-'}</td>
                    <td className="border-x border-black px-1 py-1 align-top">{item.packSize || item.medicine?.packSize || '-'}</td>
                    <td className="border-x border-black px-1 py-1 align-top">{item.hsnCode || '-'}</td>
                    <td className="border-x border-black px-1 py-1 align-top">{item.batchNumber || '-'}</td>
                    <td className="border-x border-black px-1 py-1 align-top">{formatExpiry(item.expiryDate)}</td>
                    <td className="border-x border-black px-1 py-1 text-right align-top">{getQuantityLabel(item)}</td>
                    <td className="border-x border-black px-1 py-1 text-right align-top">{formatAmount(item.rate)}</td>
                    <td className="border-x border-black px-1 py-1 text-right align-top">
                      {itemSgstPercent.toFixed(2)}%
                    </td>
                    <td className="border-x border-black px-1 py-1 text-right align-top">
                      {itemCgstPercent.toFixed(2)}%
                    </td>
                    <td className="border-x border-black px-1 py-1 text-right align-top">
                      {formatAmount(item.total ?? item.amount)}
                    </td>
                  </tr>
                );
              })}
              {Array.from({ length: Math.max(0, 12 - (bill.items || []).length) }).map((_, index) => (
                <tr key={`blank-${index}`}>
                  <td className="border-x border-black h-[22px]" />
                  <td className="border-x border-black" />
                  <td className="border-x border-black" />
                  <td className="border-x border-black" />
                  <td className="border-x border-black" />
                  <td className="border-x border-black" />
                  <td className="border-x border-black" />
                  <td className="border-x border-black" />
                  <td className="border-x border-black" />
                  <td className="border-x border-black" />
                  <td className="border-x border-black" />
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="grid grid-cols-[1fr_290px] border-t border-black">
          <div className="border-r border-black p-2 text-[11px] leading-5">
            <p className="font-semibold">Terms & Conditions</p>
            <p>Goods once sold will not be taken back or exchanged.</p>
            <p>Bills not paid due date will attract 24% interest.</p>
            <p>All disputes subject to jurisdiction only.</p>
            <p>Prescribed sales tax declaration will be given.</p>
            <p className="mt-2 font-semibold">For {info.name.toUpperCase()}</p>
          </div>

          <div className="text-[12px]">
            <div className="flex items-center justify-between border-b border-black px-3 py-2">
              <span className="font-semibold">SUB TOTAL</span>
              <span className="font-semibold">{formatAmount(displaySubtotal)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-black px-3 py-2">
              <span>SGST</span>
              <span>{formatAmount(displaySgst)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-black px-3 py-2">
              <span>CGST</span>
              <span>{formatAmount(displayCgst)}</span>
            </div>
            {displayDiscount > 0 && (
              <div className="flex items-center justify-between border-b border-black px-3 py-2">
                <span>DISCOUNT TYPE</span>
                <span>{displayDiscountType}</span>
              </div>
            )}
            {displayDiscount > 0 && (
              <div className="flex items-center justify-between border-b border-black px-3 py-2">
                <span>DISCOUNT</span>
                <span>-{formatAmount(displayDiscount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-b border-black px-3 py-2">
              <span>Roundoff</span>
              <span>{formatAmount(roundOff)}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-3 text-[28px] font-bold">
              <span>GRAND TOTAL</span>
              <span>{formatAmount(roundedGrandTotal)}</span>
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}
