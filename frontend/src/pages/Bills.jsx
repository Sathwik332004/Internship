import React, { useState, useEffect } from 'react';
import { Search, Plus, Eye, Trash2, X, ChevronLeft, ChevronRight, Calendar, DollarSign, Receipt, ChevronDown, ChevronUp, User, Phone, Printer } from 'lucide-react';
import BillPrintDocument from '../components/BillPrintDocument';
import api from '../services/api';

export default function Bills() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedBill, setExpandedBill] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);

  const SHOP_INFO = {
    name: 'Medical Store',
    state: 'Maharashtra'
  };

  const itemsPerPage = 10;

  useEffect(() => {
    fetchBills();
  }, [currentPage, searchTerm]);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/bills?page=${currentPage}&limit=${itemsPerPage}&search=${searchTerm}`);
      setBills(response.data.data || []);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (error) {
      console.error('Error fetching bills:', error);
      // Use sample data if API fails
      setBills([
        { _id: '1', invoiceNumber: 'INV/20250205/0001', customerName: 'Ramesh Kumar', customerPhone: '9876543210', billDate: '2025-02-05', items: [{ medicineName: 'PARACETAMOL', quantity: 2, rate: 25.00, total: 56.00 }], grandTotal: 76.72, paymentMode: 'CASH', amountPaid: 76.72, balance: 0 },
        { _id: '2', invoiceNumber: 'INV/20250206/0001', customerName: 'Sunita Devi', customerPhone: '9876543211', billDate: '2025-02-06', items: [{ medicineName: 'AMOXICILLIN', quantity: 1, rate: 65.00, total: 69.55 }], grandTotal: 69.55, paymentMode: 'UPI', amountPaid: 69.55, balance: 0 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/bills/${id}`);
      setDeleteConfirm(null);
      fetchBills();
    } catch (error) {
      console.error('Error deleting bill:', error);
      alert('Error deleting bill. Please try again.');
    }
  };

  const toggleExpand = (billId) => {
    setExpandedBill(expandedBill === billId ? null : billId);
  };

  const getPaymentModeColor = (mode) => {
    switch (mode) {
      case 'CASH': return 'bg-green-100 text-green-800';
      case 'UPI': return 'bg-blue-100 text-blue-800';
      case 'CARD': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const calculateTotalItems = (items) => {
    return items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
  };

  const printInvoice = () => {
    window.print();
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bills</h1>
          <p className="text-gray-600 mt-1">Manage customer bills and invoices</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          New Bill
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by invoice number, customer name, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Receipt className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Bills</p>
              <p className="text-2xl font-bold text-gray-900">{bills.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{bills.reduce((sum, b) => sum + (b.grandTotal || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Calendar className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Today's Bills</p>
              <p className="text-2xl font-bold text-gray-900">
                {bills.filter(b => {
                  const today = new Date().toDateString();
                  return new Date(b.billDate).toDateString() === today;
                }).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <DollarSign className="text-orange-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{bills.reduce((sum, b) => sum + (b.balance || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading bills...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12"></th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {bills.map((bill) => (
                    <React.Fragment key={bill._id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-2 sm:px-4 py-4">
                          <button
                            onClick={() => toggleExpand(bill._id)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                          >
                            {expandedBill === bill._id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </button>
                        </td>
                        <td className="px-2 sm:px-4 py-4">
                          <div className="font-medium text-gray-900 text-sm">{bill.invoiceNumber}</div>
                        </td>
                        <td className="px-2 sm:px-4 py-4">
                          <div className="text-sm font-medium text-gray-900">{bill.customerName || 'Walk-in Customer'}</div>
                          {bill.customerPhone && (
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                              <Phone size={12} />
                              {bill.customerPhone}
                            </div>
                          )}
                        </td>
                        <td className="hidden sm:table-cell px-4 py-4">
                          <div className="text-sm text-gray-900">
                            {new Date(bill.billDate).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-4 py-4">
                          <div className="text-sm text-gray-900">
                            {calculateTotalItems(bill.items)} items
                          </div>
                          <div className="text-xs text-gray-500">
                            {bill.items?.length} medicines
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            ₹{bill.grandTotal?.toLocaleString()}
                          </div>
                          {bill.balance > 0 && (
                            <div className="text-xs text-red-600">
                              Bal: ₹{bill.balance?.toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="hidden lg:table-cell px-4 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentModeColor(bill.paymentMode)}`}>
                            {bill.paymentMode}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setSelectedBill(bill);
                                setShowPrintModal(true);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View Invoice & Print"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(bill)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded Details */}
                      {expandedBill === bill._id && (
                        <tr>
                          <td colSpan="8" className="px-4 py-4 bg-gray-50">
                            <div className="border rounded-lg overflow-hidden">
                              <table className="w-full">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Medicine</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Batch</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Qty</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Rate</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">GST</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Disc</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                  {bill.items?.map((item, index) => (
                                    <tr key={index}>
                                      <td className="px-4 py-2 text-sm text-gray-900">
                                        <div>{item.medicineName}</div>
                                        <div className="text-xs text-gray-500">{item.brandName}</div>
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-500">{item.batchNumber}</td>
                                      <td className="px-4 py-2 text-sm text-gray-900">{item.quantity}</td>
                                      <td className="px-4 py-2 text-sm text-gray-900">₹{item.rate?.toFixed(2)}</td>
                                      <td className="px-4 py-2 text-sm text-gray-500">{item.gstPercent}%</td>
                                      <td className="px-4 py-2 text-sm text-gray-500">{item.discountPercent}%</td>
                                      <td className="px-4 py-2 text-sm font-medium text-gray-900">₹{item.total?.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-gray-50">
                                  <tr>
                                    <td colSpan="5" className="px-4 py-2 text-right text-sm font-medium text-gray-600">Subtotal:</td>
                                    <td colSpan="2" className="px-4 py-2 text-sm font-medium text-gray-900">₹{bill.subtotal?.toFixed(2)}</td>
                                  </tr>
                                  <tr>
                                    <td colSpan="5" className="px-4 py-2 text-right text-sm font-medium text-gray-600">Total GST:</td>
                                    <td colSpan="2" className="px-4 py-2 text-sm font-medium text-gray-900">₹{bill.totalGst?.toFixed(2)}</td>
                                  </tr>
                                  {bill.discountAmount > 0 && (
                                    <tr>
                                      <td colSpan="5" className="px-4 py-2 text-right text-sm font-medium text-gray-600">
                                        Discount ({bill.discountPercent}%):
                                      </td>
                                      <td colSpan="2" className="px-4 py-2 text-sm font-medium text-green-600">-₹{bill.discountAmount?.toFixed(2)}</td>
                                    </tr>
                                  )}
                                  <tr className="bg-blue-50">
                                    <td colSpan="5" className="px-4 py-2 text-right text-sm font-bold text-gray-900">Grand Total:</td>
                                    <td colSpan="2" className="px-4 py-2 text-sm font-bold text-blue-900">₹{bill.grandTotal?.toFixed(2)}</td>
                                  </tr>
                                  <tr>
                                    <td colSpan="5" className="px-4 py-2 text-right text-sm font-medium text-gray-600">Amount Paid:</td>
                                    <td colSpan="2" className="px-4 py-2 text-sm font-medium text-gray-900">₹{bill.amountPaid?.toFixed(2)}</td>
                                  </tr>
                                  {bill.balance > 0 && (
                                    <tr>
                                      <td colSpan="5" className="px-4 py-2 text-right text-sm font-medium text-gray-600">Balance:</td>
                                      <td colSpan="2" className="px-4 py-2 text-sm font-medium text-red-600">₹{bill.balance?.toFixed(2)}</td>
                                    </tr>
                                  )}
                                </tfoot>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {bills.length} results
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New Bill Modal - Simplified */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">New Bill</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                To create a new bill, please use the Billing form. This would typically include:
              </p>
              <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
                <li>Customer details (name and phone)</li>
                <li>Adding medicines from inventory</li>
                <li>Automatic price and GST calculation</li>
                <li>Applying discounts per item or overall</li>
                <li>Payment mode selection (Cash, UPI, Card)</li>
                <li>Amount paid and balance calculation</li>
              </ul>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> The full billing form would be implemented here with medicine search, batch selection, automatic stock deduction, and print functionality.
                </p>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Confirm Delete</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete bill <strong>{deleteConfirm.invoiceNumber}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm._id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Invoice Modal */}
      {showPrintModal && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
            {/* Controls - no-print */}
            <div className="no-print bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-t-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Invoice Preview - {selectedBill.invoiceNumber}
                </h2>
                <p className="text-slate-300 text-sm mt-1">
                  {selectedBill.customerName || 'Walk-in Customer'}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={printInvoice}
                  className="flex items-center justify-center gap-2 bg-white text-slate-900 px-6 py-2.5 rounded-xl font-semibold hover:bg-gray-100 shadow-lg transition-all"
                >
                  <Printer size={20} />
                  Print Invoice
                </button>
                <button
                  onClick={() => {
                    setShowPrintModal(false);
                    setSelectedBill(null);
                  }}
                  className="flex items-center justify-center gap-2 bg-slate-700 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-slate-600 transition-all"
                >
                  <X size={20} />
                  Close
                </button>
              </div>
            </div>

            {/* Invoice Document */}
            <div className="flex-1 p-0">
              <BillPrintDocument
                bill={selectedBill}
                shopInfo={SHOP_INFO}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
