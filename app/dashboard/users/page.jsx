'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';
import { Loader2, UserPlus, Trash2, Shield, Building, AlertCircle, CheckCircle2, X, KeyRound } from 'lucide-react';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [notification, setNotification] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'SALES',
    branch: 'HQ',
    department: '',
  });

  const showToast = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
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

    fetchUsers();
  }, [router]);

  const fetchUsers = async () => {
    try {
      const res = await API.get('/users');
      setUsers(res.data);
    } catch (err) {
      if (err.response?.status === 403) {
        showToast('error', 'You do not have access to this page!');
        setTimeout(() => router.push('/dashboard'), 1500);
      } else {
        showToast('error', 'Failed to load user data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post('/users', formData);
      setShowModal(false);
      setFormData({ name: '', email: '', password: '', role: 'SALES', branch: 'HQ', department: '' });
      showToast('success', 'New user created successfully!');
      fetchUsers();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'An error occurred while saving the user');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      await API.patch(`/users/${passwordTarget.id}`, { password: newPassword });
      showToast('success', `Password updated for ${passwordTarget.fullName}`);
      setPasswordTarget(null);
      setNewPassword('');
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to update password');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await API.delete(`/users/${id}`);
      showToast('success', 'User deleted successfully');
      fetchUsers();
    } catch (err) {
      showToast('error', 'Failed to delete user');
    }
  };

  return (
    <div className="p-6 space-y-6 relative">
      {/* Dynamic Browser UI Notification Banner */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border transition-all animate-toast-in ${
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
          <button
            onClick={() => setNotification(null)}
            className="ml-2 text-gray-400 dark:text-ink-500 hover:text-gray-600 dark:hover:text-ink-300"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">System Users Management</h1>
          <p className="text-sm text-gray-500 dark:text-ink-400">Add, view, or remove accounts that access the system</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm"
        >
          <UserPlus size={18} /> Add New User
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
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Branch</th>
                <th className="p-4">Department</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-ink-700 text-sm text-gray-700 dark:text-ink-300">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-ink-700/40 transition">
                  <td className="p-4 font-medium text-gray-900 dark:text-white">{u.fullName}</td>
                  <td className="p-4 text-gray-500 dark:text-ink-400">{u.email}</td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        u.role === 'ADMIN' ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      }`}
                    >
                      <Shield size={12} /> {u.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 text-gray-600 dark:text-ink-300">
                      <Building size={14} /> {u.branch || '—'}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 dark:text-ink-400">
                    {u.role === 'VIEWER' ? (u.department || 'Both') : '—'}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setPasswordTarget(u); setNewPassword(''); }}
                        className="text-slate-400 dark:text-ink-500 hover:text-brand-600 dark:hover:text-brand-400 p-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/30 transition"
                        title="Change Password"
                      >
                        <KeyRound size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition"
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
        )}
      </div>

      {/* Modal - Create User */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-white dark:bg-ink-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Add New User</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="SALES">SALES</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="QUALITY_CONTROL">QUALITY CONTROL</option>
                    <option value="CUSTOMER_CARE">CUSTOMER CARE</option>
                    <option value="CALL_CENTER">CALL CENTER</option>
                    <option value="VIEWER">VIEWER (read-only)</option>
                  </select>
                </div>

                {formData.role !== 'ADMIN' && (
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
                )}
              </div>

              {formData.role === 'VIEWER' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Department Access</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Both (Washing &amp; Ironing)</option>
                    <option value="WASHING">Washing only</option>
                    <option value="IRONING">Ironing only</option>
                  </select>
                </div>
              )}

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
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Change Password */}
      {passwordTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-white dark:bg-ink-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Change Password</h2>
            <p className="text-sm text-gray-500 dark:text-ink-400">
              Setting a new password for <span className="font-semibold text-gray-700 dark:text-ink-200">{passwordTarget.fullName}</span> ({passwordTarget.email})
            </p>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">New Password</label>
                <input
                  type="text"
                  required
                  minLength={6}
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordTarget(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-ink-600 rounded-lg text-sm font-medium text-gray-600 dark:text-ink-300 hover:bg-gray-50 dark:hover:bg-ink-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
