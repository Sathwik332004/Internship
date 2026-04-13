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
  Area,
  AreaChart,
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

const PAYMENT_MODE_COLORS = ['#18c34a', '#8fdc55', '#d6f25c', '#0fa23a', '#b8e73a'];

const getResponseData = (result, fallback) => (
  result.status === 'fulfilled' ? (result.value?.data?.data ?? fallback) : fallback
);

const SalesTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) {
    return null;
  }

  const value = Number(payload[0]?.value || 0);

  return (
    <div className="min-w-[150px] rounded-[18px] border border-[#e8ecd9] bg-white px-3 py-2 shadow-[0_18px_40px_rgba(15,23,42,0.10)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[#171717]">
        {new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 2
        }).format(value)}
      </p>
    </div>
  );
};

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
      const latestBills = getResponseData(results[5], []);
      const suppliers = getResponseData(results[6], []);
      const assets = getResponseData(results[7], []);

      const failedRequests = results.filter((result) => result.status === 'rejected');
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
      setRecentBills(latestBills);
      setLast7Days(billsStats.last7Days || []);
      setPaymentModeData(
        (billsStats.paymentModeData || [])
          .filter((item) => item?._id)
          .map((item) => ({
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

  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);

  const chartSalesMax = Math.max(...last7Days.map((day) => Number(day.sales) || 0), 0);
  const hasSalesChartData = last7Days.some((day) => Number(day.sales) > 0);
  const hasPaymentModeData = paymentModeData.some((item) => Number(item.value) > 0);
  const topSalesDay = [...last7Days].sort((left, right) => Number(right.sales || 0) - Number(left.sales || 0))[0];
  const cardBaseClasses = 'group relative overflow-hidden rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_20px_48px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_58px_rgba(15,23,42,0.08)]';

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

  const primaryCards = [
    {
      key: 'todaySales',
      label: "Today's Sales",
      value: formatCurrency(stats.todaySales),
      note: `${stats.todayBills} bills today`,
      icon: IndianRupee,
      iconClass: 'bg-[#f4f9e5] text-[#18c34a]',
      accent: 'from-[#ffffff] via-[#fcfdf8] to-[#f8fbe9]'
    },
    {
      key: 'monthlySales',
      label: 'This Month',
      value: formatCurrency(stats.monthlySales),
      note: `${stats.monthlyBills} bills this month`,
      icon: Calendar,
      iconClass: 'bg-[#f4f9e5] text-[#18c34a]',
      accent: 'from-[#ffffff] via-[#fcfdf8] to-[#f8fbe9]'
    },
    {
      key: 'todayGst',
      label: "Today's GST",
      value: formatCurrency(stats.todayGst),
      note: 'CGST + SGST / IGST',
      icon: TrendingUp,
      iconClass: 'bg-[#f4f9e5] text-[#18c34a]',
      accent: 'from-[#ffffff] via-[#fbfbf7] to-[#f5f7ee]'
    },
    {
      key: 'totalMedicines',
      label: 'Total Medicines',
      value: stats.totalMedicines,
      note: 'Available in inventory',
      icon: Package,
      iconClass: 'bg-[#f4f9e5] text-[#18c34a]',
      accent: 'from-[#ffffff] via-[#fbfbf7] to-[#f5f7ee]'
    }
  ];

  const alertCards = [
    {
      key: 'lowStock',
      label: 'Low Stock Alert',
      value: stats.lowStockCount,
      note: 'Need reordering',
      icon: AlertTriangle,
      iconClass: 'bg-[#f7f7f2] text-[#171717]'
    },
    {
      key: 'expiring',
      label: 'Expiring Soon',
      value: stats.expiringCount,
      note: 'Within 90 days',
      icon: Clock,
      iconClass: 'bg-[#f4f9e5] text-[#18c34a]'
    },
    {
      key: 'expired',
      label: 'Expired Items',
      value: stats.expiredCount,
      note: 'Pending disposal',
      icon: TrendingUp,
      iconClass: 'bg-[#f7f7f2] text-[#171717]'
    }
  ];

  const renderQuickViewContent = () => {
    if (['todaySales', 'todayGst', 'monthlySales'].includes(activeCard)) {
      return recentBills.length === 0 ? (
        <p className="py-4 text-center text-gray-500">No recent bills available</p>
      ) : (
        <div className="space-y-3">
          {recentBills.slice(0, 5).map((bill) => (
            <div key={bill._id} className="flex items-center justify-between rounded-[22px] border border-[#e3eeef] bg-[#f7fbfb] px-4 py-3">
              <div>
                <p className="font-medium text-[#17373c]">{bill.invoiceNumber}</p>
                <p className="text-sm text-slate-600">{bill.customerName || 'Walk-in Customer'}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-[#17373c]">{formatCurrency(bill.netGrandTotal ?? bill.grandTotal)}</p>
                <p className="text-xs text-slate-500">{new Date(bill.billDate).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (['totalMedicines', 'lowStock'].includes(activeCard)) {
      return lowStockMedicines.length === 0 ? (
        <p className="py-4 text-center text-gray-500">No low stock medicines found</p>
      ) : (
        <div className="space-y-3">
          {lowStockMedicines.slice(0, 5).map((item) => (
            <div key={item.medicine?._id || item._id} className="flex items-center justify-between rounded-[22px] border border-[#f5d7dc] bg-[#fff0f3] px-4 py-3">
              <div>
                <p className="font-medium text-[#17373c]">{item.medicine?.medicineName || item.medicineName}</p>
                <p className="text-sm text-slate-600">{item.medicine?.brandName || item.brandName || 'No brand'}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-[#c05a67]">{item.currentStock ?? item.quantity ?? item.stock ?? 0}</p>
                <p className="text-xs text-slate-500">Reorder at {item.reorderLevel || 0}</p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeCard === 'expiring') {
      return expiringItems.length === 0 ? (
        <p className="py-4 text-center text-gray-500">No expiring items available</p>
      ) : (
        <div className="space-y-3">
          {expiringItems.slice(0, 5).map((item) => (
            <div key={item._id} className="flex items-center justify-between rounded-[22px] border border-[#f8e1bf] bg-[#fff5df] px-4 py-3">
              <div>
                <p className="font-medium text-[#17373c]">{item.medicine?.medicineName}</p>
                <p className="text-sm text-slate-600">Batch: {item.batchNumber}</p>
              </div>
              <div className="text-right">
                <p className={`font-bold ${item.daysUntilExpiry <= 30 ? 'text-[#c05a67]' : 'text-[#b8792d]'}`}>
                  {item.daysUntilExpiry} days
                </p>
                <p className="text-xs text-slate-500">{new Date(item.expiryDate).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeCard === 'expired') {
      return expiredItems.length === 0 ? (
        <p className="py-4 text-center text-gray-500">No expired items available</p>
      ) : (
        <div className="space-y-3">
          {expiredItems.slice(0, 5).map((item) => (
            <div key={item._id} className="flex items-center justify-between rounded-[22px] border border-[#e3eeef] bg-[#f7fbfb] px-4 py-3">
              <div>
                <p className="font-medium text-[#17373c]">{item.medicine?.medicineName}</p>
                <p className="text-sm text-slate-600">Batch: {item.batchNumber}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-700">Expired</p>
                <p className="text-xs text-slate-500">{new Date(item.expiryDate).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeCard === 'suppliers') {
      return (
        <div className="rounded-[22px] border border-[#f4dfb8] bg-[#fff4db] px-4 py-5">
          <p className="text-sm text-[#9f7433]">Total registered suppliers</p>
          <p className="mt-1 text-2xl font-bold text-[#17373c]">{stats.totalSuppliers}</p>
        </div>
      );
    }

    if (activeCard === 'assets') {
      return (
        <div className="rounded-[22px] border border-[#dfe8ff] bg-[#eef4ff] px-4 py-5">
          <p className="text-sm text-[#5a79ad]">Total tracked assets</p>
          <p className="mt-1 text-2xl font-bold text-[#17373c]">
            {isAdmin ? stats.totalAssets : 'Restricted'}
          </p>
          {!isAdmin ? (
            <p className="mt-2 text-xs text-slate-600">Ask an admin account to view full asset details.</p>
          ) : null}
        </div>
      );
    }

    return <p className="py-4 text-center text-gray-500">Select a card to view details.</p>;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-emerald-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 lg:p-6">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.34em] text-[#6f8c8e]">Welcome to your workspace</p>
          <h1 className="text-3xl font-semibold text-[#17373c] sm:text-4xl">Bhagya Medicals Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Sales, inventory alerts, suppliers, and billing activity in one soft dashboard view inspired by the shared reference.</p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#18c34a]" />
          Live overview
        </div>
      </div>

      {dashboardError ? (
        <div className="mb-6 rounded-[20px] border border-[#ecefdf] bg-white px-4 py-3 text-sm text-slate-700">
          {dashboardError}
        </div>
      ) : null}

      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {primaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <button
              key={card.key}
              type="button"
              onClick={() => handleCardClick(card.key)}
              className={`${cardBaseClasses} bg-gradient-to-br ${card.accent} text-left`}
            >
              <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-[#18c34a] to-[#d6f25c]" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-600">{card.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-[#171717]">{card.value}</p>
                </div>
                <div className={`rounded-[20px] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] ${card.iconClass}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
              <div className="relative mt-6 flex items-center gap-2 text-sm text-slate-600">
                <ArrowUp size={16} className="text-[#18c34a]" />
                <span>{card.note}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        {alertCards.map((card) => {
          const Icon = card.icon;

          return (
            <button
              key={card.key}
              type="button"
              onClick={() => handleCardClick(card.key)}
              className={`${cardBaseClasses} text-left`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">{card.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-[#171717]">{card.value}</p>
                  <p className="mt-2 text-sm text-slate-500">{card.note}</p>
                </div>
                <div className={`rounded-[20px] p-3 ${card.iconClass}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        <button
          type="button"
          onClick={() => handleCardClick('suppliers')}
          className={`${cardBaseClasses} text-left`}
        >
          <div className="flex items-center gap-4">
            <div className="rounded-[20px] bg-[#ffe7c4] p-3 text-[#9f7433]">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Total Suppliers</p>
              <p className="text-xl font-bold text-[#171717]">{stats.totalSuppliers}</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleCardClick('assets')}
          className={`${cardBaseClasses} text-left ${isAdmin ? '' : 'cursor-not-allowed opacity-80'}`}
        >
          <div className="flex items-center gap-4">
            <div className="rounded-[20px] bg-[#d9e8ff] p-3 text-[#5a79ad]">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Total Assets</p>
              <p className="text-xl font-bold text-[#171717]">{isAdmin ? stats.totalAssets : 'Restricted'}</p>
            </div>
          </div>
        </button>

        <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-medium text-slate-600">Monthly GST Snapshot</p>
          <p className="mt-3 text-3xl font-semibold text-[#171717]">{formatCurrency(stats.monthlyGst)}</p>
          <p className="mt-2 text-sm text-slate-500">Collected across the current month</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-[24px] border border-gray-200 bg-white shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <div className="border-b border-[#e4eff0] p-6">
            <h2 className="text-lg font-bold text-[#17373c]">Recent Bills</h2>
            <p className="mt-1 text-sm text-slate-500">Latest transactions</p>
          </div>
          <div className="p-6">
            {recentBills.length === 0 ? (
              <p className="py-4 text-center text-gray-500">No recent bills</p>
            ) : (
              <div className="space-y-4">
                {recentBills.map((bill) => (
                  <div key={bill._id} className="flex items-center justify-between rounded-[22px] border border-[#edf3f4] bg-[#f7fbfb] p-4">
                    <div>
                      <p className="font-medium text-[#17373c]">{bill.invoiceNumber}</p>
                      <p className="text-sm text-slate-600">{bill.customerName || 'Walk-in Customer'}</p>
                      <p className="text-xs text-slate-400">{new Date(bill.billDate).toLocaleDateString()}</p>
                      {Number(bill.returnTotal || 0) > 0 ? (
                        <p className="text-xs text-[#b8792d]">Return: {formatCurrency(bill.returnTotal)}</p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#17373c]">{formatCurrency(bill.netGrandTotal ?? bill.grandTotal)}</p>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                        bill.paymentMode === 'CASH' ? 'bg-[#dff4a8] text-[#29545a]' :
                        bill.paymentMode === 'UPI' ? 'bg-[#b8ebe7] text-[#29545a]' :
                        'bg-[#ffe7c4] text-[#9f7433]'
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

        <div className="rounded-[24px] border border-gray-200 bg-white shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <div className="border-b border-[#f4e5d2] p-6">
            <h2 className="text-lg font-bold text-[#17373c]">Expiring Soon</h2>
            <p className="mt-1 text-sm text-slate-500">Items expiring within 90 days</p>
          </div>
          <div className="p-6">
            {expiringItems.length === 0 ? (
              <p className="py-4 text-center text-gray-500">No items expiring soon</p>
            ) : (
              <div className="space-y-4">
                {expiringItems.map((item) => (
                  <div key={item._id} className="flex items-center justify-between rounded-[22px] border border-[#f8e1bf] bg-[#fff5df] p-4">
                    <div>
                      <p className="font-medium text-[#17373c]">{item.medicine?.medicineName}</p>
                      <p className="text-sm text-slate-600">Batch: {item.batchNumber}</p>
                      <p className="text-xs text-slate-500">Qty: {item.quantityAvailable} | MRP: {formatCurrency(item.mrp || 0)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${item.daysUntilExpiry <= 30 ? 'text-[#c05a67]' : 'text-[#b8792d]'}`}>
                        {item.daysUntilExpiry} days
                      </p>
                      <p className="text-xs text-slate-500">{new Date(item.expiryDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#17373c]">Last 7 Days Sales</h2>
              <p className="mt-1 text-sm text-slate-500">Weekly performance with highest-sales highlight</p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-[18px] border border-[#ecefdf] bg-[#fbfcf7] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Peak Day</p>
                <p className="mt-1 text-sm font-semibold text-[#171717]">{topSalesDay?.day || '-'}</p>
              </div>
              <div className="rounded-[18px] border border-[#ecefdf] bg-[#fbfcf7] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Best Sale</p>
                <p className="mt-1 text-sm font-semibold text-[#18c34a]">{formatCurrency(Number(topSalesDay?.sales || 0))}</p>
              </div>
            </div>
          </div>
          {hasSalesChartData ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={last7Days} margin={{ top: 16, right: 14, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesAreaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#24cf53" stopOpacity="0.28" />
                      <stop offset="55%" stopColor="#1ec84f" stopOpacity="0.14" />
                      <stop offset="100%" stopColor="#18c34a" stopOpacity="0.02" />
                    </linearGradient>
                    <linearGradient id="salesLineStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#7ddc46" />
                      <stop offset="100%" stopColor="#18c34a" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#eef1e6" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    stroke="#8d9387"
                    tickLine={false}
                    tick={{ fontSize: 13, fill: '#8d9387' }}
                  />
                  <YAxis
                    axisLine={false}
                    domain={[0, chartSalesMax || 1]}
                    stroke="#8d9387"
                    tickFormatter={(value) => `Rs ${value}`}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#8d9387' }}
                  />
                  <Tooltip content={<SalesTooltip />} cursor={{ stroke: '#d8e97a', strokeDasharray: '3 3' }} />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="url(#salesLineStroke)"
                    strokeWidth={4}
                    fill="url(#salesAreaFill)"
                    activeDot={{ r: 6, fill: '#18c34a', stroke: '#ffffff', strokeWidth: 3 }}
                    dot={(props) => {
                      const value = Number(props.payload?.sales || 0);
                      if (value <= 0) return <g />;
                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={4}
                          fill="#ffffff"
                          stroke="#18c34a"
                          strokeWidth={2.5}
                        />
                      );
                    }}
                    label={(props) => {
                      const value = Number(props.value || 0);
                      if (value <= 0) return null;
                      return (
                        <text
                          x={props.x}
                          y={props.y - 12}
                          fill="#7d8378"
                          fontSize={11}
                          fontWeight={600}
                          textAnchor="middle"
                        >
                          {`Rs ${value}`}
                        </text>
                      );
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-72 items-center justify-center rounded-[22px] bg-[#f7fbfb] text-sm text-slate-500">
              No sales recorded in the last 7 days.
            </div>
          )}
        </div>

        <div className="rounded-[24px] border border-gray-200 bg-white p-6 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <h2 className="mb-4 text-lg font-bold text-[#17373c]">Today by Payment Mode</h2>
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
            <div className="flex h-72 items-center justify-center rounded-[22px] bg-[#f7fbfb] text-sm text-slate-500">
              No payment data available for today.
            </div>
          )}

          {hasPaymentModeData ? (
            <div className="mt-4 space-y-2">
              {paymentModeData.map((entry, index) => (
                <div key={entry.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: PAYMENT_MODE_COLORS[index % PAYMENT_MODE_COLORS.length] }}
                    />
                    <span>{entry.name}</span>
                  </div>
                  <span className="font-medium text-[#17373c]">{formatCurrency(entry.value)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-8">
        <div className="rounded-[24px] border border-gray-200 bg-white shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
          <div className="border-b border-[#f1d8de] p-6">
            <h2 className="text-lg font-bold text-[#17373c]">Low Stock Medicines</h2>
            <p className="mt-1 text-sm text-slate-500">Items closest to reorder level</p>
          </div>
          <div className="p-6">
            {lowStockMedicines.length === 0 ? (
              <p className="py-4 text-center text-gray-500">No low stock items</p>
            ) : (
              <div className="space-y-4">
                {lowStockMedicines.map((item) => (
                  <div key={item.medicine?._id || item._id} className="flex items-center justify-between rounded-[22px] border border-[#f5d7dc] bg-[#fff0f3] p-4">
                    <div>
                      <p className="font-medium text-[#17373c]">{item.medicine?.medicineName || item.medicineName}</p>
                      <p className="text-sm text-slate-600">{item.medicine?.brandName || item.brandName || 'No brand'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#c05a67]">{item.currentStock ?? item.quantity ?? item.stock ?? 0}</p>
                      <p className="text-xs text-slate-500">Reorder at {item.reorderLevel || 0}</p>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,41,46,0.28)] px-4 backdrop-blur-sm"
          onClick={() => setIsDetailsModalOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-[30px] border border-white/70 bg-white/88 shadow-[0_30px_80px_rgba(33,74,78,0.18)] backdrop-blur-md"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#e4eff0] p-6">
              <div>
                <h2 className="text-lg font-bold text-[#17373c]">{quickViewMeta[activeCard]?.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{quickViewMeta[activeCard]?.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="rounded-full border border-[#dbe8e9] px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-[#f7fbfb]"
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
