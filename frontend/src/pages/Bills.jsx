import React, { useState, useEffect } from 'react';
import { Search, Plus, Eye, Trash2, X, ChevronLeft, ChevronRight, Calendar, DollarSign, Receipt, ChevronDown, ChevronUp, Phone, Printer, RotateCcw, Users, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BillPrintDocument from '../components/BillPrintDocument';
import api from '../services/api';

export default function Bills() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedBill, setExpandedBill] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showPendingTab, setShowPendingTab] = useState(false);
  const [pendingCustomers, setPendingCustomers] = useState([]);
  const [pendingSummaryCustomers, setPendingSummaryCustomers] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingSearch, setPendingSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  const SHOP_INFO = {
    name: 'BHAGYA MEDICALS',
    addressLine1: 'GROUND FLOOR PRIME CITY CENTRE MALL',
    addressLine2: 'OPP GOVT. COLLEGE KARKALA UDUPI',
    phone: '8829063939',
    email: 'devarajshetty.56@gmail.com',
    gstin: '29AEQPD2184N1ZW',
    dlNo: 'KA-UD1-267389',
    state: 'Maharashtra'
  };

  const itemsPerPage = 10;

  useEffect(() => {
    fetchBills();
  }, [currentPage, searchTerm, showPendingTab, paymentFilter]);

  useEffect(() => {
    fetchPendingSummary();
  }, []);

  useEffect(() => {
    if (showPendingTab) {
      fetchPendingCustomers();
    }
  }, [showPendingTab, pendingSearch]);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const response = await api.get('/bills', {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          search: searchTerm,
          paymentStatus: showPendingTab ? undefined : paymentFilter
        }
      });
      setBills(response.data.data || []);
      setTotalPages(response.data.totalPages || 1);
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

  const fetchPendingCustomers = async () => {
    try {
      setPendingLoading(true);
      const response = await api.get('/bills/pending-customers', {
        params: { search: pendingSearch }
      });
      setPendingCustomers(response.data.data || []);
    } catch (error) {
      console.error('Error fetching pending customers:', error);
      setPendingCustomers([]);
    } finally {
      setPendingLoading(false);
    }
  };

  const fetchPendingSummary = async () => {
    try {
      const response = await api.get('/bills/pending-customers');
      setPendingSummaryCustomers(response.data.data || []);
    } catch (error) {
      console.error('Error fetching pending summary:', error);
      setPendingSummaryCustomers([]);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/bills/${id}`);
      setDeleteConfirm(null);
      fetchBills();
      fetchPendingSummary();
      if (showPendingTab) {
        fetchPendingCustomers();
      }
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
      case 'UPI': return 'bg-emerald-100 text-emerald-800';
      case 'CARD': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const calculateTotalItems = (items) => {
    return items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
  };

  const formatQuantityLabel = (item = {}) => {
    if (Number(item.packQuantity || 0) > 0) {
      return `${item.packQuantity} pack`;
    }

    if (Number(item.looseQuantity || 0) > 0) {
      return `${item.looseQuantity} tablet`;
    }

    return `${item.quantity || item.unitQuantity || 0} tablet`;
  };

  const getPendingAmount = (bill) => {
    const grandTotal = Number(bill?.netGrandTotal ?? bill?.grandTotal) || 0;
    const amountPaid = Number(bill?.amountPaid) || 0;
    return Math.max(grandTotal - amountPaid, 0);
  };

  const isBillPaid = (bill) => getPendingAmount(bill) <= 0;

  const formatAmount = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

  const filteredBills = bills.filter((bill) => {
    if (paymentFilter === 'PAID') {
      return isBillPaid(bill);
    }

    if (paymentFilter === 'PENDING') {
      return !isBillPaid(bill);
    }

    return true;
  });

  const visiblePendingCustomers = pendingCustomers;
  const pendingBalanceTotal = pendingSummaryCustomers.reduce((sum, customer) => sum + (customer.totalPending || 0), 0);

  const printInvoice = () => {
    window.print();
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bills</h1>
          <p className="text-gray-600 mt-1">Manage customer bills and invoices</p>
        </div>
        <button
          onClick={() => navigate('/billing')}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus size={20} />
          New Bill
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <button
          onClick={() => setShowPendingTab(false)}
          className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            !showPendingTab 
              ? 'border-emerald-500 text-emerald-600 bg-emerald-50' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          All Bills
        </button>
        <button
          onClick={() => setShowPendingTab(true)}
          className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            showPendingTab 
              ? 'border-orange-500 text-orange-600 bg-orange-50' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Pending Customers <AlertCircle className="ml-1 w-4 h-4 inline" />
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={showPendingTab ? "Search pending customers..." : "Search by invoice number, customer name, or phone..."}
            value={showPendingTab ? pendingSearch : searchTerm}
            onChange={(e) => {
              if (showPendingTab) {
                setPendingSearch(e.target.value);
              } else {
                setCurrentPage(1);
                setSearchTerm(e.target.value);
              }
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>

      {!showPendingTab && (
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: 'ALL', label: 'All' },
            { key: 'PAID', label: 'Paid' },
            { key: 'PENDING', label: 'Pending' }
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => {
                setCurrentPage(1);
                setPaymentFilter(filter.key);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                paymentFilter === filter.key
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Receipt className="text-emerald-600" size={24} />
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
                Rs. {bills.reduce((sum, b) => sum + (b.netGrandTotal ?? b.grandTotal ?? 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Calendar className="text-amber-600" size={24} />
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
                {formatAmount(pendingBalanceTotal)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {showPendingTab ? (
        // Pending Customers Table
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {pendingLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading pending customers...</p>
            </div>
          ) : visiblePendingCustomers.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">No pending payments</h3>
              <p className="text-sm">All customers have cleared their dues.</p>
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-red-50">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    {visiblePendingCustomers.length} Customers with Pending Payments
                  </h2>
                  <span className="ml-auto text-2xl font-bold text-orange-600">
                    {formatAmount(visiblePendingCustomers.reduce((sum, c) => sum + (c.totalPending || 0), 0))}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Pending</th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Bills</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recent</th>
                      <th className="w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {visiblePendingCustomers.map((customer) => (
                        <tr key={`${customer.customerName}-${customer.customerPhone}`} className="hover:bg-orange-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{customer.customerName}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">{customer.customerPhone}</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-lg font-bold text-red-600">
                              {formatAmount(customer.totalPending)}
                            </div>
                            <div className="text-xs text-gray-500">Pending amount</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-sm font-medium text-gray-900">{customer.billCount}</div>
                          </td>
                          <td className="px-6 py-4 text-left">
                            <div className="text-sm text-gray-900">{customer.recentInvoiceNumber}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(customer.recentBillDate).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                setSearchTerm(customer.customerName || customer.customerPhone || '');
                                setPaymentFilter('PENDING');
                                setShowPendingTab(false);
                                setCurrentPage(1);
                              }}
                              className="text-emerald-600 hover:text-emerald-900 text-sm font-medium"
                            >
                              View Bills
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : (
        // Bills Table
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
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
                  {filteredBills.map((bill) => (
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
                            Rs. {Number(bill.netGrandTotal ?? bill.grandTotal ?? 0).toLocaleString()}
                          </div>
                          {Number(bill.returnTotal || 0) > 0 && (
                            <div className="text-xs text-amber-600">
                              Return: {formatAmount(bill.returnTotal)}
                            </div>
                          )}
                          {getPendingAmount(bill) > 0 && (
                            <div className="text-xs text-red-600">
                              Pending: {formatAmount(getPendingAmount(bill))}
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
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="View Invoice & Print"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => navigate('/sales-returns', { state: { billId: bill._id } })}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Sales Return"
                            >
                              <RotateCcw size={16} />
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
                            <div className="mb-3 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm md:grid-cols-2">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Doctor Name</p>
                                <p className="font-medium text-gray-900">{bill.doctorName || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Doctor Reg No.</p>
                                <p className="font-medium text-gray-900">{bill.doctorRegNo || '-'}</p>
                              </div>
                            </div>
                            <div className="border rounded-lg overflow-hidden">
                              <table className="w-full">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Medicine</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Pack</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">HSN</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Batch</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Qty</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Rate</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">CGST</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">SGST</th>
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
                                      <td className="px-4 py-2 text-sm text-gray-500">{item.packSize || item.medicine?.packSize || '-'}</td>
                                      <td className="px-4 py-2 text-sm text-gray-500">{item.hsnCode || item.medicine?.hsnCodeString || '-'}</td>
                                      <td className="px-4 py-2 text-sm text-gray-500">{item.batchNumber}</td>
                                      <td className="px-4 py-2 text-sm text-gray-900">{formatQuantityLabel(item)}</td>
                                      <td className="px-4 py-2 text-sm text-gray-900">Rs. {item.rate?.toFixed(2)}</td>
                                      <td className="px-4 py-2 text-sm text-gray-500">{Number(item.cgstPercent || (item.gstPercent || 0) / 2).toFixed(2)}%</td>
                                      <td className="px-4 py-2 text-sm text-gray-500">{Number(item.sgstPercent || (item.gstPercent || 0) / 2).toFixed(2)}%</td>
                                      <td className="px-4 py-2 text-sm text-gray-500">{item.discountPercent}%</td>
                                      <td className="px-4 py-2 text-sm font-medium text-gray-900">Rs. {item.total?.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-gray-50">
                                  <tr>
                                    <td colSpan="8" className="px-4 py-2 text-right text-sm font-medium text-gray-600">Subtotal:</td>
                                    <td colSpan="2" className="px-4 py-2 text-sm font-medium text-gray-900">Rs. {bill.subtotal?.toFixed(2)}</td>
                                  </tr>
                                  <tr>
                                    <td colSpan="8" className="px-4 py-2 text-right text-sm font-medium text-gray-600">CGST:</td>
                                    <td colSpan="2" className="px-4 py-2 text-sm font-medium text-gray-900">Rs. {Number(bill.totalCgst || 0).toFixed(2)}</td>
                                  </tr>
                                  <tr>
                                    <td colSpan="8" className="px-4 py-2 text-right text-sm font-medium text-gray-600">SGST:</td>
                                    <td colSpan="2" className="px-4 py-2 text-sm font-medium text-gray-900">Rs. {Number(bill.totalSgst || 0).toFixed(2)}</td>
                                  </tr>
                                  <tr>
                                    <td colSpan="8" className="px-4 py-2 text-right text-sm font-medium text-gray-600">Total GST:</td>
                                    <td colSpan="2" className="px-4 py-2 text-sm font-medium text-gray-900">Rs. {bill.totalGst?.toFixed(2)}</td>
                                  </tr>
                                  {bill.discountAmount > 0 && (
                                    <tr>
                                      <td colSpan="8" className="px-4 py-2 text-right text-sm font-medium text-gray-600">
                                        Discount ({bill.discountPercent}%):
                                      </td>
                                      <td colSpan="2" className="px-4 py-2 text-sm font-medium text-green-600">-Rs. {bill.discountAmount?.toFixed(2)}</td>
                                    </tr>
                                  )}
                                  <tr>
                                    <td colSpan="8" className="px-4 py-2 text-right text-sm font-medium text-gray-600">Roundoff:</td>
                                    <td colSpan="2" className="px-4 py-2 text-sm font-medium text-gray-900">
                                      Rs. {(Math.round(Number((bill.subtotal || 0) - (bill.discountAmount || 0))) - Number((bill.subtotal || 0) - (bill.discountAmount || 0))).toFixed(2)}
                                    </td>
                                  </tr>
                                  <tr className="bg-emerald-50">
                                    <td colSpan="8" className="px-4 py-2 text-right text-sm font-bold text-gray-900">Grand Total:</td>
                                    <td colSpan="2" className="px-4 py-2 text-sm font-bold text-emerald-900">
                                      Rs. {Math.round(Number((bill.subtotal || 0) - (bill.discountAmount || 0))).toFixed(2)}
                                    </td>
                                  </tr>
                                  {Number(bill.returnTotal || 0) > 0 && (
                                    <>
                                      <tr>
                                        <td colSpan="8" className="px-4 py-2 text-right text-sm font-medium text-gray-600">Sales Return:</td>
                                        <td colSpan="2" className="px-4 py-2 text-sm font-medium text-amber-600">-Rs. {Number(bill.returnTotal || 0).toFixed(2)}</td>
                                      </tr>
                                      <tr className="bg-emerald-50">
                                        <td colSpan="8" className="px-4 py-2 text-right text-sm font-bold text-gray-900">Net Sales:</td>
                                        <td colSpan="2" className="px-4 py-2 text-sm font-bold text-emerald-700">Rs. {Number(bill.netGrandTotal ?? bill.grandTotal ?? 0).toFixed(2)}</td>
                                      </tr>
                                    </>
                                  )}
                                  <tr>
                                    <td colSpan="8" className="px-4 py-2 text-right text-sm font-medium text-gray-600">Amount Paid:</td>
                                    <td colSpan="2" className="px-4 py-2 text-sm font-medium text-gray-900">Rs. {bill.amountPaid?.toFixed(2)}</td>
                                  </tr>
                                  {getPendingAmount(bill) > 0 && (
                                    <tr>
                                      <td colSpan="8" className="px-4 py-2 text-right text-sm font-medium text-gray-600">Pending Amount:</td>
                                      <td colSpan="2" className="px-4 py-2 text-sm font-medium text-red-600">{formatAmount(getPendingAmount(bill))}</td>
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

            {filteredBills.length === 0 && (
              <div className="px-4 py-10 text-center text-gray-500 border-t border-gray-200">
                No bills found for the selected filter.
              </div>
            )}

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {filteredBills.length} results
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
