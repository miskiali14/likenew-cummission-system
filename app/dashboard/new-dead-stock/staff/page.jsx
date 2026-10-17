'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';
import { Loader2, UserPlus, Trash2, Building, AlertCircle, CheckCircle2, X } from 'lucide-react';

export default function NewDeadStockStaffPage() {
  const router = useRouter();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [notification, setNotification] = useState(null);
  const [formData, setFormData] = useState({ name: '', branch: 'HQ' });

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
    if (!['ADMIN', 'CUSTOMER_CARE', 'CUSTOMER_OPS'].includes(parsedUser.role)) {
      router.push('/dashboard');
      return;
    }
    fetchStaff();
  }, [router]);

  const fetchStaff = async () => {
    try {
      const res = await API.get('/new-dead-stock/staff');
      setStaff(res.data || []);
    } catch (err) {
      showToast('error', 'Failed to load staff list');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setFormData({ name: '', branch: 'HQ' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post('/new-dead-stock/staff', formData);
      showToast('success', 'Name added successfully!');
      setShowModal(false);
      fetchStaff();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'An error occurred while saving');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this name from the dropdown?')) return;
    try {
      await API.delete(`/new-dead-stock/staff/${id}`);
      showToast('success', 'Removed successfully');
      fetchStaff();
    } catch (err) {
      showToast('error', 'Failed to remove');
    }
  };

  return (
    <div className="p-6 space-y-6 relative">
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border transition-all ${
            notification.type === 'error'
              ? 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
              : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="text-red-600 dark:text-red-400" size={20} />
          ) : (
            <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={20} />
          )}
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 text-gray-400 dark:text-ink-500 hover:text-gray-600 dark:hover:text-ink-300">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">New Dead Stock Staff</h1>
          <p className="text-sm text-gray-500 dark:text-ink-400">
            Names that appear in the "Logged By" / "Resolved By" dropdowns — Sales and Call Center logins are shared, so this is how an entry traces back to the real person
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm"
        >
          <UserPlus size={18} /> Add Name
        </button>
      </div>

      <div className="bg-white dark:bg-ink-800 rounded-xl shadow-sm border border-gray-100 dark:border-ink-700 overflow-hidden">
        {loading ? (
          <div className="p-10 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-ink-500"><Loader2 size={28} className="animate-spin text-brand-500 dark:text-brand-400" /><span className="text-sm font-medium">Loading data...</span></div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-ink-700/40 border-b border-gray-100 dark:border-ink-700 text-xs text-gray-500 dark:text-ink-400 uppercase tracking-wider">
                <th className="p-4">Name</th>
                <th className="p-4">Branch</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-ink-700 text-sm text-gray-700 dark:text-ink-300">
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-gray-400 dark:text-ink-500 text-sm">
                    No one added yet.
                  </td>
                </tr>
              ) : (
                staff.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-ink-700/40 transition">
                    <td className="p-4 font-medium text-gray-900 dark:text-white">{s.name}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 text-gray-600 dark:text-ink-300">
                        <Building size={14} /> {s.branch}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                        title="Remove"
                      >
                        <Trash2 size={18} />
                      </button>
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
          <div className="bg-white dark:bg-ink-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Add Name</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Branch</label>
                <select
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="HQ">HQ</option>
                  <option value="KM5">KM5</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-ink-600 rounded-lg text-sm font-medium text-gray-600 dark:text-ink-300 hover:bg-gray-50 dark:hover:bg-ink-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
