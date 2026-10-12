'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';
import { Loader2, Sparkles, Trash2, AlertCircle, CheckCircle2, X, Flame } from 'lucide-react';

const emptyForm = { customerName: '', phone: '', snapUsername: '', streakDays: '30', branch: 'HQ', date: '' };

export default function StreakDiscountsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState([]);
  const [branchFilter, setBranchFilter] = useState('All');
  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  const isAdmin = user?.role === 'ADMIN';
  const canSeeAllBranches = ['ADMIN', 'CUSTOMER_CARE', 'CUSTOMER_OPS'].includes(user?.role);

  const showToast = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 6000);
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    if (!['ADMIN', 'SALES', 'CUSTOMER_CARE', 'CUSTOMER_OPS'].includes(parsedUser.role)) {
      router.push('/dashboard');
      return;
    }
    setUser(parsedUser);
    const today = new Date().toISOString().split('T')[0];
    setFormData((prev) => ({ ...prev, date: today, branch: parsedUser.branch || 'HQ' }));
  }, [router]);

  const fetchClaims = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const branchParam = canSeeAllBranches && branchFilter !== 'All' ? branchFilter : '';
      const res = await API.get(`/streak-discounts?branch=${branchParam}`);
      setClaims(res.data || []);
    } catch (err) {
      console.error('Failed to load streak discount claims:', err);
    } finally {
      setLoading(false);
    }
  }, [user, canSeeAllBranches, branchFilter]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await API.post('/streak-discounts', formData);
      showToast('success', `${formData.customerName} logged — ${formData.streakDays}-day streak discount recorded.`);
      const today = new Date().toISOString().split('T')[0];
      setFormData((prev) => ({ ...emptyForm, date: today, branch: prev.branch }));
      fetchClaims();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to log this claim');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this claim? The customer will be able to claim again immediately.')) return;
    try {
      await API.delete(`/streak-discounts/${id}`);
      showToast('success', 'Claim deleted');
      fetchClaims();
    } catch (err) {
      showToast('error', 'Failed to delete');
    }
  };

  return (
    <div className="p-6 space-y-6 relative">
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border transition-all max-w-md animate-toast-in ${
            notification.type === 'error'
              ? 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
              : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={20} />
          ) : (
            <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" size={20} />
          )}
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-auto text-gray-400 dark:text-ink-500 hover:text-gray-600 dark:hover:text-ink-300 shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Flame className="text-amber-500" size={24} /> Snapchat Streak Discount
        </h1>
        <p className="text-sm text-gray-500 dark:text-ink-400">
          A 30-day (or longer) Snapchat streak earns the customer 30% off. Record their Snapchat username and
          streak length when claimed — the same phone number is blocked from claiming again for 30 days.
        </p>
      </div>

      {/* Log claim form */}
      <div className="bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 rounded-2xl p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Customer Name</label>
            <input
              type="text"
              required
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Phone Number</label>
            <input
              type="tel"
              required
              placeholder="E.g. 0615xxxxxx"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Snapchat Username</label>
            <input
              type="text"
              required
              placeholder="E.g. miski.ali"
              value={formData.snapUsername}
              onChange={(e) => setFormData({ ...formData, snapUsername: e.target.value })}
              className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Streak (days)</label>
            <input
              type="number"
              required
              min={30}
              step={1}
              value={formData.streakDays}
              onChange={(e) => setFormData({ ...formData, streakDays: e.target.value })}
              className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {canSeeAllBranches && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Branch</label>
              <select
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                className="border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="HQ">HQ</option>
                <option value="KM5">KM5</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Date</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Log Claim
          </button>
        </form>
      </div>

      {canSeeAllBranches && (
        <div className="flex items-center gap-2">
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="border border-slate-200 dark:border-ink-600 bg-slate-50 dark:bg-ink-700 text-sm font-medium text-slate-700 dark:text-ink-200 rounded-xl p-2 focus:outline-none cursor-pointer"
          >
            <option value="All">All Branches</option>
            <option value="HQ">HQ</option>
            <option value="KM5">KM5</option>
          </select>
        </div>
      )}

      {/* Claims table */}
      <div className="bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-10 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-ink-500"><Loader2 size={28} className="animate-spin text-brand-500 dark:text-brand-400" /><span className="text-sm font-medium">Loading data...</span></div>
        ) : claims.length === 0 ? (
          <div className="p-10 text-center text-slate-400 dark:text-ink-500 text-sm flex flex-col items-center gap-2">
            <Flame size={28} className="text-slate-300 dark:text-ink-600" />
            No streak discount claims logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-ink-700/40 border-b border-gray-100 dark:border-ink-700 text-xs text-gray-500 dark:text-ink-400 uppercase tracking-wider">
                  <th className="p-4">Customer</th>
                  <th className="p-4">Snapchat</th>
                  <th className="p-4">Phone</th>
                  <th className="p-4">Streak</th>
                  {canSeeAllBranches && <th className="p-4">Branch</th>}
                  <th className="p-4">Date Claimed</th>
                  <th className="p-4">Logged By</th>
                  {isAdmin && <th className="p-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-ink-700 text-sm text-gray-700 dark:text-ink-300">
                {claims.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-ink-700/40 transition">
                    <td className="p-4 font-medium text-gray-900 dark:text-white">{c.customerName}</td>
                    <td className="p-4 text-gray-600 dark:text-ink-300">{c.snapUsername || <span className="text-slate-300 dark:text-ink-600">—</span>}</td>
                    <td className="p-4 text-gray-600 dark:text-ink-300">{c.phone}</td>
                    <td className="p-4">
                      {c.streakDays ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          <Flame size={12} /> {c.streakDays}d
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-ink-600">—</span>
                      )}
                    </td>
                    {canSeeAllBranches && <td className="p-4 text-gray-600 dark:text-ink-300">{c.branch}</td>}
                    <td className="p-4 text-gray-500 dark:text-ink-400">{c.date}</td>
                    <td className="p-4 text-gray-600 dark:text-ink-300">{c.createdByName || <span className="text-slate-300 dark:text-ink-600">—</span>}</td>
                    {isAdmin && (
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
