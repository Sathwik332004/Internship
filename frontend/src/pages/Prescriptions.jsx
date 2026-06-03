import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  Eye,
  Link as LinkIcon,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react';
import { toast } from 'react-toastify';
import { prescriptionAPI } from '../services/api';

const emptyMedicine = {
  medicineName: '',
  dosage: '',
  duration: '',
  quantity: 1
};

const emptyForm = {
  patientName: '',
  patientPhone: '',
  doctorName: '',
  doctorLicense: '',
  medicines: [{ ...emptyMedicine }],
  notes: ''
};

const statusClasses = {
  PENDING: 'bg-amber-100 text-amber-800 ring-amber-200',
  DISPENSED: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  PARTIAL: 'bg-blue-100 text-blue-800 ring-blue-200'
};

const formatDate = (dateValue) => new Date(dateValue).toLocaleDateString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

export default function Prescriptions() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [linkPrescription, setLinkPrescription] = useState(null);
  const [billNumber, setBillNumber] = useState('');
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPrescriptions();
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const response = await prescriptionAPI.getAll({
        search: searchTerm,
        limit: 100
      });
      setPrescriptions(response.data.data || []);
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
      toast.error('Unable to load prescriptions');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      ...emptyForm,
      medicines: [{ ...emptyMedicine }]
    });
  };

  const openForm = () => {
    resetForm();
    setShowForm(true);
  };

  const updateMedicineRow = (index, field, value) => {
    setFormData((current) => ({
      ...current,
      medicines: current.medicines.map((medicine, medicineIndex) => (
        medicineIndex === index
          ? { ...medicine, [field]: field === 'quantity' ? Math.max(Number(value) || 1, 1) : value }
          : medicine
      ))
    }));
  };

  const addMedicineRow = () => {
    setFormData((current) => ({
      ...current,
      medicines: [...current.medicines, { ...emptyMedicine }]
    }));
  };

  const removeMedicineRow = (index) => {
    setFormData((current) => ({
      ...current,
      medicines: current.medicines.length === 1
        ? current.medicines
        : current.medicines.filter((_, medicineIndex) => medicineIndex !== index)
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const medicines = formData.medicines.filter((medicine) => medicine.medicineName.trim());
    if (!formData.patientName.trim() || !formData.doctorName.trim()) {
      toast.error('Patient name and doctor name are required');
      return;
    }

    if (medicines.length === 0) {
      toast.error('Add at least one medicine');
      return;
    }

    try {
      setSaving(true);
      await prescriptionAPI.create({
        ...formData,
        medicines
      });
      toast.success('Prescription created');
      setShowForm(false);
      resetForm();
      fetchPrescriptions();
    } catch (error) {
      console.error('Error creating prescription:', error);
      toast.error(error.response?.data?.message || 'Unable to create prescription');
    } finally {
      setSaving(false);
    }
  };

  const handleLinkBill = async () => {
    if (!linkPrescription || !billNumber.trim()) {
      toast.error('Enter a bill number');
      return;
    }

    try {
      setLinking(true);
      const response = await prescriptionAPI.linkBill(linkPrescription._id, {
        billNumber: billNumber.trim()
      });
      toast.success('Prescription linked to bill');
      setPrescriptions((current) => current.map((prescription) => (
        prescription._id === linkPrescription._id ? response.data.data : prescription
      )));
      setLinkPrescription(null);
      setBillNumber('');
    } catch (error) {
      console.error('Error linking bill:', error);
      toast.error(error.response?.data?.message || 'Unable to link bill');
    } finally {
      setLinking(false);
    }
  };

  const handleDelete = async (prescription) => {
    const confirmed = window.confirm(`Delete prescription ${prescription.prescriptionNumber}?`);
    if (!confirmed) {
      return;
    }

    try {
      await prescriptionAPI.delete(prescription._id);
      setPrescriptions((current) => current.filter((item) => item._id !== prescription._id));
      toast.success('Prescription deleted');
    } catch (error) {
      console.error('Error deleting prescription:', error);
      toast.error('Unable to delete prescription');
    }
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.34em] text-slate-500">Clinical workflow</p>
          <h1 className="text-3xl font-semibold text-slate-900">Prescriptions</h1>
          <p className="mt-2 text-sm text-slate-500">Capture prescriptions, track dispensing, and link completed bills.</p>
        </div>
        <button
          type="button"
          onClick={openForm}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,185,129,0.20)] transition-colors hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          New Prescription
        </button>
      </div>

      <div className="mb-6 rounded-[24px] border border-gray-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by patient name, phone, or RX number..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-emerald-600"></div>
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <ClipboardList className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">No prescriptions found</h2>
            <p className="mt-2 text-sm text-slate-500">Create a prescription to begin tracking pending dispensing.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-gray-200 bg-slate-50">
                <tr>
                  {['Rx No', 'Patient', 'Doctor', 'Date', 'Medicines', 'Status', 'Actions'].map((heading) => (
                    <th key={heading} className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {prescriptions.map((prescription) => (
                  <tr key={prescription._id} className="transition hover:bg-slate-50/80">
                    <td className="px-5 py-4 font-semibold text-slate-900">{prescription.prescriptionNumber}</td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{prescription.patientName}</p>
                      <p className="text-xs text-slate-500">{prescription.patientPhone || '-'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{prescription.doctorName}</p>
                      <p className="text-xs text-slate-500">{prescription.doctorLicense || '-'}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{formatDate(prescription.createdAt)}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{prescription.medicines?.length || 0}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClasses[prescription.status] || statusClasses.PENDING}`}>
                        {prescription.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPrescription(prescription)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                        {prescription.status === 'PENDING' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setLinkPrescription(prescription);
                              setBillNumber('');
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          >
                            <LinkIcon className="h-4 w-4" />
                            Link to Bill
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleDelete(prescription)}
                          className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleSubmit}
            className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[28px] border border-gray-200 bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">New Prescription</h2>
                <p className="mt-1 text-sm text-slate-500">Add patient, doctor, and medicine directions.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-2xl p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  ['patientName', 'Patient Name', true],
                  ['patientPhone', 'Patient Phone', false],
                  ['doctorName', 'Doctor Name', true],
                  ['doctorLicense', 'Doctor License', false]
                ].map(([field, label, required]) => (
                  <div key={field}>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
                    <input
                      type="text"
                      required={required}
                      value={formData[field]}
                      onChange={(event) => setFormData((current) => ({ ...current, [field]: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    />
                  </div>
                ))}
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Medicines</h3>
                  <button
                    type="button"
                    onClick={addMedicineRow}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    <Plus className="h-4 w-4" />
                    Add Row
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.medicines.map((medicine, index) => (
                    <div key={`${index}-${medicine.medicineName}`} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[2fr_1fr_1fr_120px_auto]">
                      <input
                        type="text"
                        value={medicine.medicineName}
                        onChange={(event) => updateMedicineRow(index, 'medicineName', event.target.value)}
                        placeholder="Medicine name"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                      <input
                        type="text"
                        value={medicine.dosage}
                        onChange={(event) => updateMedicineRow(index, 'dosage', event.target.value)}
                        placeholder="Dosage"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                      <input
                        type="text"
                        value={medicine.duration}
                        onChange={(event) => updateMedicineRow(index, 'duration', event.target.value)}
                        placeholder="Duration"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                      <input
                        type="number"
                        min="1"
                        value={medicine.quantity}
                        onChange={(event) => updateMedicineRow(index, 'quantity', event.target.value)}
                        placeholder="Qty"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                      <button
                        type="button"
                        onClick={() => removeMedicineRow(index)}
                        disabled={formData.medicines.length === 1}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </div>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Prescription'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {selectedPrescription ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{selectedPrescription.prescriptionNumber}</h2>
                <p className="mt-1 text-sm text-slate-500">{formatDate(selectedPrescription.createdAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPrescription(null)}
                className="rounded-2xl p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Info label="Patient" value={selectedPrescription.patientName} subValue={selectedPrescription.patientPhone} />
                <Info label="Doctor" value={selectedPrescription.doctorName} subValue={selectedPrescription.doctorLicense} />
                <Info label="Status" value={selectedPrescription.status} />
                <Info label="Linked Bill" value={selectedPrescription.billId?.invoiceNumber || 'Not linked'} />
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Medicines</h3>
                <div className="space-y-3">
                  {selectedPrescription.medicines?.map((medicine, index) => (
                    <div key={`${medicine.medicineName}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="font-semibold text-slate-900">{medicine.medicineName}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Dosage: {medicine.dosage || '-'} | Duration: {medicine.duration || '-'} | Qty: {medicine.quantity || 1}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {selectedPrescription.notes ? (
                <Info label="Notes" value={selectedPrescription.notes} />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {linkPrescription ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-[28px] border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Link to Bill</h2>
                <p className="mt-1 text-sm text-slate-500">{linkPrescription.prescriptionNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setLinkPrescription(null)}
                className="rounded-2xl p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Bill / Invoice Number</label>
            <input
              type="text"
              value={billNumber}
              onChange={(event) => setBillNumber(event.target.value)}
              placeholder="Example: INV/20260527/0001"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setLinkPrescription(null)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLinkBill}
                disabled={linking}
                className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {linking ? 'Linking...' : 'Link Bill'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Info({ label, value, subValue }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 font-semibold text-slate-900">{value || '-'}</p>
      {subValue ? <p className="mt-1 text-sm text-slate-500">{subValue}</p> : null}
    </div>
  );
}
