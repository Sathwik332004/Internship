const defaultShopInfo = {
  name: 'Medical Store',
  address: '',
  phone: '',
  gstin: '',
  state: 'Maharashtra'
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(Number(amount) || 0);

const formatDateTime = (value) => {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatExpiry = (value) => {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric'
  });
};

const getQuantityLabel = (item) => {
  if (item.quantityLabel) {
    return item.quantityLabel;
  }

  if (item.packQuantity > 0) {
    return `${item.packQuantity} pack`;
  }

  if (item.looseQuantity > 0) {
    return `${item.looseQuantity} loose`;
  }

  return `${item.quantity || item.unitQuantity || 0}`;
};

export default function BillPrintDocument({ bill, shopInfo, isDraft = false }) {
  if (!bill) {
    return null;
  }

  const info = { ...defaultShopInfo, ...shopInfo };
  const customerName = bill.customerName?.trim() || 'Walk-in Customer';
  const customerState = bill.customerState?.trim();
  const lineSubtotal = (bill.items || []).reduce((sum, item) => {
    const lineTotal = Number(item.total ?? item.amount);
    return sum + (Number.isFinite(lineTotal) ? lineTotal : 0);
  }, 0);
  const displaySubtotal = lineSubtotal > 0 ? lineSubtotal : Number(bill.subtotal) || 0;
  const displayDiscount = Number(bill.discountAmount) || 0;
  const displayGrandTotal = displaySubtotal - displayDiscount;
  const displayAmountPaid = Number(bill.amountPaid) || 0;
  const balance = displayAmountPaid - displayGrandTotal;

  return (
    <div className="bill-print-root">
      <article className="bill-print-document mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <header className="flex flex-col gap-6 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Customer Invoice</p>
                <h2 className="text-3xl font-bold text-slate-900">{info.name}</h2>
              </div>
              {isDraft && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Draft Preview
                </span>
              )}
            </div>

            {info.address && <p className="text-sm text-slate-600">{info.address}</p>}

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
              {info.phone && <span>Phone: {info.phone}</span>}
              {info.gstin && <span>GSTIN: {info.gstin}</span>}
              {info.state && <span>State: {info.state}</span>}
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 md:min-w-72">
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium text-slate-500">Invoice No.</span>
              <span className="font-semibold text-slate-900">{bill.invoiceNumber || 'Will be assigned on save'}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium text-slate-500">Bill Date</span>
              <span className="font-semibold text-slate-900">{formatDateTime(bill.billDate || new Date())}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium text-slate-500">Payment</span>
              <span className="font-semibold text-slate-900">{bill.paymentMode || 'CASH'}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium text-slate-500">Tax Type</span>
              <span className="font-semibold text-slate-900">{bill.isInterstate ? 'IGST' : 'CGST + SGST'}</span>
            </div>
          </div>
        </header>

        <section className="grid gap-4 border-b border-slate-200 py-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Billed To</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">{customerName}</h3>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <p>Phone: {bill.customerPhone?.trim() || '-'}</p>
              <p>State: {customerState || '-'}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Notes</p>
            <p className="mt-2">Prices are inclusive of GST. Please verify medicines and quantities before leaving the counter.</p>
          </div>
        </section>

        <section className="py-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="bill-document-table w-full">
              <thead>
                <tr className="bg-slate-100">
                  <th className="w-14 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Medicine</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Batch</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Expiry</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">GST</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {bill.items?.map((item, index) => (
                  <tr key={`${item.medicineName}-${item.batchNumber}-${index}`}>
                    <td className="px-4 py-4 text-sm text-slate-500">{index + 1}</td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{item.medicineName}</div>
                      <div className="text-xs text-slate-500">{item.brandName || '-'}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">{item.batchNumber || '-'}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{formatExpiry(item.expiryDate)}</td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-slate-900">{getQuantityLabel(item)}</td>
                    <td className="px-4 py-4 text-right text-sm text-slate-700">{formatCurrency(item.rate)}</td>
                    <td className="px-4 py-4 text-right text-sm text-slate-700">{item.gstPercent || 0}%</td>
                    <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900">
                      {formatCurrency(item.total ?? item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 border-t border-slate-200 pt-6 md:grid-cols-[1fr_320px]">
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold uppercase tracking-wide text-slate-700">Declaration</p>
            <p className="mt-2">This is a computer-generated invoice and does not require a physical signature.</p>
            <p className="mt-3 text-xs text-slate-500">Thank you for shopping with us. Medicines once sold may not be eligible for return unless required by law.</p>
          </div>

          <div className="rounded-2xl border border-slate-200">
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Subtotal (Incl. GST)</span>
                <span className="font-medium text-slate-900">{formatCurrency(displaySubtotal)}</span>
              </div>

              {displayDiscount > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Discount</span>
                  <span className="font-medium text-emerald-700">-{formatCurrency(displayDiscount)}</span>
                </div>
              )}

              {bill.isInterstate ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">IGST</span>
                  <span className="font-medium text-slate-900">{formatCurrency(bill.totalIgst || bill.totalGst)}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">CGST</span>
                    <span className="font-medium text-slate-900">{formatCurrency(bill.totalCgst)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">SGST</span>
                    <span className="font-medium text-slate-900">{formatCurrency(bill.totalSgst)}</span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between gap-4 border-t border-dashed border-slate-200 pt-3">
                <span className="text-slate-500">Total GST</span>
                <span className="font-medium text-slate-900">{formatCurrency(bill.totalGst)}</span>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3 text-base">
                <span className="font-semibold text-slate-900">Grand Total</span>
                <span className="font-bold text-slate-900">{formatCurrency(displayGrandTotal)}</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Amount Paid</span>
                <span className="font-medium text-slate-900">{formatCurrency(displayAmountPaid)}</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">{balance >= 0 ? 'Change / Balance' : 'Amount Due'}</span>
                <span className={`font-semibold ${balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatCurrency(Math.abs(balance))}
                </span>
              </div>
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}
