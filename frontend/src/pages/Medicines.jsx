import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, AlertTriangle, Package, X, ChevronLeft, ChevronRight, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';
import {
  normalizeTextInput,
  validateMedicineForm
} from '../utils/validation';

// Unit options for dropdown
const UNIT_OPTIONS = [
  'tablet', 'capsule', 'piece', 'ml', 'bottle', 
  'vial', 'ampoule', 'gram', 'tube', 'strip', 'box', 'carton'
];

export default function Medicines() {
  const [medicines, setMedicines] = useState([]);
  const [summary, setSummary] = useState({
    totalMedicines: 0,
    expiringCount: 0,
    expiredCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // Form contains product definition fields + unit conversion + more options
  const [formData, setFormData] = useState({
    medicineName: '',
    brandName: '',
    strength: '',
    packSize: '',
    manufacturer: '',
    barcode: '',
    gtin: '',
    defaultSellingPrice: '',
    reorderLevel: 10,
    status: 'ACTIVE',
    // Unit Conversion fields
    baseUnit: '',
    sellingUnit: '',
    conversionFactor: 1,
    allowDecimal: false,
    // More Options fields
    askDose: false,
    salt: '',
    colorType: '',
    packing: '',
    decimalAllowed: false,
    itemType: ''
  });

  // More Options toggle state
  const [moreOptions, setMoreOptions] = useState(false);

  const itemsPerPage = 10;

  useEffect(() => {
    fetchMedicines();
  }, [currentPage, searchTerm]);

  const fetchMedicines = async () => {
    try {
      setLoading(true);
      const [medicinesResponse, summaryResponse] = await Promise.all([
        api.get(`/medicines?page=${currentPage}&limit=${itemsPerPage}&search=${searchTerm}`),
        api.get('/medicines/dashboard/summary')
      ]);

      setMedicines(medicinesResponse.data.data || []);
      setTotalPages(medicinesResponse.data.totalPages || 1);
      setSummary(summaryResponse.data.data || {
        totalMedicines: 0,
        expiringCount: 0,
        expiredCount: 0
      });
    } catch (error) {
      console.error('Error fetching medicines:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateMedicineForm(formData, UNIT_OPTIONS);
    if (validationError) {
      alert(validationError);
      return;
    }

    try {
      // Prepare data - convert empty strings to null for optional fields
      // NOTE: GST fields are NOT sent - they will be handled in Purchase Entry
      const submitData = {
        medicineName: normalizeTextInput(formData.medicineName).trim(),
        brandName: normalizeTextInput(formData.brandName).trim() || null,
        strength: normalizeTextInput(formData.strength).trim() || null,
        packSize: normalizeTextInput(formData.packSize).trim() || null,
        manufacturer: normalizeTextInput(formData.manufacturer).trim() || null,
        barcode: String(formData.barcode || '').trim() || null,
        gtin: String(formData.gtin || '').trim() || null,
        defaultSellingPrice: formData.defaultSellingPrice === '' ? null : Number(formData.defaultSellingPrice),
        reorderLevel: Number(formData.reorderLevel) || 0,
        status: formData.status,
        // Unit Conversion fields
        baseUnit: formData.baseUnit || null,
        sellingUnit: formData.sellingUnit || null,
        conversionFactor: Number(formData.conversionFactor) || 1,
        allowDecimal: formData.allowDecimal || false,
        // More Options fields
        askDose: formData.askDose || false,
        salt: normalizeTextInput(formData.salt).trim() || null,
        colorType: normalizeTextInput(formData.colorType).trim() || null,
        packing: normalizeTextInput(formData.packing).trim() || null,
        decimalAllowed: formData.decimalAllowed || false,
        itemType: formData.itemType || null
      };

      if (editingMedicine) {
        await api.put(`/medicines/${editingMedicine._id}`, submitData);
      } else {
        await api.post('/medicines', submitData);
      }
      setShowModal(false);
      setEditingMedicine(null);
      resetForm();
      fetchMedicines();
    } catch (error) {
      console.error('Error saving medicine:', error);
      alert(error.response?.data?.message || 'Error saving medicine. Please try again.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/medicines/${id}`);
      setDeleteConfirm(null);
      fetchMedicines();
    } catch (error) {
      console.error('Error deleting medicine:', error);
      alert(error.response?.data?.message || 'Error deleting medicine. Please try again.');
    }
  };

  const handleEdit = (medicine) => {
    setEditingMedicine(medicine);
    setFormData({
      medicineName: medicine.medicineName || '',
      brandName: medicine.brandName || '',
      strength: medicine.strength || '',
      packSize: medicine.packSize || '',
      manufacturer: medicine.manufacturer || '',
      barcode: medicine.barcode || '',
      gtin: medicine.gtin || '',
      defaultSellingPrice: medicine.defaultSellingPrice || '',
      reorderLevel: medicine.reorderLevel || 10,
      status: medicine.status || 'ACTIVE',
      // Unit Conversion fields
      baseUnit: medicine.baseUnit || '',
      sellingUnit: medicine.sellingUnit || '',
      conversionFactor: medicine.conversionFactor || 1,
      allowDecimal: medicine.allowDecimal || false,
      // More Options fields
      askDose: medicine.askDose || false,
      salt: medicine.salt || '',
      colorType: medicine.colorType || '',
      packing: medicine.packing || '',
      decimalAllowed: medicine.decimalAllowed || false,
      itemType: medicine.itemType || ''
    });
    // Show more options if any advanced field is filled
    const hasAdvancedFields = medicine.askDose || medicine.salt || medicine.colorType || 
                              medicine.packing || medicine.decimalAllowed || medicine.itemType;
    setMoreOptions(!!hasAdvancedFields);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      medicineName: '',
      brandName: '',
      strength: '',
      packSize: '',
      manufacturer: '',
      barcode: '',
      gtin: '',
      defaultSellingPrice: '',
      reorderLevel: 10,
      status: 'ACTIVE',
      // Unit Conversion fields
      baseUnit: '',
      sellingUnit: '',
      conversionFactor: 1,
      allowDecimal: false,
      // More Options fields
      askDose: false,
      salt: '',
      colorType: '',
      packing: '',
      decimalAllowed: false,
      itemType: ''
    });
    setMoreOptions(false);
  };

  const openAddModal = () => {
    setEditingMedicine(null);
    resetForm();
    setShowModal(true);
  };

  const isExpired = (medicine) => medicine.expiryDate && new Date(medicine.expiryDate) < new Date();
  const isExpiringSoon = (medicine) => {
    if (!medicine.expiryDate) return false;
    const daysUntilExpiry = Math.ceil((new Date(medicine.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const getStockStatus = (medicine) => {
    if (isExpired(medicine)) return { label: 'Expired', class: 'bg-red-100 text-red-800' };
    if (isExpiringSoon(medicine)) return { label: 'Expiring Soon', class: 'bg-yellow-100 text-yellow-800' };
    return { label: 'OK', class: 'bg-green-100 text-green-800' };
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medicines</h1>
          <p className="text-sm text-gray-600">Manage your medicine inventory and details</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus size={20} />
          Add Medicine
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, brand, or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Package className="text-emerald-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Medicines</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalMedicines}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <AlertTriangle className="text-yellow-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Expiring Soon</p>
              <p className="text-2xl font-bold text-gray-900">{summary.expiringCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Expired</p>
              <p className="text-2xl font-bold text-gray-900">{summary.expiredCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Medicines Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading medicines...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medicine</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand & Strength</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {medicines.map((medicine) => {
                    const stockStatus = getStockStatus(medicine);
                    return (
                      <tr key={medicine._id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="font-medium text-gray-900">{medicine.medicineName}</div>
                          <div className="text-sm text-gray-500">{medicine.manufacturer}</div>
                          {medicine.barcode && <div className="text-xs text-gray-400">Barcode: {medicine.barcode}</div>}
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-900">{medicine.brandName}</div>
                          <div className="text-sm text-gray-500">{medicine.strength} - {medicine.packSize}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-medium text-gray-900">
                              Rs. {medicine.defaultSellingPrice?.toFixed(2) || medicine.latestInventoryMrp?.toFixed(2) || '0.00'}
                            </span>
                            {medicine.latestInventoryMrp && medicine.defaultSellingPrice !== medicine.latestInventoryMrp && (
                              <span className="text-xs text-gray-500 bg-gray-100 px-1 py-0.5 rounded">Inv</span>
                            )}
                          </div>
                          {medicine.latestInventoryMrp && (
                            <div className="text-xs text-gray-500 mt-0.5">Latest Inv MRP: Rs. {medicine.latestInventoryMrp.toFixed(2)}</div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {medicine.expiryDate ? (
                            <div className={`text-sm ${isExpired(medicine) ? 'text-red-600 font-medium' : isExpiringSoon(medicine) ? 'text-yellow-600' : 'text-gray-900'}`}>
                              {new Date(medicine.expiryDate).toLocaleDateString()}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-400">-</div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${medicine.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                              {medicine.status}
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${stockStatus.class}`}>
                              {stockStatus.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(medicine)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(medicine)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {medicines.length} results
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

      {/* Add/Edit Modal - Product Master Only (No Stock Fields, No GST) */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingMedicine ? 'Edit Medicine' : 'Add New Medicine'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 bg-yellow-50 border-b border-yellow-200">
              <p className="text-sm text-yellow-800">
                💊 <strong>Product Master:</strong> This form defines the product. Stock and GST are managed via the Purchase module.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              {/* Basic Information Section */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Medicine Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.medicineName}
                      maxLength={120}
                      onChange={(e) => setFormData({ ...formData, medicineName: normalizeTextInput(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name (Optional)</label>
                    <input
                      type="text"
                      value={formData.brandName}
                      maxLength={80}
                      onChange={(e) => setFormData({ ...formData, brandName: normalizeTextInput(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Strength (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g., 500mg"
                      value={formData.strength}
                      maxLength={40}
                      onChange={(e) => setFormData({ ...formData, strength: normalizeTextInput(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                 
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer (Optional)</label>
                    <input
                      type="text"
                      value={formData.manufacturer}
                      maxLength={80}
                      onChange={(e) => setFormData({ ...formData, manufacturer: normalizeTextInput(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                    <input
                      type="text"
                      value={formData.barcode}
                      inputMode="numeric"
                      maxLength={14}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value.replace(/\D/g, '').slice(0, 14) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GTIN</label>
                    <input
                      type="text"
                      value={formData.gtin}
                      inputMode="numeric"
                      maxLength={14}
                      onChange={(e) => setFormData({ ...formData, gtin: e.target.value.replace(/\D/g, '').slice(0, 14) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Unit Configuration Section */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Unit Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Base Unit</label>
                    <select
                      value={formData.baseUnit}
                      onChange={(e) => setFormData({ ...formData, baseUnit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select Base Unit</option>
                      {UNIT_OPTIONS.map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Selling Unit</label>
                    <select
                      value={formData.sellingUnit}
                      onChange={(e) => setFormData({ ...formData, sellingUnit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select Selling Unit</option>
                      {UNIT_OPTIONS.map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Conversion Factor</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.conversionFactor}
                      onChange={(e) => setFormData({ ...formData, conversionFactor: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">1 selling unit = X base units</p>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="allowDecimal"
                      checked={formData.allowDecimal}
                      onChange={(e) => setFormData({ ...formData, allowDecimal: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                    />
                    <label htmlFor="allowDecimal" className="ml-2 text-sm text-gray-700">
                      Allow Decimal Quantities
                    </label>
                  </div>
                </div>
              </div>

              {/* NOTE: HSN & GST Section has been removed */}
              {/* GST is now handled in Purchase Entry module based on HSN code */}

              {/* Pricing Section */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Pricing & Inventory</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Selling Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.defaultSellingPrice}
                      onChange={(e) => setFormData({ ...formData, defaultSellingPrice: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level (Optional)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.reorderLevel}
                      onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
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
              </div>

              {/* More Options Toggle */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => setMoreOptions(!moreOptions)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-emerald-600 transition-colors"
                >
                  <Settings size={18} />
                  More Options
                  {moreOptions ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                
                {/* More Options Fields - Show when toggle is ON */}
                {moreOptions && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="askDose"
                          checked={formData.askDose}
                          onChange={(e) => setFormData({ ...formData, askDose: e.target.checked })}
                          className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                        />
                        <label htmlFor="askDose" className="ml-2 text-sm text-gray-700">
                          Ask Dose on Billing
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="decimalAllowed"
                          checked={formData.decimalAllowed}
                          onChange={(e) => setFormData({ ...formData, decimalAllowed: e.target.checked })}
                          className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                        />
                        <label htmlFor="decimalAllowed" className="ml-2 text-sm text-gray-700">
                          Decimal Allowed
                        </label>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Salt / Composition</label>
                        <input
                          type="text"
                          value={formData.salt}
                          maxLength={120}
                          onChange={(e) => setFormData({ ...formData, salt: normalizeTextInput(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Color Type</label>
                        <input
                          type="text"
                          value={formData.colorType}
                          maxLength={40}
                          onChange={(e) => setFormData({ ...formData, colorType: normalizeTextInput(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Packing Type</label>
                        <input
                          type="text"
                          value={formData.packing}
                          maxLength={40}
                          onChange={(e) => setFormData({ ...formData, packing: normalizeTextInput(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
                        <select
                          value={formData.itemType}
                          onChange={(e) => setFormData({ ...formData, itemType: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        >
                          <option value="">Select Item Type</option>
                          <option value="Tablets">Tablets</option>
                          <option value="Capsules">Capsules</option>
                          <option value="Syrup">Syrup</option>
                          <option value="Injection">Injection</option>
                          <option value="Cream">Cream</option>
                          <option value="Ointment">Ointment</option>
                          <option value="Drops">Drops</option>
                          <option value="Inhaler">Inhaler</option>
                          <option value="Others">Others</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
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
                  {editingMedicine ? 'Update Medicine' : 'Add Medicine'}
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
              Are you sure you want to delete <strong>{deleteConfirm.medicineName}</strong>? This action cannot be undone.
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

