import React, { useState, useEffect } from 'react';
import {
  TrendingUp, 
  DollarSign, 
  Package, 
  ShoppingCart, 
  BarChart3,
  AlertTriangle,
  FileText
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Reports() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('sales');
  const [dateRange, setDateRange] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [salesData, setSalesData] = useState({
    summary: { totalSales: 0, totalGst: 0, totalCgst: 0, totalSgst: 0, totalIgst: 0, totalDiscount: 0, totalBills: 0 },
    bills: [],
    salesByDate: {},
    paymentModeDistribution: {}
  });
  
  const [inventoryData, setInventoryData] = useState({
    summary: { totalMedicines: 0, lowStockCount: 0, expiringCount: 0, expiredCount: 0, totalValue: 0 },
    medicines: []
  });
  
  const [purchaseData, setPurchaseData] = useState({
    summary: { totalPurchases: 0, totalGst: 0, totalItems: 0 },
    purchases: []
  });

  const [gstData, setGstData] = useState({
    summary: { totalSales: 0, totalGst: 0, totalCgst: 0, totalSgst: 0, totalIgst: 0, totalBills: 0 },
    bills: []
  });

  const [expiryData, setExpiryData] = useState({
    expiring: [],
    expired: []
  });

  useEffect(() => {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(lastMonth.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [activeTab, dateRange, startDate, endDate]);

  useEffect(() => {
    if (!isAdmin && (activeTab === 'purchase' || activeTab === 'inventory')) {
      setActiveTab('sales');
    }
  }, [activeTab, isAdmin]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      // Set date filters
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let filterStartDate = new Date(startDate);
      let filterEndDate = new Date(endDate);
      filterEndDate.setHours(23, 59, 59, 999);
      
      if (dateRange === 'today') {
        filterStartDate = today;
        filterEndDate = new Date(today);
        filterEndDate.setHours(23, 59, 59, 999);
      } else if (dateRange === 'week') {
        filterStartDate = new Date(today);
        filterStartDate.setDate(today.getDate() - 7);
      } else if (dateRange === 'month') {
        filterStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
      } else if (dateRange === 'year') {
        filterStartDate = new Date(today.getFullYear(), 0, 1);
      }

      // Fetch data based on active tab
      if (activeTab === 'sales') {
        const billsRes = await api.get(`/bills/report/sales?startDate=${filterStartDate.toISOString()}&endDate=${filterEndDate.toISOString()}`);
        setSalesData(billsRes.data.data || { summary: {}, bills: [], salesByDate: {} });
      } else if (activeTab === 'purchase') {
        const purchasesRes = await api.get(`/purchases/report?startDate=${filterStartDate.toISOString()}&endDate=${filterEndDate.toISOString()}`);
        setPurchaseData(purchasesRes.data.data || { summary: {}, purchases: [] });
      } else if (activeTab === 'gst') {
        const gstRes = await api.get(`/bills/report/gst?startDate=${filterStartDate.toISOString()}&endDate=${filterEndDate.toISOString()}`);
        setGstData(gstRes.data.data || { summary: {}, bills: [] });
      } else if (activeTab === 'inventory') {
        const inventoryRes = await api.get('/medicines/report/inventory');
        setInventoryData(inventoryRes.data.data || { summary: {}, medicines: [] });
      } else if (activeTab === 'expiry') {
        const [expiringRes, expiredRes] = await Promise.all([
          api.get('/medicines/alerts/expiring?days=90'),
          api.get('/medicines/alerts/expired')
        ]);
        setExpiryData({
          expiring: expiringRes.data.data || [],
          expired: expiredRes.data.data || []
        });
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const tabs = [
    { id: 'sales', label: 'Sales Report', icon: DollarSign },
    { id: 'gst', label: 'GST Report', icon: BarChart3 },
    { id: 'expiry', label: 'Expiry Report', icon: AlertTriangle }
  ];

  if (isAdmin) {
    tabs.splice(1, 0, { id: 'purchase', label: 'Purchase Report', icon: ShoppingCart });
    tabs.splice(3, 0, { id: 'inventory', label: 'Inventory Report', icon: Package });
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-600">View and analyze your store data</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 mb-6 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex gap-2">
            {['today', 'week', 'month', 'year', 'custom'].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-2 rounded-lg text-sm ${
                  dateRange === range
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
          
          {dateRange === 'custom' && (
            <div className="flex gap-4 items-center">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      ) : (
        <>
          {/* Sales Report */}
          {activeTab === 'sales' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Sales</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(salesData.summary.totalSales)}</p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-lg">
                      <DollarSign className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total GST</p>
                      <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(salesData.summary.totalGst)}</p>
                    </div>
                    <div className="p-3 bg-amber-100 rounded-lg">
                      <BarChart3 className="w-6 h-6 text-amber-600" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Bills</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{salesData.summary.totalBills}</p>
                    </div>
                    <div className="p-3 bg-emerald-100 rounded-lg">
                      <FileText className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Avg. Bill Value</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {formatCurrency(salesData.summary.totalBills > 0 ? salesData.summary.totalSales / salesData.summary.totalBills : 0)}
                      </p>
                    </div>
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <TrendingUp className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* GST Breakdown */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">GST Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-emerald-50 rounded-lg">
                    <p className="text-sm text-emerald-600">CGST</p>
                    <p className="text-xl font-bold text-emerald-900">{formatCurrency(salesData.summary.totalCgst)}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-600">SGST</p>
                    <p className="text-xl font-bold text-green-900">{formatCurrency(salesData.summary.totalSgst)}</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <p className="text-sm text-amber-600">IGST</p>
                    <p className="text-xl font-bold text-amber-900">{formatCurrency(salesData.summary.totalIgst)}</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <p className="text-sm text-orange-600">Total Discount</p>
                    <p className="text-xl font-bold text-orange-900">{formatCurrency(salesData.summary.totalDiscount)}</p>
                  </div>
                </div>
              </div>

              {/* Sales Table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">Sales Details</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">GST</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {salesData.bills?.slice(0, 10).map((bill) => (
                        <tr key={bill._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{bill.invoiceNumber}</td>
                          <td className="px-4 py-3 text-gray-600">{formatDate(bill.billDate)}</td>
                          <td className="px-4 py-3 text-gray-600">{bill.customerName || 'Walk-in'}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(bill.subtotal)}</td>
                          <td className="px-4 py-3 text-right text-amber-600">{formatCurrency(bill.totalGst)}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(bill.grandTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Purchase Report */}
          {activeTab === 'purchase' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Purchases</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(purchaseData.summary.totalPurchases)}</p>
                    </div>
                    <div className="p-3 bg-emerald-100 rounded-lg">
                      <ShoppingCart className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total GST</p>
                      <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(purchaseData.summary.totalGst)}</p>
                    </div>
                    <div className="p-3 bg-amber-100 rounded-lg">
                      <BarChart3 className="w-6 h-6 text-amber-600" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Items</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{purchaseData.summary.totalItems}</p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-lg">
                      <Package className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">Purchase Details</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">GST</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {purchaseData.purchases?.slice(0, 10).map((purchase) => (
                        <tr key={purchase._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{purchase.purchaseNumber}</td>
                          <td className="px-4 py-3 text-gray-600">{formatDate(purchase.purchaseDate)}</td>
                          <td className="px-4 py-3 text-gray-600">{purchase.supplier?.supplierName || 'N/A'}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(purchase.subtotal)}</td>
                          <td className="px-4 py-3 text-right text-amber-600">{formatCurrency(purchase.totalGst)}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(purchase.grandTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* GST Report */}
          {activeTab === 'gst' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <p className="text-sm font-medium text-gray-600">Total Sales (Base)</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(gstData.summary.totalSales)}</p>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <p className="text-sm font-medium text-gray-600">Total GST Collected</p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(gstData.summary.totalGst)}</p>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <p className="text-sm font-medium text-gray-600">CGST</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(gstData.summary.totalCgst)}</p>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <p className="text-sm font-medium text-gray-600">SGST</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(gstData.summary.totalSgst)}</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">GST Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 bg-emerald-50 rounded-lg text-center">
                    <p className="text-emerald-600 font-medium">CGST</p>
                    <p className="text-2xl font-bold text-emerald-900">{formatCurrency(gstData.summary.totalCgst)}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg text-center">
                    <p className="text-green-600 font-medium">SGST</p>
                    <p className="text-2xl font-bold text-green-900">{formatCurrency(gstData.summary.totalSgst)}</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg text-center">
                    <p className="text-amber-600 font-medium">IGST</p>
                    <p className="text-2xl font-bold text-amber-900">{formatCurrency(gstData.summary.totalIgst)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Inventory Report */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <p className="text-sm font-medium text-gray-600">Total Medicines</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{inventoryData.summary.totalMedicines}</p>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <p className="text-sm font-medium text-gray-600">Low Stock</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{inventoryData.summary.lowStockCount}</p>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <p className="text-sm font-medium text-gray-600">Expiring Soon</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">{inventoryData.summary.expiringCount}</p>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <p className="text-sm font-medium text-gray-600">Stock Value</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(inventoryData.summary.totalValue)}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">Inventory Details</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">GST %</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {inventoryData.medicines?.slice(0, 10).map((med) => (
                        <tr key={med._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{med.medicineName}</td>
                          <td className="px-4 py-3 text-gray-600">{med.brandName}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{med.quantity || 0}</td>
                          <td className="px-4 py-3 text-right text-amber-600">{med.gstPercent}%</td>
                          <td className="px-4 py-3 text-gray-600">{med.expiryDate ? formatDate(med.expiryDate) : 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Expiry Report */}
          {activeTab === 'expiry' && (
            <div className="space-y-6">
              {/* Expiring Soon */}
              <div className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden">
                <div className="p-6 border-b border-orange-200 bg-orange-50">
                  <h3 className="text-lg font-bold text-orange-900">Expiring Within 90 Days ({expiryData.expiring.length})</h3>
                </div>
                {expiryData.expiring.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">No medicines expiring soon</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-orange-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-orange-700 uppercase">Medicine</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-orange-700 uppercase">Batch</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-orange-700 uppercase">Qty</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-orange-700 uppercase">Expiry Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-orange-700 uppercase">Days Left</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orange-100">
                        {expiryData.expiring.slice(0, 20).map((item) => (
                          <tr key={item._id} className="hover:bg-orange-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{item.medicine?.medicineName}</td>
                            <td className="px-4 py-3 text-gray-600">{item.batchNumber}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{item.quantityAvailable}</td>
                            <td className="px-4 py-3 text-gray-600">{formatDate(item.expiryDate)}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                item.daysUntilExpiry <= 30 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                              }`}>
                                {item.daysUntilExpiry} days
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Expired */}
              <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
                <div className="p-6 border-b border-red-200 bg-red-50">
                  <h3 className="text-lg font-bold text-red-900">Expired Items ({expiryData.expired.length})</h3>
                </div>
                {expiryData.expired.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">No expired medicines</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-red-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">Medicine</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">Batch</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-red-700 uppercase">Qty</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">Expiry Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100">
                        {expiryData.expired.slice(0, 20).map((item) => (
                          <tr key={item._id} className="hover:bg-red-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{item.medicine?.medicineName}</td>
                            <td className="px-4 py-3 text-gray-600">{item.batchNumber}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{item.quantityAvailable}</td>
                            <td className="px-4 py-3 text-red-600">{formatDate(item.expiryDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
