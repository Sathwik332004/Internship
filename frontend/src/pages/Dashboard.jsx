import React, { useState, useEffect } from 'react';
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  Users, 
  ShoppingCart,
  Calendar,
  ArrowUp,
  ArrowDown,
  Clock
} from 'lucide-react';
import api from '../services/api';

export default function Dashboard() {
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
  const [last7Days, setLast7Days] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch dashboard summary from medicines
      const summaryRes = await api.get('/medicines/dashboard/summary');
      const summary = summaryRes.data.data || {};
      
      // Fetch low stock medicines
      const lowStockRes = await api.get('/medicines/alerts/low-stock');
      const lowStock = lowStockRes.data.data || [];
      
      // Fetch expiring medicines (within 90 days)
      const expiringRes = await api.get('/medicines/alerts/expiring?days=90');
      const expiring = expiringRes.data.data || [];
      
      // Fetch expired medicines
      const expiredRes = await api.get('/medicines/alerts/expired');
      const expired = expiredRes.data.data || [];
      
      // Fetch bills dashboard stats
      const billsRes = await api.get('/bills/dashboard');
      const billsStats = billsRes.data.data || {};
      
      // Fetch recent bills
      const recentBillsRes = await api.get('/bills?limit=5');
      const recentBills = recentBillsRes.data.data || [];
      
      // Fetch suppliers
      const suppliersRes = await api.get('/suppliers');
      const suppliers = suppliersRes.data.data || [];
      
      // Fetch assets
      const assetsRes = await api.get('/assets');
      const assets = assetsRes.data.data || [];

      setStats({
        totalMedicines: summary.totalMedicines || 0,
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
      setRecentBills(recentBills);
      setLast7Days(billsStats.last7Days || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back! Here's what's happening in your store.</p>
      </div>

      {/* Stats Grid - Today's Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Today's Sales */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Sales</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.todaySales)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's GST Collected</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{formatCurrency(stats.todayGst)}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-500">CGST + SGST / IGST</span>
          </div>
        </div>

        {/* Monthly Sales */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.monthlySales)}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-blue-600 flex items-center gap-1">
              {stats.monthlyBills} bills
            </span>
            <span className="text-gray-500 ml-2">this month</span>
          </div>
        </div>

        {/* Total Medicines */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Medicines</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalMedicines}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
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
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
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
        <div className="bg-white rounded-xl shadow-sm border border-orange-200 p-6">
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Suppliers</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalSuppliers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Assets</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalAssets}</p>
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
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{formatCurrency(bill.grandTotal)}</p>
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                        bill.paymentMode === 'CASH' ? 'bg-green-100 text-green-800' :
                        bill.paymentMode === 'UPI' ? 'bg-blue-100 text-blue-800' :
                        'bg-purple-100 text-purple-800'
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
                        Qty: {item.quantityAvailable} | MRP: {item.sellingPrice}
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

      {/* Last 7 Days Sales Chart */}
      <div className="mt-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Last 7 Days Sales</h2>
          <div className="flex items-end justify-between h-48 gap-2">
            {last7Days.map((day, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-blue-500 rounded-t"
                  style={{ 
                    height: `${Math.max(5, (day.sales / (Math.max(...last7Days.map(d => d.sales)) || 1)) * 100)}%`,
                    minHeight: '4px'
                  }}
                />
                <p className="text-xs text-gray-500 mt-2">{day.day}</p>
                <p className="text-xs font-medium text-gray-700">{formatCurrency(day.sales)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
