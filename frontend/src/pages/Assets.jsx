import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, X, ChevronLeft, ChevronRight, Monitor, Car, Sofa, Wrench, Package, AlertTriangle } from 'lucide-react';
import api from '../services/api';

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formData, setFormData] = useState({
    assetName: '',
    assetType: 'OTHER',
    purchaseDate: '',
    cost: '',
    condition: 'NEW',
    location: '',
    status: 'IN_USE',
    description: ''
  });

  const itemsPerPage = 10;

  const assetTypes = [
    { value: 'FURNITURE', label: 'Furniture', icon: Sofa },
    { value: 'ELECTRONICS', label: 'Electronics', icon: Monitor },
    { value: 'VEHICLE', label: 'Vehicle', icon: Car },
    { value: 'MACHINERY', label: 'Machinery', icon: Wrench },
    { value: 'OTHER', label: 'Other', icon: Package }
  ];

  const conditions = ['NEW', 'GOOD', 'FAIR', 'POOR'];
  const statuses = ['IN_USE', 'UNDER_REPAIR', 'SCRAP', 'DISPOSED'];

  useEffect(() => {
    fetchAssets();
  }, [currentPage, searchTerm, filterType, filterStatus]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      let url = `/assets?page=${currentPage}&limit=${itemsPerPage}&search=${searchTerm}`;
      if (filterType) url += `&type=${filterType}`;
      if (filterStatus) url += `&status=${filterStatus}`;
      
      const response = await api.get(url);
      setAssets(response.data.data || []);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (error) {
      console.error('Error fetching assets:', error);
      // Use sample data if API fails
      setAssets([
        { _id: '1', assetName: 'Refrigerator - Main Storage', assetType: 'ELECTRONICS', purchaseDate: '2024-06-15', cost: 45000, condition: 'NEW', location: 'Main Storage Room', status: 'IN_USE', description: 'Double door refrigerator' },
        { _id: '2', assetName: 'Computer System - Billing', assetType: 'ELECTRONICS', purchaseDate: '2024-03-20', cost: 55000, condition: 'NEW', location: 'Billing Counter', status: 'IN_USE', description: 'Desktop computer' },
        { _id: '3', assetName: 'Delivery Scooter', assetType: 'VEHICLE', purchaseDate: '2023-11-05', cost: 75000, condition: 'GOOD', location: 'Parking Area', status: 'IN_USE', description: 'Honda Activa' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingAsset) {
        await api.put(`/assets/${editingAsset._id}`, formData);
      } else {
        await api.post('/assets', formData);
      }
      setShowModal(false);
      setEditingAsset(null);
      resetForm();
      fetchAssets();
    } catch (error) {
      console.error('Error saving asset:', error);
      alert('Error saving asset. Please try again.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/assets/${id}`);
      setDeleteConfirm(null);
      fetchAssets();
    } catch (error) {
      console.error('Error deleting asset:', error);
      alert('Error deleting asset. Please try again.');
    }
  };

  const handleEdit = (asset) => {
    setEditingAsset(asset);
    setFormData({
      assetName: asset.assetName || '',
      assetType: asset.assetType || 'OTHER',
      purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '',
      cost: asset.cost || '',
      condition: asset.condition || 'NEW',
      location: asset.location || '',
      status: asset.status || 'IN_USE',
      description: asset.description || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      assetName: '',
      assetType: 'OTHER',
      purchaseDate: '',
      cost: '',
      condition: 'NEW',
      location: '',
      status: 'IN_USE',
      description: ''
    });
  };

  const openAddModal = () => {
    setEditingAsset(null);
    resetForm();
    setShowModal(true);
  };

  const getAssetTypeIcon = (type) => {
    const assetType = assetTypes.find(t => t.value === type);
    const Icon = assetType?.icon || Package;
    return <Icon size={20} />;
  };

  const getAssetTypeColor = (type) => {
    switch (type) {
      case 'ELECTRONICS': return 'bg-blue-100 text-blue-800';
      case 'FURNITURE': return 'bg-amber-100 text-amber-800';
      case 'VEHICLE': return 'bg-green-100 text-green-800';
      case 'MACHINERY': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConditionColor = (condition) => {
    switch (condition) {
      case 'NEW': return 'bg-green-100 text-green-800';
      case 'GOOD': return 'bg-blue-100 text-blue-800';
      case 'FAIR': return 'bg-yellow-100 text-yellow-800';
      case 'POOR': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'IN_USE': return 'bg-green-100 text-green-800';
      case 'UNDER_REPAIR': return 'bg-yellow-100 text-yellow-800';
      case 'SCRAP': return 'bg-red-100 text-red-800';
      case 'DISPOSED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalAssetValue = assets.reduce((sum, a) => sum + (a.cost || 0), 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assets</h1>
          <p className="text-gray-600 mt-1">Manage store assets and equipment</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Add Asset
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            {assetTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            {statuses.map(status => (
              <option key={status} value={status}>{status.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Assets</p>
              <p className="text-2xl font-bold text-gray-900">{assets.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Monitor className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">In Use</p>
              <p className="text-2xl font-bold text-gray-900">
                {assets.filter(a => a.status === 'IN_USE').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Wrench className="text-yellow-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Under Repair</p>
              <p className="text-2xl font-bold text-gray-900">
                {assets.filter(a => a.status === 'UNDER_REPAIR').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <AlertTriangle className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">₹{totalAssetValue.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading assets...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Condition</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {assets.map((asset) => (
                    <tr key={asset._id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            {getAssetTypeIcon(asset.assetType)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{asset.assetName}</div>
                            <div className="text-sm text-gray-500">{asset.location}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getAssetTypeColor(asset.assetType)}`}>
                          {asset.assetType}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900">
                          {new Date(asset.purchaseDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          ₹{asset.cost?.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getConditionColor(asset.condition)}`}>
                          {asset.condition}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(asset.status)}`}>
                          {asset.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(asset)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(asset)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {assets.length} results
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingAsset ? 'Edit Asset' : 'Add New Asset'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asset Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.assetName}
                    onChange={(e) => setFormData({ ...formData, assetName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asset Type *</label>
                  <select
                    required
                    value={formData.assetType}
                    onChange={(e) => setFormData({ ...formData, assetType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {assetTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition *</label>
                  <select
                    required
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {conditions.map(condition => (
                      <option key={condition} value={condition}>{condition}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {statuses.map(status => (
                      <option key={status} value={status}>{status.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingAsset ? 'Update Asset' : 'Add Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Confirm Delete</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete asset <strong>{deleteConfirm.assetName}</strong>? This action cannot be undone.
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
    </div>
  );
}
