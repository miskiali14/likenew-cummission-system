'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';
import { UserPlus, Trash2, Edit2, Building, AlertCircle, CheckCircle2, X, Shield } from 'lucide-react';

const emptyForm = { name: '', branch: 'HQ', role: 'SALES' };

export default function RegistrarsPage() {
  const router = useRouter();
  const [registrars, setRegistrars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [notification, setNotification] = useState(null);

  const [formData, setFormData] = useState(emptyForm);

  const showToast = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }

    fetchRegistrars();
  }, [router]);

  const fetchRegistrars = async () => {
    try {
      const res = await API.get('/registrars');
      setRegistrars(res.data || []);
    } catch (err) {
      if (err.response?.status === 403) {
        showToast('error', 'You do not have access to this page!');
        setTimeout(() => router.push('/dashboard'), 1500);
      } else {
        showToast('error', 'Failed to load registrar data');
      }
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (reg) => {
    setEditingId(reg.id);
    setFormData({ name: reg.name, branch: reg.branch, role: reg.role });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await API.patch(`/registrars/${editingId}`, formData);
        showToast('success', 'Updated successfully!');
      } else {
        await API.post('/registrars', formData);
        showToast('success', 'New person added successfully!');
      }
      setShowModal(false);
      setEditingId(null);
      setFormData(emptyForm);
      fetchRegistrars();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'An error occurred while saving');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this person?')) return;
    try {
      await API.delete(`/registrars/${id}`);
      showToast('success', 'Deleted successfully');
      fetchRegistrars();
    } catch (err) {
      showToast('error', 'Failed to delete');
    }
  };

  return (
    <div className="p-6 space-y-6 relative">
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border transition-all ${
            notification.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="text-red-600" size={20} />
          ) : (
            <CheckCircle2 className="text-emerald-600" size={20} />
          )}
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Assigned By List</h1>
          <p className="text-sm text-gray-500">
            Names of Sales/QC staff who register logs — these appear in the "Assigned By" dropdown
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm"
        >
          <UserPlus size={18} /> Add Person
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading data...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                <th className="p-4">Name</th>
                <th className="p-4">Branch</th>
                <th className="p-4">Role</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {registrars.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-gray-400 text-sm">
                    No one added yet.
                  </td>
                </tr>
              ) : (
                registrars.map((reg) => (
                  <tr key={reg.id} className="hover:bg-gray-50/50 transition">
                    <td className="p-4 font-medium text-gray-900">{reg.name}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 text-gray-600">
                        <Building size={14} /> {reg.branch}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          reg.role === 'QUALITY_CONTROL' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        <Shield size={12} /> {reg.role}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(reg)}
                          className="text-slate-400 hover:text-brand-600 p-1.5 rounded-lg hover:bg-brand-50 transition"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(reg.id)}
                          className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-800">{editingId ? 'Edit Person' : 'Add New Person'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Branch</label>
                  <select
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="HQ">HQ</option>
                    <option value="KM5">KM5</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="SALES">SALES</option>
                    <option value="QUALITY_CONTROL">QUALITY CONTROL</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingId(null); }}
                  className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
