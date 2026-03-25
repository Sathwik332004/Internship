import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, AlertTriangle, Hash, X, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';
import {
  normalizeTextInput,
  validateHSNForm
} from '../utils/validation';

export default function HSNCodes() {
  const [hsnCodes, setHsnCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingHSN, setEditingHSN] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [formData, setFormData] = useState({
    hsnCode: '',
    description: '',
    gstPercent: 12,
    status: 'ACTIVE'
  });

  const itemsPerPage = 10;

  useEffect(() => {
    fetchHSNCodes();
  }, [currentPage, searchTerm]);

  const fetchHSNCodes = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/hsn?page=${currentPage}&limit=${itemsPerPage}&search=${searchTerm}`);
      setHsnCodes(response.data.data || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      console.error('Error fetching HSN codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateHSNForm(formData);
    if (validationError) {
      alert(validationError);
      return;
    }

    const payload = {
      ...formData,
      hsnCode: String(formData.hsnCode).trim(),
      description: normalizeTextInput(formData.description).trim(),
      gstPercent: Number(formData.gstPercent)
    };

    try {
      if (editingHSN) {
        await api.put(`/hsn/${editingHSN._id}`, payload);
      } else {
        await api.post('/hsn', payload);
      }
      setShowModal(false);
      setEditingHSN(null);
      resetForm();
      fetchHSNCodes();
    } catch (error) {
      console.error('Error saving HSN code:', error);
      alert(error.response?.data?.message || 'Error saving HSN code. Please try again.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/hsn/${id}`);
      setDeleteConfirm(null);
      fetchHSNCodes();
    } catch (error) {
      console.error('Error deleting HSN code:', error);
      alert(error.response?.data?.message || 'Error deleting HSN code. Please try again.');
    }
  };

  const handleEdit = (hsn) => {
    setEditingHSN(hsn);
    setFormData({
      hsnCode: hsn.hsnCode || '',
      description: hsn.description || '',
      gstPercent: hsn.gstPercent || 12,
      status: hsn.status || 'ACTIVE'
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      hsnCode: '',
      description: '',
      gstPercent: 12,
      status: 'ACTIVE'
    });
  };

  const openAddModal = () => {
    setEditingHSN(null);
    resetForm();
    setShowModal(true);
  };

  // Common HSN codes for quick reference
  const commonHSNCodes = [
    { code: '3004', desc: 'Medicaments for retail sale', rate: 12 },
    { code: '3005', desc: 'Wadding, gauze, bandages etc.', rate: 12 },
    { code: '3006', desc: 'Pharmaceutical waste', rate: 12 },
    { code: '2106', desc: 'Food supplements', rate: 18 },
    { code: '3304', desc: 'Beauty or make-up preparations', rate: 18 },
    { code: '9018', desc: 'Medical instruments', rate: 12 },
    { code: '9021', desc: 'Orthopaedic appliances', rate: 12 }
  ];

  const applyQuickCode = (code) => {
    setFormData({
      ...formData,
      hsnCode: code.code,
      description: code.desc,
      gstPercent: code.rate
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HSN Master</h1>
          <p className="text-sm text-gray-600">Manage HSN codes for GST classification</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus size={20} />
          Add HSN Code
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by HSN code or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Hash className="text-emerald-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total HSN Codes</p>
              <p className="text-2xl font-bold text-gray-900">{hsnCodes.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Hash className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Codes</p>
              <p className="text-2xl font-bold text-gray-900">
                {hsnCodes.filter(h => h.status === 'ACTIVE').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Hash className="text-orange-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">GST 12%</p>
              <p className="text-2xl font-bold text-gray-900">
                {hsnCodes.filter(h => h.gstPercent === 12).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Codes Reference */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Common HSN Codes (Click to apply)</h3>
        <div className="flex flex-wrap gap-2">
          {commonHSNCodes.map((item, index) => (
            <button
              key={index}
              onClick={() => applyQuickCode(item)}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              {item.code} ({item.rate}%)
            </button>
          ))}
        </div>
      </div>

      {/* HSN Codes Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading HSN codes...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">HSN Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">GST %</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">CGST</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">SGST</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">IGST</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {hsnCodes.map((hsn) => (
                    <tr key={hsn._id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">{hsn.hsnCode}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900">{hsn.description}</div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                          {hsn.gstPercent}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-600">
                        {hsn.cgstPercent || (hsn.gstPercent / 2)}%
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-600">
                        {hsn.sgstPercent || (hsn.gstPercent / 2)}%
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-600">
                        {hsn.igstPercent || hsn.gstPercent}%
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${hsn.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {hsn.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(hsn)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(hsn)}
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
                Showing {hsnCodes.length} results
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingHSN ? 'Edit HSN Code' : 'Add New HSN Code'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code *</label>
                  <input
                    type="text"
                    required
                    maxLength="8"
                    minLength="4"
                    value={formData.hsnCode}
                    onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value.replace(/\D/g, '') })}
                    placeholder="e.g., 3004"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">4-8 digits</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <input
                    type="text"
                    required
                    value={formData.description}
                    maxLength={150}
                    onChange={(e) => setFormData({ ...formData, description: normalizeTextInput(e.target.value) })}
                    placeholder="e.g., Medicaments for retail sale"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GST Percentage *</label>
                  <select
                    value={formData.gstPercent}
                    onChange={(e) => setFormData({ ...formData, gstPercent: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
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
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  {editingHSN ? 'Update HSN Code' : 'Add HSN Code'}
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
              Are you sure you want to delete HSN code <strong>{deleteConfirm.hsnCode}</strong>? This action cannot be undone.
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
