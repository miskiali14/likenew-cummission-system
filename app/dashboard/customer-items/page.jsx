'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';
import { Search, PlusCircle, CheckCircle2, Trash2, Edit2, RotateCcw, Package, AlertCircle, X, Wallet, AlertTriangle } from 'lucide-react';

const emptyForm = { customerId: '', customerName: '', phone: '', description: '', date: '', branch: 'HQ' };

// An item sitting HELD this long is easy to forget about — flag it.
const AGING_THRESHOLD_DAYS = 30;
const getAgeDays = (dateStr) => {
  if (!dateStr) return 0;
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  return days < 0 ? 0 : days;
};

const COLLECTION_METHODS = [
  { value: 'IN_PERSON', label: 'Customer picked it up in person' },
  { value: 'DELIVERY', label: 'A delivery person came for it' },
  { value: 'INCLUDED_IN_ORDER', label: 'Included with their order' },
];
const collectionMethodLabel = (val) => COLLECTION_METHODS.find((m) => m.value === val)?.label || val;

export default function CustomerItemsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [statusTab, setStatusTab] = useState('HELD');
  const [branchFilter, setBranchFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [notification, setNotification] = useState(null);
  const [commission, setCommission] = useState(null);
  const [claimTarget, setClaimTarget] = useState(null);
  const [claimMethod, setClaimMethod] = useState('');
  const [claimNotes, setClaimNotes] = useState('');

  // Customer Items is Admin + Call Center only — Sales has no access at all.
  // Both remaining roles can claim, revert, edit, and delete, and both can
  // see/log against either branch.
  const canManage = ['ADMIN', 'CALL_CENTER'].includes(user?.role);
  const canSeeAllBranches = ['ADMIN', 'CALL_CENTER'].includes(user?.role);

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
    if (!['ADMIN', 'CALL_CENTER'].includes(parsedUser.role)) {
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
      const branchParam = canSeeAllBranches && branchFilter !== 'All' ? branchFilter : '';
      const res = await API.get(`/customer-items?branch=${branchParam}&status=${statusTab}`);
      setItems(res.data || []);
    } catch (err) {
      console.error('Failed to load customer items:', err);
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
      const res = await API.get('/customer-items/commission');
      setCommission(res.data);
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
    return items.filter(
      (it) =>
        it.customerId.toLowerCase().includes(q) ||
        it.customerName.toLowerCase().includes(q) ||
        (it.phone || '').toLowerCase().includes(q) ||
        it.description.toLowerCase().includes(q)
    );
  }, [items, search]);

  const agingCount = useMemo(
    () => items.filter((it) => it.status === 'HELD' && getAgeDays(it.date) > AGING_THRESHOLD_DAYS).length,
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
      customerId: item.customerId,
      customerName: item.customerName,
      phone: item.phone || '',
      description: item.description,
      date: item.date,
      branch: item.branch,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await API.patch(`/customer-items/${editingId}`, formData);
        showToast('success', 'Item updated successfully!');
      } else {
        await API.post('/customer-items', formData);
        showToast('success', 'Item saved successfully!');
      }
      setShowModal(false);
      setEditingId(null);
      fetchItems();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to save item');
    }
  };

  const openClaimModal = (item) => {
    setClaimTarget(item);
    setClaimMethod('');
    setClaimNotes('');
  };

  const handleClaimSubmit = async (e) => {
    e.preventDefault();
    if (!claimTarget) return;
    try {
      await API.patch(`/customer-items/${claimTarget.id}`, {
        status: 'CLAIMED',
        collectionMethod: claimMethod,
        collectionNotes: claimNotes,
      });
      showToast('success', 'Item marked as claimed');
      setClaimTarget(null);
      fetchItems();
      fetchCommission();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to update item');
    }
  };

  const handleMarkHeld = async (id) => {
    if (!confirm('Move this item back to Held? This removes the collection commission for it.')) return;
    try {
      await API.patch(`/customer-items/${id}`, { status: 'HELD' });
      showToast('success', 'Item moved back to Held');
      fetchItems();
      fetchCommission();
    } catch (err) {
      showToast('error', 'Failed to update item');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this item permanently?')) return;
    try {
      await API.delete(`/customer-items/${id}`);
      showToast('success', 'Item deleted');
      fetchItems();
    } catch (err) {
      showToast('error', 'Failed to delete item');
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
          <h1 className="text-2xl font-bold text-gray-800">Customer Items</h1>
          <p className="text-sm text-gray-500">Belongings customers left behind — registered, tracked, and marked once claimed</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm"
        >
          <PlusCircle size={18} /> Add Item
        </button>
      </div>

      {/* Aging alert — items sitting HELD past the threshold are easy to forget */}
      {agingCount > 0 && (
        <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm font-medium">
          <AlertTriangle size={18} className="shrink-0" />
          {agingCount} item{agingCount > 1 ? 's have' : ' has'} been held for over {AGING_THRESHOLD_DAYS} days — worth following up.
        </div>
      )}

      {/* Customer Item Collection Commission — separate from washing/ironing commission */}
      {commission && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
            <Wallet size={16} className="text-brand-600" />
            Customer Item Collection Commission
          </div>
          {user?.role === 'ADMIN' ? (
            commission.byUser?.length ? (
              <div className="space-y-2">
                {commission.byUser.map((u) => (
                  <div key={u.userId} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{u.name}</span>
                    <span className="font-medium text-slate-800">{u.count} items — ${u.commission.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-100 font-semibold text-slate-900">
                  <span>Total</span>
                  <span>{commission.totalClaimedCount} items — ${commission.totalCommission.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No items claimed yet.</p>
            )
          ) : (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Your total ({commission.myClaimedCount} items claimed)</span>
              <span className="font-semibold text-slate-900 text-base">${commission.myCommission.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center bg-slate-100 rounded-xl p-1">
          {['HELD', 'CLAIMED', 'All'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
                statusTab === tab ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'HELD' ? 'Held' : tab === 'CLAIMED' ? 'Claimed' : 'All'}
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
            placeholder="Search by customer ID, name, phone, or item..."
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
            <Package size={28} className="text-slate-300" />
            No items found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                  {canSeeAllBranches && <th className="p-4">Branch</th>}
                  <th className="p-4">Customer ID</th>
                  <th className="p-4">Customer Name</th>
                  <th className="p-4">Phone</th>
                  <th className="p-4">Item Description</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Age</th>
                  <th className="p-4">Status</th>
                  {user?.role === 'ADMIN' && <th className="p-4">Logged By</th>}
                  {user?.role === 'ADMIN' && <th className="p-4">Handled By</th>}
                  {canManage && <th className="p-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition">
                    {canSeeAllBranches && <td className="p-4 text-gray-600">{item.branch}</td>}
                    <td className="p-4 font-extrabold text-slate-900">{item.customerId}</td>
                    <td className="p-4 font-medium text-gray-900">{item.customerName}</td>
                    <td className="p-4 text-gray-600">{item.phone || <span className="text-slate-300">—</span>}</td>
                    <td className="p-4 text-gray-600">{item.description}</td>
                    <td className="p-4 text-gray-500">{item.date}</td>
                    <td className="p-4">
                      {item.status === 'HELD' ? (
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
                          item.status === 'CLAIMED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {item.status === 'CLAIMED' ? 'Claimed' : 'Held'}
                      </span>
                    </td>
                    {user?.role === 'ADMIN' && (
                      <td className="p-4 text-gray-500">{item.createdByName || <span className="text-slate-300">—</span>}</td>
                    )}
                    {user?.role === 'ADMIN' && (
                      <td className="p-4 text-gray-500">
                        {item.status === 'CLAIMED' ? (
                          <span title={item.collectionMethod ? collectionMethodLabel(item.collectionMethod) : ''}>
                            {item.claimedByName || '—'}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    )}
                    {canManage && (
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {item.status === 'HELD' ? (
                            <button
                              onClick={() => openClaimModal(item)}
                              className="text-emerald-600 hover:text-emerald-700 p-1.5 rounded-lg hover:bg-emerald-50 transition"
                              title="Mark as Claimed"
                            >
                              <CheckCircle2 size={18} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleMarkHeld(item.id)}
                              className="text-amber-600 hover:text-amber-700 p-1.5 rounded-lg hover:bg-amber-50 transition"
                              title="Move back to Held"
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
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal — Add / Edit Item */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-800">{editingId ? 'Edit Customer Item' : 'Add Customer Item'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Customer ID</label>
                <input
                  type="text"
                  required
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
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
                <label className="block text-xs font-semibold text-gray-600 mb-1">Item Description</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. ID card, wallet, phone charger..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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

      {/* Modal — Mark as Claimed */}
      {claimTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Mark as Claimed</h2>
              <p className="text-sm text-gray-500 mt-1">
                {claimTarget.customerName} — {claimTarget.description}
              </p>
            </div>
            <form onSubmit={handleClaimSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  How did the customer get it back?
                </label>
                <select
                  required
                  value={claimMethod}
                  onChange={(e) => setClaimMethod(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="" disabled>Select one...</option>
                  {COLLECTION_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="E.g. where/how it was collected"
                  value={claimNotes}
                  onChange={(e) => setClaimNotes(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClaimTarget(null)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-1.5"
                >
                  <CheckCircle2 size={16} /> Confirm Claimed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
