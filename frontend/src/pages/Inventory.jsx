import React, { useState, useEffect, useMemo } from 'react';
import { Search, Package, AlertTriangle, Clock, ChevronLeft, ChevronRight, Filter, RefreshCw, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('expiryDate');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [filterExpiringSoon, setFilterExpiringSoon] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchInventory();
    fetchStats();
  }, [currentPage, searchTerm, sortBy, sortOrder, filterLowStock, filterExpiringSoon]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: 50,
        sortBy,
        sortOrder
      });

      if (searchTerm) params.append('search', searchTerm);
      if (filterLowStock) params.append('lowStock', 'true');
      if (filterExpiringSoon) params.append('expiringSoon', 'true');

      const response = await api.get(`/inventory?${params.toString()}`);
      setInventory(response.data.data || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/inventory/stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== '' || currentPage === 1) {
        setCurrentPage(1);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Get stats with fallback values
  const safeStats = stats || {
    batchCount: 0,
    totalItems: 0,
    lowStockCount: 0,
    expiringCount: 0
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getStockStatusBadge = (item) => {
    if (item.isLowStock) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <TrendingDown size={12} />
          Low Stock
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <TrendingUp size={12} />
        In Stock
      </span>
    );
  };

  const getExpiryBadge = (item) => {
    if (item.daysUntilExpiry <= 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <AlertCircle size={12} />
          Expired
        </span>
      );
    }
    if (item.isExpiringSoon) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
          <Clock size={12} />
          Expiring Soon
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
        {item.daysUntilExpiry} days
      </span>
    );
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredInventory = useMemo(() => {
    return inventory;
  }, [inventory]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-600 mt-1">Track batch-wise medicine stock with FIFO expiry management</p>
        </div>
       
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Batches</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.batchCount || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Package className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Stock</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalItems?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Low Stock</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.lowStockCount || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Clock className="text-orange-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Expiring Soon</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.expiringCount || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by medicine name or batch number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterLowStock(!filterLowStock)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                filterLowStock 
                  ? 'bg-red-50 border-red-300 text-red-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <TrendingDown size={18} />
              Low Stock
            </button>
            <button
              onClick={() => setFilterExpiringSoon(!filterExpiringSoon)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                filterExpiringSoon 
                  ? 'bg-orange-50 border-orange-300 text-orange-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Clock size={18} />
              Expiring Soon
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading inventory...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('expiryDate')}
                    >
                      <div className="flex items-center gap-1">
                        Expiry
                        {sortBy === 'expiryDate' && (
                          <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('quantityAvailable')}
                    >
                      <div className="flex items-center gap-1">
                        Available Stock
                        {sortBy === 'quantityAvailable' && (
                          <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">MRP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredInventory.length > 0 ? (
                    filteredInventory.map((item, index) => (
                      <tr key={item._id || index} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-gray-900">{item.medicine?.medicineName || 'Unknown'}</p>
                            <p className="text-sm text-gray-500">{item.medicine?.brandName}</p>
                            {item.medicine?.sellingUnit && item.medicine?.conversionFactor && (
                              <p className="text-xs text-gray-400">
                                {item.medicine.sellingUnit} ({item.medicine.conversionFactor}s)
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {item.batchNumber || '-'}
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p className="text-sm text-gray-900">{formatDate(item.expiryDate)}</p>
                            {getExpiryBadge(item)}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {item.quantityAvailable?.toLocaleString() || 0}
                            </p>
                            {item.medicine?.baseUnit && (
                              <p className="text-xs text-gray-500">{item.medicine.baseUnit}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          ₹{item.purchasePrice?.toFixed(2) || '0.00'}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          ₹{item.mrp?.toFixed(2) || '0.00'}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {item.supplier?.supplierName || '-'}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {item.purchase?.purchaseNumber || '-'}
                        </td>
                        <td className="px-4 py-4">
                          {getStockStatusBadge(item)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                        No inventory items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">Showing {filteredInventory.length} results</div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                  disabled={currentPage === 1} 
                  className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                  disabled={currentPage === totalPages} 
                  className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

