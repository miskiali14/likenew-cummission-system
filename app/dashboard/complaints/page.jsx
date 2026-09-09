'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';
import { Search, PlusCircle, Edit2, Trash2, MessageSquareWarning, AlertCircle, CheckCircle2, CheckCheck, X } from 'lucide-react';

const CATEGORIES = [
  { value: 'DAMAGED', label: 'Damaged Item' },
  { value: 'DELAYED', label: 'Delayed Order' },
  { value: 'LOST', label: 'Lost Item' },
  { value: 'QUALITY', label: 'Quality Issue' },
  { value: 'STAFF', label: 'Staff Behavior' },
  { value: 'OTHER', label: 'Other' },
];

const STATUS_STYLE = {
  OPEN: 'bg-red-50 text-red-700 border-red-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const STATUS_LABEL = { OPEN: 'Open', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' };

const emptyForm = {
  customerName: '', phone: '', orderId: '', category: 'OTHER',
  description: '', date: '', branch: 'HQ', status: 'OPEN', resolutionNotes: '',
};

export default function ComplaintsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState([]);
  const [statusTab, setStatusTab] = useState('OPEN');
  const [branchFilter, setBranchFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [notification, setNotification] = useState(null);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolveNotes, setResolveNotes] = useState('');

  // Admin and Customer Care oversee complaints across both branches and can
  // manage/resolve them; Sales can only log a complaint for their own branch.
  const canSeeAllBranches = ['ADMIN', 'CUSTOMER_CARE'].includes(user?.role);
  const canManage = ['ADMIN', 'CUSTOMER_CARE'].includes(user?.role);

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
    if (!['ADMIN', 'SALES', 'CUSTOMER_CARE', 'CALL_CENTER'].includes(parsedUser.role)) {
      router.push('/dashboard');
      return;
    }
    setUser(parsedUser);
    const today = new Date().toISOString().split('T')[0];
    setFormData((prev) => ({ ...prev, date: today, branch: parsedUser.branch || 'HQ' }));
  }, [router]);

  const fetchComplaints = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const branchParam = canSeeAllBranches && branchFilter !== 'All' ? branchFilter : '';
      const res = await API.get(`/complaints?branch=${branchParam}&status=${statusTab}`);
      setComplaints(res.data || []);
    } catch (err) {
      console.error('Failed to load complaints:', err);
    } finally {
      setLoading(false);
    }
  }, [user, branchFilter, statusTab]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const filteredComplaints = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return complaints;
    return complaints.filter(
      (c) =>
        c.customerName.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.orderId || '').toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  }, [complaints, search]);

  const openAddModal = () => {
    setEditingId(null);
    const today = new Date().toISOString().split('T')[0];
    setFormData({ ...emptyForm, date: today, branch: user?.branch || 'HQ' });
    setShowModal(true);
  };

  const openEditModal = (c) => {
    setEditingId(c.id);
    setFormData({
      customerName: c.customerName,
      phone: c.phone || '',
      orderId: c.orderId || '',
      category: c.category,
      description: c.description,
      date: c.date,
      branch: c.branch,
      status: c.status,
      resolutionNotes: c.resolutionNotes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await API.patch(`/complaints/${editingId}`, formData);
        showToast('success', 'Complaint updated successfully!');
      } else {
        await API.post('/complaints', formData);
        showToast('success', 'Complaint logged successfully!');
      }
      setShowModal(false);
      setEditingId(null);
      fetchComplaints();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to save complaint');
    }
  };

  const openResolveModal = (c) => {
    setResolveTarget(c);
    setResolveNotes(c.resolutionNotes || '');
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!resolveTarget) return;
    try {
      await API.patch(`/complaints/${resolveTarget.id}`, {
        status: 'RESOLVED',
        resolutionNotes: resolveNotes,
      });
      showToast('success', 'Complaint marked as resolved!');
      setResolveTarget(null);
      setResolveNotes('');
      fetchComplaints();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to resolve complaint');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this complaint permanently?')) return;
    try {
      await API.delete(`/complaints/${id}`);
      showToast('success', 'Complaint deleted');
      fetchComplaints();
    } catch (err) {
      showToast('error', 'Failed to delete complaint');
    }
  };

  const categoryLabel = (val) => CATEGORIES.find((c) => c.value === val)?.label || val;

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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Complaints</h1>
          <p className="text-sm text-gray-500">Customer complaints — logged, tracked, and resolved</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm"
        >
          <PlusCircle size={18} /> Log Complaint
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center bg-slate-100 rounded-xl p-1">
          {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'All'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
                statusTab === tab ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'All' ? 'All' : STATUS_LABEL[tab]}
            </button>
          ))}
        </div>

        {canSeeAllBranches && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 rounded-xl p-2 focus:outline-none cursor-pointer"
          >
            <option value="All">All Branches</option>
            <option value="HQ">HQ</option>
            <option value="KM5">KM5</option>
          </select>
        )}

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 flex-1 min-w-[220px]">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by customer name, phone, order ID, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400 hover:text-red-500 transition">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading data...</div>
        ) : filteredComplaints.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <MessageSquareWarning size={28} className="text-slate-300" />
            No complaints found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                  {canSeeAllBranches && <th className="p-4">Branch</th>}
                  <th className="p-4">Customer</th>
                  <th className="p-4">Phone</th>
                  <th className="p-4">Order ID</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Details</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Status</th>
                  {canManage && <th className="p-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {filteredComplaints.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition">
                    {canSeeAllBranches && <td className="p-4 text-gray-600">{c.branch}</td>}
                    <td className="p-4 font-medium text-gray-900">{c.customerName}</td>
                    <td className="p-4 text-gray-600">{c.phone || <span className="text-slate-300">—</span>}</td>
                    <td className="p-4 text-gray-600">{c.orderId || <span className="text-slate-300">—</span>}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        {categoryLabel(c.category)}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600 max-w-xs truncate" title={c.description}>{c.description}</td>
                    <td className="p-4 text-gray-500">{c.date}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${STATUS_STYLE[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    {canManage && (
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {c.status !== 'RESOLVED' && (
                            <button
                              onClick={() => openResolveModal(c)}
                              className="text-emerald-500 hover:text-emerald-700 p-1.5 rounded-lg hover:bg-emerald-50 transition"
                              title="Resolve Complaint"
                            >
                              <CheckCheck size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(c)}
                            className="text-slate-400 hover:text-brand-600 p-1.5 rounded-lg hover:bg-brand-50 transition"
                            title="Edit / Update Status"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal — Add / Edit Complaint */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-800">{editingId ? 'Edit Complaint' : 'Log Complaint'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="E.g. 0615xxxxxx"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Order ID (optional)</label>
                  <input
                    type="text"
                    placeholder="E.g. 11250"
                    value={formData.orderId}
                    onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Complaint Details</label>
                <textarea
                  required
                  rows={3}
                  placeholder="What happened?"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                {canSeeAllBranches && (
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
                )}
              </div>

              {editingId && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="RESOLVED">Resolved</option>
                    </select>
                  </div>
                  {formData.status === 'RESOLVED' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Resolution Notes</label>
                      <textarea
                        rows={2}
                        placeholder="How was this resolved?"
                        value={formData.resolutionNotes}
                        onChange={(e) => setFormData({ ...formData, resolutionNotes: e.target.value })}
                        className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                      />
                    </div>
                  )}
                </>
              )}

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

      {/* Modal — Resolve Complaint (quick, focused action) */}
      {resolveTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Resolve Complaint</h2>
              <p className="text-sm text-gray-500 mt-1">
                {resolveTarget.customerName}
                {resolveTarget.orderId ? ` — Order ${resolveTarget.orderId}` : ''}
              </p>
              <p className="text-sm text-gray-600 mt-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                {resolveTarget.description}
              </p>
            </div>
            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  How was this resolved?
                </label>
                <textarea
                  required
                  autoFocus
                  rows={3}
                  placeholder="E.g. Replaced the damaged item and offered a discount on the next order"
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setResolveTarget(null); setResolveNotes(''); }}
                  className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-1.5"
                >
                  <CheckCheck size={16} /> Mark as Resolved
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
