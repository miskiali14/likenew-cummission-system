'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';
import { Loader2, Search, PlusCircle, CheckCircle2, Trash2, Edit2, RotateCcw, PackagePlus, AlertCircle, X, AlertTriangle, Plus } from 'lucide-react';

const emptyForm = { customerName: '', phone: '', orderId: '', category: '', quantity: 1, date: '', branch: 'HQ', loggedByName: '' };

// An order sitting IN_STOCK this long is easy to forget about — flag it.
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

const OUTCOMES = [
  { value: 'GIVEN_OUT', label: 'Given out to customer' },
  { value: 'DONATED', label: 'Donated (customer said give it away)' },
  { value: 'DISCARDED', label: 'Discarded (customer said throw it away)' },
];
const RESOLVED_STATUSES = ['GIVEN_OUT', 'DONATED', 'DISCARDED'];
const STATUS_STYLE = {
  IN_STOCK: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  GIVEN_OUT: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  DONATED: 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800',
  DISCARDED: 'bg-slate-100 dark:bg-ink-700 text-slate-600 dark:text-ink-300 border-slate-300 dark:border-ink-600',
};
const STATUS_LABEL = { IN_STOCK: 'In Stock', GIVEN_OUT: 'Given Out', DONATED: 'Donated', DISCARDED: 'Discarded' };

// Full access for everyone — log, resolve, edit, delete, and every branch.
const ALLOWED_ROLES = ['ADMIN', 'CUSTOMER_CARE', 'CUSTOMER_OPS', 'SALES', 'CALL_CENTER'];
const EDIT_ROLES = ALLOWED_ROLES;
const ALL_BRANCH_ROLES = ALLOWED_ROLES;

export default function NewDeadStockPage() {
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
  const [resolveOutcome, setResolveOutcome] = useState('GIVEN_OUT');
  const [giveOutMethod, setGiveOutMethod] = useState('');
  const [giveOutNotes, setGiveOutNotes] = useState('');
  const [giveOutByName, setGiveOutByName] = useState('');
  const [categories, setCategories] = useState([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [staff, setStaff] = useState([]);

  const canEdit = EDIT_ROLES.includes(user?.role);
  const canSeeAllBranches = ALL_BRANCH_ROLES.includes(user?.role);
  // Sales/Call Center/Customer Care accounts are shared by more than one
  // real person (e.g. Customer Care covers both Suad Abdi and Mudey), so
  // they pick their real name from the dropdown. Admin and Customer Ops
  // (Abdirsaq) are each one specific person — use that name automatically
  // instead of making them pick it from a dropdown too.
  const usesSharedLogin = ['SALES', 'CALL_CENTER', 'CUSTOMER_CARE'].includes(user?.role);

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
    if (!ALLOWED_ROLES.includes(parsedUser.role)) {
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
      const res = await API.get(`/new-dead-stock?branch=${branchParam}&status=${statusTab}`);
      setItems(res.data || []);
    } catch (err) {
      console.error('Failed to load new dead stock:', err);
    } finally {
      setLoading(false);
    }
  }, [user, canSeeAllBranches, branchFilter, statusTab]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    try {
      const res = await API.get('/dead-stock/categories');
      setCategories(res.data || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const fetchStaff = useCallback(async () => {
    if (!user) return;
    try {
      const res = await API.get('/new-dead-stock/staff');
      setStaff(res.data || []);
    } catch (err) {
      console.error('Failed to load staff list:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Not filtered by branch — whoever is logging/resolving an entry can work
  // across either branch, so every name in the list is always selectable
  // regardless of which branch the entry itself is for.
  const staffForBranch = staff;
  const staffForGiveOutBranch = staff;

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      const res = await API.post('/dead-stock/categories', { name });
      showToast('success', 'Category added!');
      setCategories((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setFormData((prev) => ({ ...prev, category: res.data.name }));
      setNewCategoryName('');
      setShowAddCategory(false);
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to add category');
    }
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.orderId.toLowerCase().includes(q) ||
        it.customerName.toLowerCase().includes(q) ||
        (it.phone || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const agingCount = useMemo(
    () => items.filter((it) => it.status === 'IN_STOCK' && getAgeDays(it.date) > AGING_THRESHOLD_DAYS).length,
    [items]
  );

  const openAddModal = () => {
    setEditingId(null);
    const today = new Date().toISOString().split('T')[0];
    setFormData({
      ...emptyForm,
      date: today,
      branch: user?.branch || 'HQ',
      category: categories[0]?.name || '',
      loggedByName: usesSharedLogin ? '' : (user?.fullName || ''),
    });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setFormData({
      customerName: item.customerName,
      phone: item.phone,
      orderId: item.orderId,
      category: item.category,
      quantity: item.quantity,
      date: item.date,
      branch: item.branch,
      loggedByName: item.createdByName || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await API.patch(`/new-dead-stock/${editingId}`, formData);
        showToast('success', 'Entry updated successfully!');
      } else {
        await API.post('/new-dead-stock', formData);
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
    setResolveOutcome('GIVEN_OUT');
    setGiveOutMethod('');
    setGiveOutNotes('');
    setGiveOutByName(usesSharedLogin ? '' : (user?.fullName || ''));
  };

  const handleGiveOutSubmit = async (e) => {
    e.preventDefault();
    if (!giveOutTarget) return;
    try {
      await API.patch(`/new-dead-stock/${giveOutTarget.id}`, {
        status: resolveOutcome,
        givenOutMethod: resolveOutcome === 'GIVEN_OUT' ? giveOutMethod : undefined,
        givenOutNotes: giveOutNotes,
        givenOutByName: giveOutByName,
      });
      showToast('success', `Marked as ${STATUS_LABEL[resolveOutcome].toLowerCase()}`);
      setGiveOutTarget(null);
      setGiveOutByName('');
      fetchItems();
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to update entry');
    }
  };

  const handleMarkInStock = async (id) => {
    if (!confirm('Move this back to In Stock?')) return;
    try {
      await API.patch(`/new-dead-stock/${id}`, { status: 'IN_STOCK' });
      showToast('success', 'Moved back to In Stock');
      fetchItems();
    } catch (err) {
      showToast('error', 'Failed to update entry');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry permanently?')) return;
    try {
      await API.delete(`/new-dead-stock/${id}`);
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
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border transition-all animate-toast-in ${
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">New Dead Stock</h1>
          <p className="text-sm text-gray-500 dark:text-ink-400">Old, uncollected orders — tied to the customer's name and phone</p>
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
        <div className="flex items-center gap-2.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-2xl px-4 py-3 text-sm font-medium">
          <AlertTriangle size={18} className="shrink-0" />
          {agingCount} entr{agingCount > 1 ? 'ies have' : 'y has'} been in stock for over {AGING_THRESHOLD_DAYS} days — worth following up.
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center bg-slate-100 dark:bg-ink-700 rounded-xl p-1">
          {['IN_STOCK', 'GIVEN_OUT', 'DONATED', 'DISCARDED', 'All'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                statusTab === tab ? 'bg-white dark:bg-ink-800 text-brand-700 dark:text-brand-300 shadow-sm' : 'text-slate-500 dark:text-ink-400 hover:text-slate-700 dark:hover:text-ink-200'
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
            className="border border-slate-200 dark:border-ink-600 bg-slate-50 dark:bg-ink-700 text-sm font-medium text-slate-700 dark:text-ink-200 rounded-xl p-2 focus:outline-none cursor-pointer"
          >
            <option value="All">All Branches</option>
            <option value="HQ">HQ</option>
            <option value="KM5">KM5</option>
          </select>
        )}

        <div className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-ink-700 border border-slate-200 dark:border-ink-600 rounded-xl px-3.5 py-2 flex-1 min-w-[220px]">
          <Search size={15} className="text-slate-400 dark:text-ink-500 shrink-0" />
          <input
            type="text"
            placeholder="Search by customer name, phone, or order reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm font-medium text-slate-700 dark:text-ink-200 focus:outline-none w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400 dark:text-ink-500 hover:text-red-500 transition">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-10 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-ink-500"><Loader2 size={28} className="animate-spin text-brand-500 dark:text-brand-400" /><span className="text-sm font-medium">Loading data...</span></div>
        ) : filteredItems.length === 0 ? (
          <div className="p-10 text-center text-slate-400 dark:text-ink-500 text-sm flex flex-col items-center gap-2">
            <PackagePlus size={28} className="text-slate-300 dark:text-ink-600" />
            No entries found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-ink-700/40 border-b border-gray-100 dark:border-ink-700 text-xs text-gray-500 dark:text-ink-400 uppercase tracking-wider">
                  <th className="p-3">Customer</th>
                  <th className="p-3">Order Ref</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Qty</th>
                  {canSeeAllBranches && <th className="p-3">Branch</th>}
                  <th className="p-3">Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-ink-700 text-sm text-gray-700 dark:text-ink-300">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-ink-700/40 transition align-top">
                    <td className="p-3 min-w-[150px]">
                      <div className="font-medium text-gray-900 dark:text-white">{item.customerName}</div>
                      <div className="mt-1 text-xs text-gray-400 dark:text-ink-500 space-y-0.5">
                        <div>{item.phone}</div>
                        {item.createdByName && <div>Logged by {item.createdByName}</div>}
                      </div>
                    </td>
                    <td className="p-3 font-extrabold text-slate-900 dark:text-white whitespace-nowrap">{item.orderId}</td>
                    <td className="p-3">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 dark:bg-ink-700 text-slate-700 dark:text-ink-300 border border-slate-200 dark:border-ink-600">
                        {item.category}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600 dark:text-ink-300">{item.quantity}</td>
                    {canSeeAllBranches && <td className="p-3 text-gray-600 dark:text-ink-300">{item.branch}</td>}
                    <td className="p-3 text-gray-500 dark:text-ink-400 whitespace-nowrap">
                      {item.date}
                      {item.status === 'IN_STOCK' && (
                        <div className={`text-xs font-semibold mt-0.5 ${getAgeDays(item.date) > AGING_THRESHOLD_DAYS ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-ink-500'}`}>
                          {getAgeDays(item.date)}d
                          {getAgeDays(item.date) > AGING_THRESHOLD_DAYS && <AlertTriangle size={12} className="inline ml-1 -mt-0.5" />}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full border ${STATUS_STYLE[item.status]}`}>
                        {STATUS_LABEL[item.status]}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.status === 'IN_STOCK' ? (
                          <button
                            onClick={() => openGiveOutModal(item)}
                            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 p-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition"
                            title="Resolve (Given Out / Donated / Discarded)"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleMarkInStock(item.id)}
                            className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 p-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition"
                            title="Move back to In Stock"
                          >
                            <RotateCcw size={18} />
                          </button>
                        )}
                        {canEdit && (
                          <>
                            <button
                              onClick={() => openEditModal(item)}
                              className="text-slate-400 dark:text-ink-500 hover:text-brand-600 dark:hover:text-brand-400 p-1 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/30 transition"
                              title="Edit"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                              title="Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
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

      {/* Modal — Add / Edit Entry */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-white dark:bg-ink-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">{editingId ? 'Edit Entry' : 'Add New Dead Stock Entry'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
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
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Order Reference</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. 45327-1/1"
                  value={formData.orderId}
                  onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                  className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Category</label>
                  <div className="flex items-center gap-1.5">
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="" disabled>Select...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setShowAddCategory(true)}
                        title="Add a new category"
                        className="shrink-0 p-2.5 border border-slate-300 dark:border-ink-600 rounded-lg text-slate-500 dark:text-ink-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition"
                      >
                        <Plus size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                {canSeeAllBranches && (
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
              {usesSharedLogin ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Logged By (your name)</label>
                  <select
                    required
                    value={formData.loggedByName}
                    onChange={(e) => setFormData({ ...formData, loggedByName: e.target.value })}
                    className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="" disabled>Select your name...</option>
                    {staffForBranch.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                  {staffForBranch.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      No names set up yet — ask Admin to add one on the Staff page.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-ink-400 bg-slate-50 dark:bg-ink-700 border border-slate-200 dark:border-ink-600 rounded-lg p-2.5">
                  Will be logged as <span className="font-semibold text-slate-700 dark:text-ink-200">{formData.loggedByName}</span> (you're logged in as them).
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingId(null); }}
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

      {/* Modal — Resolve Entry (Given Out / Donated / Discarded) */}
      {giveOutTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-white dark:bg-ink-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Resolve Entry</h2>
              <p className="text-sm text-gray-500 dark:text-ink-400 mt-1">
                {giveOutTarget.customerName} — {giveOutTarget.orderId} — {giveOutTarget.category} ({giveOutTarget.quantity})
              </p>
            </div>
            <form onSubmit={handleGiveOutSubmit} className="space-y-4">
              {usesSharedLogin ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Resolved By (your name)</label>
                  <select
                    required
                    value={giveOutByName}
                    onChange={(e) => setGiveOutByName(e.target.value)}
                    className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="" disabled>Select your name...</option>
                    {staffForGiveOutBranch.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                  {staffForGiveOutBranch.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      No names set up yet — ask Admin to add one on the Staff page.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-ink-400 bg-slate-50 dark:bg-ink-700 border border-slate-200 dark:border-ink-600 rounded-lg p-2.5">
                  Will be recorded as resolved by <span className="font-semibold text-slate-700 dark:text-ink-200">{giveOutByName}</span> (you're logged in as them).
                </p>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Outcome</label>
                <select
                  required
                  value={resolveOutcome}
                  onChange={(e) => setResolveOutcome(e.target.value)}
                  className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {OUTCOMES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {resolveOutcome === 'GIVEN_OUT' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">
                    How did the customer get it back?
                  </label>
                  <select
                    required
                    value={giveOutMethod}
                    onChange={(e) => setGiveOutMethod(e.target.value)}
                    className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="" disabled>Select one...</option>
                    {COLLECTION_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">
                  {resolveOutcome === 'GIVEN_OUT' ? 'Notes (required)' : 'How/why was it donated or discarded?'}
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder={resolveOutcome === 'GIVEN_OUT' ? 'E.g. where/how it was collected' : 'E.g. donated to the mosque, or thrown out — damaged beyond use'}
                  value={giveOutNotes}
                  onChange={(e) => setGiveOutNotes(e.target.value)}
                  className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGiveOutTarget(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-ink-600 rounded-lg text-sm font-medium text-gray-600 dark:text-ink-300 hover:bg-gray-50 dark:hover:bg-ink-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-1.5"
                >
                  <CheckCircle2 size={16} /> Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal — Add Category */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-ink-800 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Add Category</h2>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-ink-300 mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="E.g. Sherwac"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full border border-slate-300 dark:border-ink-600 dark:bg-ink-700 dark:text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }}
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
