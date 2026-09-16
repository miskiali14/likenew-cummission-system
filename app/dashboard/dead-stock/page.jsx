'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';
import { Search, PlusCircle, CheckCircle2, Trash2, Edit2, RotateCcw, Boxes, AlertCircle, X, Wallet, AlertTriangle } from 'lucide-react';
import { DEAD_STOCK_GIVEN_OUT_COMMISSION } from '@/lib/commission';

const emptyForm = { orderId: '', category: 'LALAAB', quantity: 1, date: '', branch: 'HQ' };

// An order sitting IN_STOCK this long is easy to forget about — flag it.
const AGING_THRESHOLD_DAYS = 30;
const getAgeDays = (dateStr) => {
  if (!dateStr) return 0;
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  return days < 0 ? 0 : days;
};

const CATEGORIES = [
  { value: 'LALAAB', label: 'Lalaab (Folded)' },
  { value: 'HANGER', label: 'Hanger' },
  { value: 'BUSTE_ROOG', label: 'Buste+Roog (Bagged)' },
  { value: 'KABO', label: 'Kabo' },
];
const categoryLabel = (val) => CATEGORIES.find((c) => c.value === val)?.label || val;

const COLLECTION_METHODS = [
  { value: 'IN_PERSON', label: 'Customer picked it up in person' },
  { value: 'DELIVERY', label: 'A delivery person came for it' },
  { value: 'INCLUDED_IN_ORDER', label: 'Included with their order' },
];

export default function DeadStockPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [statusTab, setStatusTab] = useState('IN_STOCK');
  const [branchFilter, setBranchFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [notification, setNotification] = useState(null);
  const [giveOutTarget, setGiveOutTarget] = useState(null);
  const [giveOutMethod, setGiveOutMethod] = useState('');
  const [giveOutNotes, setGiveOutNotes] = useState('');
  const [commission, setCommission] = useState(null);

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
    if (!['ADMIN', 'CUSTOMER_CARE'].includes(parsedUser.role)) {
      router.push('/dashboard');
      return;
    }
    setUser(parsedUser);
    const today = new Date().toISOString().split('T')[0];
    setFormData((prev) => ({ ...prev, date: today, branch: parsedUser.branch || 'HQ' }));
  }, [router]);

  const fetchItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const branchParam = branchFilter !== 'All' ? branchFilter : '';
      const res = await API.get(`/dead-stock?branch=${branchParam}&status=${statusTab}`);
      setItems(res.data || []);
    } catch (err) {
      console.error('Failed to load dead stock:', err);
    } finally {
      setLoading(false);
    }
  }, [user, branchFilter, statusTab]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const fetchCommission = useCallback(async () => {
    if (!user) return;
    try {
      const res = await API.get('/dead-stock/report');
      const givenOutCount = (res.data || []).filter((it) => it.status === 'GIVEN_OUT').length;
      setCommission({
        count: givenOutCount,
        total: Number((givenOutCount * DEAD_STOCK_GIVEN_OUT_COMMISSION).toFixed(2)),
      });
    } catch (err) {
      console.error('Failed to load commission summary:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchCommission();
  }, [fetchCommission]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.orderId.toLowerCase().includes(q));
  }, [items, search]);

  const agingCount = useMemo(
    () => items.filter((it) => it.status === 'IN_STOCK' && getAgeDays(it.date) > AGING_THRESHOLD_DAYS).length,
    [items]
  );

  const openAddModal = () => {
    setEditingId(null);
    const today = new Date().toISOString().split('T')[0];
    setFormData({ ...emptyForm, date: today, branch: user?.branch || 'HQ' });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setFormData({
      orderId: item.orderId,
      category: item.category,
      quantity: item.quantity,
      date: item.date,
      branch: item.branch,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await API.patch(`/dead-stock/${editingId}`, formData);
        showToast('success', 'Entry updated successfully!');
      } else {
        await API.post('/dead-stock', formData);
        showToast('success', 'Entry saved successfully!');
      }
      setShowModal(false);
      setEditingId(null);
      fetchItems();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to save entry');
    }
  };

  const openGiveOutModal = (item) => {
    setGiveOutTarget(item);
    setGiveOutMethod('');
    setGiveOutNotes('');
  };

  const handleGiveOutSubmit = async (e) => {
    e.preventDefault();
    if (!giveOutTarget) return;
    try {
      await API.patch(`/dead-stock/${giveOutTarget.id}`, {
        status: 'GIVEN_OUT',
        givenOutMethod: giveOutMethod,
        givenOutNotes: giveOutNotes,
      });
      showToast('success', 'Marked as given out');
      setGiveOutTarget(null);
      fetchItems();
      fetchCommission();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to update entry');
    }
  };

  const handleMarkInStock = async (id) => {
    if (!confirm('Move this back to In Stock? This removes the commission for it.')) return;
    try {
      await API.patch(`/dead-stock/${id}`, { status: 'IN_STOCK' });
      showToast('success', 'Moved back to In Stock');
      fetchItems();
      fetchCommission();
    } catch (err) {
      showToast('error', 'Failed to update entry');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry permanently?')) return;
    try {
      await API.delete(`/dead-stock/${id}`);
      showToast('success', 'Entry deleted');
      fetchItems();
    } catch (err) {
      showToast('error', 'Failed to delete entry');
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dead Stock</h1>
          <p className="text-sm text-gray-500">Old, uncollected orders sitting at the branch — logged and given back out</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm"
        >
          <PlusCircle size={18} /> Add Entry
        </button>
      </div>

      {/* Aging alert — orders sitting IN_STOCK past the threshold are easy to forget */}
      {agingCount > 0 && (
        <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm font-medium">
          <AlertTriangle size={18} className="shrink-0" />
          {agingCount} entr{agingCount > 1 ? 'ies have' : 'y has'} been in stock for over {AGING_THRESHOLD_DAYS} days — worth following up.
        </div>
      )}

      {/* Given-Out Commission — separate from every other commission */}
      {commission && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Wallet size={16} className="text-brand-600" />
            Given-Out Commission
          </div>
          <span className="text-sm text-slate-600">
            {commission.count} given out — <span className="font-bold text-slate-900">${commission.total.toFixed(2)}</span>
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center bg-slate-100 rounded-xl p-1">
          {['IN_STOCK', 'GIVEN_OUT', 'All'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
                statusTab === tab ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'IN_STOCK' ? 'In Stock' : tab === 'GIVEN_OUT' ? 'Given Out' : 'All'}
            </button>
          ))}
        </div>

        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 rounded-xl p-2 focus:outline-none cursor-pointer"
        >
          <option value="All">All Branches</option>
          <option value="HQ">HQ</option>
          <option value="KM5">KM5</option>
        </select>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 flex-1 min-w-[220px]">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by order reference..."
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
        ) : filteredItems.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <Boxes size={28} className="text-slate-300" />
            No entries found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="p-4">Branch</th>
                  <th className="p-4">Order Ref</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Qty</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Age</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Logged By</th>
                  <th className="p-4">Given Out By</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition">
                    <td className="p-4 text-gray-600">{item.branch}</td>
                    <td className="p-4 font-extrabold text-slate-900">{item.orderId}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        {categoryLabel(item.category)}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600">{item.quantity}</td>
                    <td className="p-4 text-gray-500">{item.date}</td>
                    <td className="p-4">
                      {item.status === 'IN_STOCK' ? (
                        <span
                          className={`text-xs font-semibold ${
                            getAgeDays(item.date) > AGING_THRESHOLD_DAYS ? 'text-red-600' : 'text-slate-500'
                          }`}
                        >
                          {getAgeDays(item.date)}d
                          {getAgeDays(item.date) > AGING_THRESHOLD_DAYS && (
                            <AlertTriangle size={12} className="inline ml-1 -mt-0.5" />
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                          item.status === 'GIVEN_OUT'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {item.status === 'GIVEN_OUT' ? 'Given Out' : 'In Stock'}
                      </span>
                    </td>
                    <td className="p-4 text-gray-500">{item.createdByName || <span className="text-slate-300">—</span>}</td>
                    <td className="p-4 text-gray-500">{item.givenOutByName || <span className="text-slate-300">—</span>}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.status === 'IN_STOCK' ? (
                          <button
                            onClick={() => openGiveOutModal(item)}
                            className="text-emerald-600 hover:text-emerald-700 p-1.5 rounded-lg hover:bg-emerald-50 transition"
                            title="Mark as Given Out"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleMarkInStock(item.id)}
                            className="text-amber-600 hover:text-amber-700 p-1.5 rounded-lg hover:bg-amber-50 transition"
                            title="Move back to In Stock"
                          >
                            <RotateCcw size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(item)}
                          className="text-slate-400 hover:text-brand-600 p-1.5 rounded-lg hover:bg-brand-50 transition"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition"
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
        )}
      </div>

      {/* Modal — Add / Edit Entry */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-800">{editingId ? 'Edit Entry' : 'Add Dead Stock Entry'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Order Reference</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. 45327-1/1"
                  value={formData.orderId}
                  onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                  className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
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

      {/* Modal — Mark as Given Out */}
      {giveOutTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Mark as Given Out</h2>
              <p className="text-sm text-gray-500 mt-1">
                {giveOutTarget.orderId} — {categoryLabel(giveOutTarget.category)} ({giveOutTarget.quantity})
              </p>
            </div>
            <form onSubmit={handleGiveOutSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  How did the customer get it back?
                </label>
                <select
                  required
                  value={giveOutMethod}
                  onChange={(e) => setGiveOutMethod(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="" disabled>Select one...</option>
                  {COLLECTION_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
                <textarea
                  rows={2}
                  placeholder="E.g. where/how it was collected"
                  value={giveOutNotes}
                  onChange={(e) => setGiveOutNotes(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGiveOutTarget(null)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-1.5"
                >
                  <CheckCircle2 size={16} /> Confirm Given Out
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
