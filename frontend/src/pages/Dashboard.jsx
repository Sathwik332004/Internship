import React, { useState, useEffect } from 'react';
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  IndianRupee, 
  Users, 
  ShoppingCart,
  Calendar,
  ArrowUp,
  Clock
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const PAYMENT_MODE_COLORS = ['#2563eb', '#14b8a6', '#f97316', '#8b5cf6', '#64748b'];

const getResponseData = (result, fallback) => (
  result.status === 'fulfilled' ? (result.value?.data?.data ?? fallback) : fallback
);

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState({
    totalMedicines: 0,
    lowStockCount: 0,
    expiringCount: 0,
    expiredCount: 0,
    todaySales: 0,
    todayGst: 0,
    todayBills: 0,
    monthlySales: 0,
    monthlyGst: 0,
    monthlyBills: 0,
    totalSuppliers: 0,
    totalAssets: 0
  });
  const [recentBills, setRecentBills] = useState([]);
  const [lowStockMedicines, setLowStockMedicines] = useState([]);
  const [expiringItems, setExpiringItems] = useState([]);
  const [expiredItems, setExpiredItems] = useState([]);
  const [last7Days, setLast7Days] = useState([]);
  const [paymentModeData, setPaymentModeData] = useState([]);
  const [dashboardError, setDashboardError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState('todaySales');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [isAdmin]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setDashboardError('');

      const results = await Promise.allSettled([
        api.get('/inventory/stats'),
        api.get('/inventory/low-stock'),
        api.get('/medicines/alerts/expiring?days=90'),
        api.get('/medicines/alerts/expired'),
        api.get('/bills/dashboard'),
        api.get('/bills?limit=5'),
        api.get('/suppliers'),
        isAdmin ? api.get('/assets') : Promise.resolve({ data: { data: [] } })
      ]);

      const summary = getResponseData(results[0], {});
      const lowStock = getResponseData(results[1], []);
      const expiring = getResponseData(results[2], []);
      const expired = getResponseData(results[3], []);
      const billsStats = getResponseData(results[4], {});
      const recentBills = getResponseData(results[5], []);
      const suppliers = getResponseData(results[6], []);
      const assets = getResponseData(results[7], []);

      const failedRequests = results.filter(result => result.status === 'rejected');
      if (failedRequests.length > 0) {
        setDashboardError('Some dashboard sections could not be loaded, but the rest of the data is still available.');
      }

      setStats({
        totalMedicines: summary.uniqueMedicineCount || 0,
        lowStockCount: summary.lowStockCount || 0,
        expiringCount: summary.expiringCount || expiring.length,
        expiredCount: summary.expiredCount || expired.length,
        todaySales: billsStats.today?.totalSales || 0,
        todayGst: billsStats.today?.totalGst || 0,
        todayBills: billsStats.today?.totalBills || 0,
        monthlySales: billsStats.monthly?.totalSales || 0,
        monthlyGst: billsStats.monthly?.totalGst || 0,
        monthlyBills: billsStats.monthly?.totalBills || 0,
        totalSuppliers: suppliers.length,
        totalAssets: assets.length
      });

      setLowStockMedicines(lowStock.slice(0, 5));
      setExpiringItems(expiring.slice(0, 5));
      setExpiredItems(expired.slice(0, 5));
      setRecentBills(recentBills);
      setLast7Days(billsStats.last7Days || []);
      setPaymentModeData(
        (billsStats.paymentModeData || [])
          .filter(item => item?._id)
          .map(item => ({
            name: item._id,
            value: Number(item.total || 0)
          }))
      );
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setDashboardError('Dashboard data could not be loaded right now.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const chartSalesMax = Math.max(...last7Days.map(day => Number(day.sales) || 0), 0);
  const hasSalesChartData = last7Days.some(day => Number(day.sales) > 0);
  const hasPaymentModeData = paymentModeData.some(item => Number(item.value) > 0);
  const cardBaseClasses = 'bg-white rounded-xl shadow-sm border p-6 cursor-pointer hover:shadow-md transition-shadow duration-200';

  const handleCardClick = (cardKey) => {
    setActiveCard(cardKey);
    setIsDetailsModalOpen(true);
  };

  useEffect(() => {
    if (!isDetailsModalOpen) {
      return undefined;
    }

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        setIsDetailsModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscapeKey);

    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isDetailsModalOpen]);

  const quickViewMeta = {
    todaySales: {
      title: "Today's Sales Details",
      description: 'Latest bills recorded today.'
    },
    todayGst: {
      title: "Today's GST Details",
      description: 'Tax collected from the latest transactions.'
    },
    monthlySales: {
      title: 'Monthly Sales Snapshot',
      description: 'Recent transactions contributing to this month.'
    },
    totalMedicines: {
      title: 'Medicine Inventory Snapshot',
      description: 'Medicines that currently need stock attention.'
    },
    lowStock: {
      title: 'Low Stock Details',
      description: 'Medicines close to or below reorder level.'
    },
    expiring: {
      title: 'Expiring Soon Details',
      description: 'Inventory expiring within 90 days.'
    },
    expired: {
      title: 'Expired Inventory Details',
      description: 'Items already expired and pending disposal action.'
    },
    suppliers: {
      title: 'Supplier Summary',
      description: 'Current supplier count in the system.'
    },
    assets: {
      title: 'Asset Summary',
      description: isAdmin ? 'Tracked business assets.' : 'Assets are visible only to admins.'
    }
  };

  const renderQuickViewContent = () => {
    if (['todaySales', 'todayGst', 'monthlySales'].includes(activeCard)) {
      return recentBills.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No recent bills available</p>
      ) : (
        <div className="space-y-3">
          {recentBills.slice(0, 5).map((bill) => (
            <div key={bill._id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div>
                <p className="font-medium text-gray-900">{bill.invoiceNumber}</p>
                <p className="text-sm text-gray-600">{bill.customerName || 'Walk-in Customer'}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900">{formatCurrency(bill.netGrandTotal ?? bill.grandTotal)}</p>
                <p className="text-xs text-gray-500">{new Date(bill.billDate).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (['totalMedicines', 'lowStock'].includes(activeCard)) {
      return lowStockMedicines.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No low stock medicines found</p>
      ) : (
        <div className="space-y-3">
          {lowStockMedicines.slice(0, 5).map((item) => (
            <div key={item.medicine?._id || item._id} className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-4 py-3">
              <div>
                <p className="font-medium text-gray-900">{item.medicine?.medicineName || item.medicineName}</p>
                <p className="text-sm text-gray-600">{item.medicine?.brandName || item.brandName || 'No brand'}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-red-600">{item.currentStock ?? item.quantity ?? item.stock ?? 0}</p>
                <p className="text-xs text-gray-500">Reorder at {item.reorderLevel || 0}</p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeCard === 'expiring') {
      return expiringItems.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No expiring items available</p>
      ) : (
        <div className="space-y-3">
          {expiringItems.slice(0, 5).map((item) => (
            <div key={item._id} className="flex items-center justify-between rounded-lg border border-orange-100 bg-orange-50 px-4 py-3">
              <div>
                <p className="font-medium text-gray-900">{item.medicine?.medicineName}</p>
                <p className="text-sm text-gray-600">Batch: {item.batchNumber}</p>
              </div>
              <div className="text-right">
                <p className={`font-bold ${item.daysUntilExpiry <= 30 ? 'text-red-600' : 'text-orange-600'}`}>
                  {item.daysUntilExpiry} days
                </p>
                <p className="text-xs text-gray-500">{new Date(item.expiryDate).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeCard === 'expired') {
      return expiredItems.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No expired items available</p>
      ) : (
        <div className="space-y-3">
          {expiredItems.slice(0, 5).map((item) => (
            <div key={item._id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div>
                <p className="font-medium text-gray-900">{item.medicine?.medicineName}</p>
                <p className="text-sm text-gray-600">Batch: {item.batchNumber}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-700">Expired</p>
                <p className="text-xs text-gray-500">{new Date(item.expiryDate).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeCard === 'suppliers') {
      return (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-5">
          <p className="text-sm text-amber-700">Total registered suppliers</p>
          <p className="mt-1 text-2xl font-bold text-amber-800">{stats.totalSuppliers}</p>
        </div>
      );
    }

    if (activeCard === 'assets') {
      return (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-5">
          <p className="text-sm text-amber-700">Total tracked assets</p>
          <p className="mt-1 text-2xl font-bold text-amber-800">
            {isAdmin ? stats.totalAssets : 'Restricted'}
          </p>
          {!isAdmin ? (
            <p className="mt-2 text-xs text-gray-600">Ask an admin account to view full asset details.</p>
          ) : null}
        </div>
      );
    }

    return <p className="text-gray-500 text-center py-4">Select a card to view details.</p>;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Bhagya Medicals Dashboard</h1>
      </div>

      {dashboardError ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {dashboardError}
        </div>
      ) : null}

      {/* Stats Grid - Today's Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Today's Sales */}
        <div
          onClick={() => handleCardClick('todaySales')}
          className={`${cardBaseClasses} border-gray-200`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Sales</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.todaySales)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <IndianRupee className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-green-600 flex items-center gap-1">
              <ArrowUp size={16} />
              {stats.todayBills} bills
            </span>
            <span className="text-gray-500 ml-2">today</span>
          </div>
        </div>

        {/* Today's GST */}
        <div
          onClick={() => handleCardClick('todayGst')}
          className={`${cardBaseClasses} border-gray-200`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's GST Collected</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(stats.todayGst)}</p>
            </div>
            <div className="p-3 bg-amber-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-500">CGST + SGST / IGST</span>
          </div>
        </div>

        {/* Monthly Sales */}
        <div
          onClick={() => handleCardClick('monthlySales')}
          className={`${cardBaseClasses} border-gray-200`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.monthlySales)}</p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Calendar className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-emerald-600 flex items-center gap-1">
              {stats.monthlyBills} bills
            </span>
            <span className="text-gray-500 ml-2">this month</span>
          </div>
        </div>

        {/* Total Medicines */}
        <div
          onClick={() => handleCardClick('totalMedicines')}
          className={`${cardBaseClasses} border-gray-200`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Medicines</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalMedicines}</p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Package className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-500">In inventory</span>
          </div>
        </div>
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Low Stock Alert */}
        <div
          onClick={() => handleCardClick('lowStock')}
          className={`${cardBaseClasses} border-red-200`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Low Stock Alert</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.lowStockCount}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-red-600">Need reordering</span>
          </div>
        </div>

        {/* Expiring Soon (90 days) */}
        <div
          onClick={() => handleCardClick('expiring')}
          className={`${cardBaseClasses} border-orange-200`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Expiring Soon</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{stats.expiringCount}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-orange-600">Within 90 days</span>
          </div>
        </div>

        {/* Expired */}
        <div
          onClick={() => handleCardClick('expired')}
          className={`${cardBaseClasses} border-gray-200`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Expired Items</p>
              <p className="text-2xl font-bold text-gray-600 mt-1">{stats.expiredCount}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-gray-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-500">Need to dispose</span>
          </div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div
          onClick={() => handleCardClick('suppliers')}
          className={`${cardBaseClasses} border-gray-200`}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Users className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Suppliers</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalSuppliers}</p>
            </div>
          </div>
        </div>

        <div
          onClick={() => handleCardClick('assets')}
          className={`${cardBaseClasses} border-gray-200 ${isAdmin ? '' : 'cursor-not-allowed opacity-80'}`}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Assets</p>
              <p className="text-xl font-bold text-gray-900">{isAdmin ? stats.totalAssets : 'Restricted'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Bills */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Recent Bills</h2>
            <p className="text-sm text-gray-600 mt-1">Latest transactions</p>
          </div>
          <div className="p-6">
            {recentBills.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent bills</p>
            ) : (
              <div className="space-y-4">
                {recentBills.map((bill) => (
                  <div key={bill._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{bill.invoiceNumber}</p>
                      <p className="text-sm text-gray-600">{bill.customerName || 'Walk-in Customer'}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(bill.billDate).toLocaleDateString()}
                      </p>
                      {Number(bill.returnTotal || 0) > 0 && (
                        <p className="text-xs text-amber-600">
                          Return: {formatCurrency(bill.returnTotal)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{formatCurrency(bill.netGrandTotal ?? bill.grandTotal)}</p>
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                        bill.paymentMode === 'CASH' ? 'bg-green-100 text-green-800' :
                        bill.paymentMode === 'UPI' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {bill.paymentMode}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Expiring Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Expiring Soon</h2>
            <p className="text-sm text-gray-600 mt-1">Items expiring within 90 days</p>
          </div>
          <div className="p-6">
            {expiringItems.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No items expiring soon</p>
            ) : (
              <div className="space-y-4">
                {expiringItems.map((item) => (
                  <div key={item._id} className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-100">
                    <div>
                      <p className="font-medium text-gray-900">{item.medicine?.medicineName}</p>
                      <p className="text-sm text-gray-600">Batch: {item.batchNumber}</p>
                      <p className="text-xs text-gray-500">
                        Qty: {item.quantityAvailable} | MRP: {formatCurrency(item.mrp || 0)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${item.daysUntilExpiry <= 30 ? 'text-red-600' : 'text-orange-600'}`}>
                        {item.daysUntilExpiry} days
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(item.expiryDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Last 7 Days Sales</h2>
          {hasSalesChartData ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7Days}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" />
                  <YAxis tickFormatter={(value) => `Rs ${value}`} domain={[0, chartSalesMax || 1]} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
                  <Bar dataKey="sales" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-72 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
              No sales recorded in the last 7 days.
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Today by Payment Mode</h2>
          {hasPaymentModeData ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentModeData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {paymentModeData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={PAYMENT_MODE_COLORS[index % PAYMENT_MODE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-72 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
              No payment data available for today.
            </div>
          )}

          {hasPaymentModeData ? (
            <div className="mt-4 space-y-2">
              {paymentModeData.map((entry, index) => (
                <div key={entry.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: PAYMENT_MODE_COLORS[index % PAYMENT_MODE_COLORS.length] }}
                    />
                    <span>{entry.name}</span>
                  </div>
                  <span className="font-medium text-gray-900">{formatCurrency(entry.value)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Low Stock Medicines</h2>
            <p className="text-sm text-gray-600 mt-1">Items closest to reorder level</p>
          </div>
          <div className="p-6">
            {lowStockMedicines.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No low stock items</p>
            ) : (
              <div className="space-y-4">
                {lowStockMedicines.map((item) => (
                  <div key={item.medicine?._id || item._id} className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-100">
                    <div>
                      <p className="font-medium text-gray-900">{item.medicine?.medicineName || item.medicineName}</p>
                      <p className="text-sm text-gray-600">{item.medicine?.brandName || item.brandName || 'No brand'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">{item.currentStock ?? item.quantity ?? item.stock ?? 0}</p>
                      <p className="text-xs text-gray-500">Reorder at {item.reorderLevel || 0}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isDetailsModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
          onClick={() => setIsDetailsModalOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-xl border border-gray-200 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-gray-200 p-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{quickViewMeta[activeCard]?.title}</h2>
                <p className="mt-1 text-sm text-gray-600">{quickViewMeta[activeCard]?.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-6">
              {renderQuickViewContent()}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
