'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';
import { MessageSquareWarning, CheckCircle2, Clock, Calendar, Download, X, Timer } from 'lucide-react';

const CATEGORY_LABEL = {
  DAMAGED: 'Damaged Item',
  DELAYED: 'Delayed Order',
  LOST: 'Lost Item',
  QUALITY: 'Quality Issue',
  STAFF: 'Staff Behavior',
  OTHER: 'Other',
};
const STATUS_LABEL = { OPEN: 'Open', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' };
const STATUS_STYLE = {
  OPEN: 'bg-red-50 text-red-700 border-red-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const exportToCSV = (filename, rows) => {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escapeCell = (value) => {
    const str = String(value ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const csvLines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(',')),
  ];
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function ComplaintsReportPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [complaints, setComplaints] = useState([]);

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
  }, [router]);

  const fetchComplaints = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const branchParam = branchFilter !== 'All' ? branchFilter : '';
      const res = await API.get(
        `/complaints?branch=${branchParam}&status=${statusFilter}&dateFrom=${dateFrom || ''}&dateTo=${dateTo || ''}`
      );
      setComplaints(res.data || []);
    } catch (err) {
      console.error('Failed to load complaints report:', err);
    } finally {
      setLoading(false);
    }
  }, [user, branchFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const stats = useMemo(() => {
    const total = complaints.length;
    const open = complaints.filter((c) => c.status === 'OPEN').length;
    const inProgress = complaints.filter((c) => c.status === 'IN_PROGRESS').length;
    const resolved = complaints.filter((c) => c.status === 'RESOLVED').length;
    const resolutionRate = total > 0 ? (resolved / total) * 100 : 0;

    const resolvedWithTimes = complaints.filter((c) => c.status === 'RESOLVED' && c.resolvedAt);
    const avgResolutionHours = resolvedWithTimes.length
      ? resolvedWithTimes.reduce((sum, c) => {
          const hours = (new Date(c.resolvedAt) - new Date(c.createdAt)) / (1000 * 60 * 60);
          return sum + hours;
        }, 0) / resolvedWithTimes.length
      : null;

    return { total, open, inProgress, resolved, resolutionRate, avgResolutionHours };
  }, [complaints]);

  const byCategory = useMemo(() => {
    const map = new Map();
    for (const c of complaints) {
      const cats = Array.isArray(c.category) ? c.category : [c.category];
      for (const key of cats) {
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
    return [...map.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
  }, [complaints]);

  const byBranch = useMemo(() => {
    const map = new Map();
    for (const c of complaints) {
      map.set(c.branch, (map.get(c.branch) || 0) + 1);
    }
    return [...map.entries()].map(([branch, count]) => ({ branch, count }));
  }, [complaints]);

  const sortedComplaints = useMemo(
    () => [...complaints].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [complaints]
  );

  const dateRangeLabel = dateFrom && dateTo && dateFrom !== dateTo
    ? `${dateFrom}_to_${dateTo}`
    : (dateFrom || dateTo || 'all');

  const statusFilterLabel = statusFilter === 'All' ? 'All' : STATUS_LABEL[statusFilter];

  const formatHours = (hours) => {
    if (hours == null) return '—';
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    if (hours < 48) return `${hours.toFixed(1)} hrs`;
    return `${(hours / 24).toFixed(1)} days`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Complaints Report</h1>
          <p className="text-sm text-gray-500">Volume, resolution rate, and turnaround across branches and categories</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center bg-slate-100 rounded-xl p-1">
          {['All', 'OPEN', 'IN_PROGRESS', 'RESOLVED'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
                statusFilter === tab ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'All' ? 'All' : STATUS_LABEL[tab]}
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
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
          <Calendar size={15} className="text-brand-500 shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none"
            />
          </div>
          <span className="w-3 h-px bg-slate-300" />
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              title="Clear date range — show all dates"
              className="text-slate-400 hover:text-red-500 transition ml-1"
            >
              <X size={15} />
            </button>
          )}
        </div>
        {sortedComplaints.length > 0 && (
          <button
            onClick={() =>
              exportToCSV(
                `complaints-report-${statusFilterLabel}-${dateRangeLabel}.csv`,
                sortedComplaints.map((c) => ({
                  Date: c.date,
                  Branch: c.branch,
                  Customer: c.customerName,
                  Phone: c.phone || '',
                  OrderID: c.orderId || '',
                  Category: (Array.isArray(c.category) ? c.category : [c.category]).map((cat) => CATEGORY_LABEL[cat] || cat).join(', '),
                  Status: STATUS_LABEL[c.status] || c.status,
                  ResolutionNotes: c.resolutionNotes || '',
                  ResolvedAt: c.resolvedAt ? new Date(c.resolvedAt).toISOString().split('T')[0] : '',
                }))
              )
            }
            className="flex items-center gap-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-700 transition ml-auto"
          >
            <Download size={16} /> Export CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading data...</div>
      ) : complaints.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-slate-400 text-sm shadow-sm">
          No complaints found for this filter.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="group relative bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-400 to-slate-600" />
              <div className="p-3 bg-gradient-to-br from-slate-50 to-slate-100 text-slate-600 rounded-xl border border-slate-100 group-hover:scale-105 transition-transform">
                <MessageSquareWarning size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400 tracking-wide">Total</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5 tabular-nums">{stats.total}</h3>
              </div>
            </div>
            <div className="group relative bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-400 to-red-600" />
              <div className="p-3 bg-gradient-to-br from-red-50 to-red-100 text-red-600 rounded-xl border border-red-100 group-hover:scale-105 transition-transform">
                <MessageSquareWarning size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400 tracking-wide">Open</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5 tabular-nums">{stats.open}</h3>
              </div>
            </div>
            <div className="group relative bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-amber-600" />
              <div className="p-3 bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 rounded-xl border border-amber-100 group-hover:scale-105 transition-transform">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400 tracking-wide">In Progress</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5 tabular-nums">{stats.inProgress}</h3>
              </div>
            </div>
            <div className="group relative bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
              <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 rounded-xl border border-emerald-100 group-hover:scale-105 transition-transform">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400 tracking-wide">Resolved</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5 tabular-nums">
                  {stats.resolved} <span className="text-sm font-medium text-slate-400">({stats.resolutionRate.toFixed(0)}%)</span>
                </h3>
              </div>
            </div>
            <div className="group relative bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-400 to-brand-600" />
              <div className="p-3 bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 rounded-xl border border-brand-100 group-hover:scale-105 transition-transform">
                <Timer size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400 tracking-wide">Avg. Resolution Time</p>
                <h3 className="text-xl font-bold text-slate-800 mt-0.5 tabular-nums">{formatHours(stats.avgResolutionHours)}</h3>
              </div>
            </div>
          </div>

          {/* Breakdown by category / branch */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-700">By Category</h3>
              <div className="space-y-2">
                {byCategory.map((c) => (
                  <div key={c.category} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{CATEGORY_LABEL[c.category] || c.category}</span>
                    <span className="font-semibold text-slate-800">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-700">By Branch</h3>
              <div className="space-y-2">
                {byBranch.map((b) => (
                  <div key={b.branch} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{b.branch}</span>
                    <span className="font-semibold text-slate-800">{b.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Full complaints table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-700">
              {statusFilter === 'All' ? 'All Complaints' : `${STATUS_LABEL[statusFilter]} Complaints`}
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase bg-slate-50/70">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Branch</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Resolution Time</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedComplaints.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 text-slate-600">{c.date}</td>
                      <td className="py-3 px-3 text-slate-600">{c.branch}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{c.customerName}</td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(c.category) ? c.category : [c.category]).map((cat) => (
                            <span key={cat} className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              {CATEGORY_LABEL[cat] || cat}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${STATUS_STYLE[c.status]}`}>
                          {STATUS_LABEL[c.status]}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {c.status === 'RESOLVED' && c.resolvedAt
                          ? formatHours((new Date(c.resolvedAt) - new Date(c.createdAt)) / (1000 * 60 * 60))
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
