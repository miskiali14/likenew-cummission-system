'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';
import { Loader2, ClipboardCheck, Trash2, AlertCircle, CheckCircle2, X, MessageSquareWarning, Eye } from 'lucide-react';

const QUESTIONS = [
  { key: 'satisfaction', label: 'Q1. Overall, how satisfied are you with Likenew’s service?' },
  { key: 'qualityRating', label: 'Q2. How would you rate the quality of washing and ironing?' },
  { key: 'desiredService', label: 'Q3. What kind of service would you like Likenew to add?' },
  { key: 'suggestedChanges', label: 'Q4. Is there anything you’d want changed?' },
];

const emptyForm = {
  customerName: '', phone: '', branch: 'HQ', date: '',
  hasComplaint: false, complaintNotes: '',
  tourGiven: false, packageGiven: false,
  satisfaction: '', qualityRating: '', desiredService: '', suggestedChanges: '',
};

export default function CustomerSurveysPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState([]);
  const [branchFilter, setBranchFilter] = useState('All');
  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [viewing, setViewing] = useState(null);

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
    if (!['ADMIN', 'CUSTOMER_CARE', 'CUSTOMER_OPS'].includes(parsedUser.role)) {
      router.push('/dashboard');
      return;
    }
    setUser(parsedUser);
    const today = new Date().toISOString().split('T')[0];
    setFormData((prev) => ({ ...prev, date: today, branch: parsedUser.branch || 'HQ' }));
  }, [router]);

  const fetchSurveys = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const branchParam = canSeeAllBranches && branchFilter !== 'All' ? branchFilter : '';
      const res = await API.get(`/customer-surveys?branch=${branchParam}`);
      setSurveys(res.data || []);
    } catch (err) {
      console.error('Failed to load customer surveys:', err);
    } finally {
      setLoading(false);
    }
  }, [user, canSeeAllBranches, branchFilter]);

  useEffect(() => {
    fetchSurveys();
  }, [fetchSurveys]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await API.post('/customer-surveys', formData);
      showToast('success', `${formData.customerName} logged.`);
      const today = new Date().toISOString().split('T')[0];
      setFormData({ ...emptyForm, date: today, branch: formData.branch });
      fetchSurveys();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to log this call');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await API.delete(`/customer-surveys/${id}`);
      showToast('success', 'Entry deleted');
      fetchSurveys();
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
          <ClipboardCheck className="text-brand-500" size={24} /> Customer Loyalty Calls
        </h1>
        <p className="text-sm text-gray-500 dark:text-ink-400">
          Check-in calls to long-time customers — ask about complaints, invite them in for a tour, send them off with
          a package, and log the 4 standard questions.
        </p>
      </div>

      {/* Log call form */}
      <div className="bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 rounded-2xl p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
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
          </div>

          <div className="flex flex-wrap items-center gap-5 py-1">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-ink-200 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.tourGiven}
                onChange={(e) => setFormData({ ...formData, tourGiven: e.target.checked })}
                className="rounded border-slate-300 dark:border-ink-600 text-brand-600 focus:ring-brand-500"
              />
              Given a tour of the branch
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-ink-200 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.packageGiven}
                onChange={(e) => setFormData({ ...formData, packageGiven: e.target.checked })}
                className="rounded border-slate-300 dark:border-ink-600 text-brand-600 focus:ring-brand-500"
              />
              Sent off with a package
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-ink-200 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.hasComplaint}
                onChange={(e) => setFormData({ ...formData, hasComplaint: e.target.checked })}
                className="rounded border-slate-300 dark:border-ink-600 text-red-600 focus:ring-red-500"
              />
              Had a complaint
            </label>
          </div>

          {formData.hasComplaint && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">What was the complaint?</label>
              <textarea
                required
                rows={2}
                value={formData.complaintNotes}
                onChange={(e) => setFormData({ ...formData, complaintNotes: e.target.value })}
                className="w-full border border-red-300 dark:border-red-800 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                <MessageSquareWarning size={13} /> If this needs following up, also log it on the Complaints page.
              </p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-ink-700">
            {QUESTIONS.map((q) => (
              <div key={q.key}>
                <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">{q.label}</label>
                <textarea
                  rows={2}
                  value={formData[q.key]}
                  onChange={(e) => setFormData({ ...formData, [q.key]: e.target.value })}
                  className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
              Log Call
            </button>
          </div>
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

      {/* Calls table */}
      <div className="bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-10 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-ink-500"><Loader2 size={28} className="animate-spin text-brand-500 dark:text-brand-400" /><span className="text-sm font-medium">Loading data...</span></div>
        ) : surveys.length === 0 ? (
          <div className="p-10 text-center text-slate-400 dark:text-ink-500 text-sm flex flex-col items-center gap-2">
            <ClipboardCheck size={28} className="text-slate-300 dark:text-ink-600" />
            No loyalty calls logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-ink-700/40 border-b border-gray-100 dark:border-ink-700 text-xs text-gray-500 dark:text-ink-400 uppercase tracking-wider">
                  <th className="p-4">Customer</th>
                  <th className="p-4">Phone</th>
                  {canSeeAllBranches && <th className="p-4">Branch</th>}
                  <th className="p-4">Date</th>
                  <th className="p-4">Tour</th>
                  <th className="p-4">Package</th>
                  <th className="p-4">Complaint</th>
                  <th className="p-4">Logged By</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-ink-700 text-sm text-gray-700 dark:text-ink-300">
                {surveys.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-ink-700/40 transition">
                    <td className="p-4 font-medium text-gray-900 dark:text-white">{s.customerName}</td>
                    <td className="p-4 text-gray-600 dark:text-ink-300">{s.phone}</td>
                    {canSeeAllBranches && <td className="p-4 text-gray-600 dark:text-ink-300">{s.branch}</td>}
                    <td className="p-4 text-gray-500 dark:text-ink-400">{s.date}</td>
                    <td className="p-4">{s.tourGiven ? '✓' : <span className="text-slate-300 dark:text-ink-600">—</span>}</td>
                    <td className="p-4">{s.packageGiven ? '✓' : <span className="text-slate-300 dark:text-ink-600">—</span>}</td>
                    <td className="p-4">
                      {s.hasComplaint ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                          Yes
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-ink-600">—</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-600 dark:text-ink-300">{s.createdByName || <span className="text-slate-300 dark:text-ink-600">—</span>}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setViewing(s)}
                          className="text-slate-500 dark:text-ink-400 hover:text-brand-600 dark:hover:text-brand-400 p-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/30 transition"
                          title="View Answers"
                        >
                          <Eye size={18} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal — View Answers */}
      {viewing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-ink-800 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">{viewing.customerName}</h2>
              <button onClick={() => setViewing(null)} className="text-gray-400 dark:text-ink-500 hover:text-gray-600 dark:hover:text-ink-300">
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-ink-400">{viewing.branch} &middot; {viewing.phone} &middot; {viewing.date}</p>

            {viewing.hasComplaint && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Complaint</div>
                <div className="text-sm text-gray-700 dark:text-ink-200">{viewing.complaintNotes}</div>
              </div>
            )}

            <div className="space-y-3">
              {QUESTIONS.map((q) => (
                <div key={q.key}>
                  <div className="text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">{q.label}</div>
                  <div className="text-sm text-gray-700 dark:text-ink-200">
                    {viewing[q.key] || <span className="text-slate-300 dark:text-ink-600">No answer recorded</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewing(null)}
                className="px-4 py-2 border border-slate-300 dark:border-ink-600 rounded-lg text-sm font-medium text-gray-600 dark:text-ink-300 hover:bg-gray-50 dark:hover:bg-ink-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
