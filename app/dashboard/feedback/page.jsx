'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';
import {
  Loader2, Star, MessageCircle, TrendingUp, AlertTriangle, MapPin,
  Calendar, Download, X,
} from 'lucide-react';

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

function Stars({ rating }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-ink-600'}
        />
      ))}
    </span>
  );
}

export default function FeedbackPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [feedback, setFeedback] = useState([]);

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
  }, [router]);

  const fetchFeedback = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const branchParam = branchFilter !== 'All' ? branchFilter : '';
      const res = await API.get(`/feedback?branch=${branchParam}&dateFrom=${dateFrom || ''}&dateTo=${dateTo || ''}`);
      setFeedback(res.data || []);
    } catch (err) {
      console.error('Failed to load feedback:', err);
    } finally {
      setLoading(false);
    }
  }, [user, branchFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const stats = useMemo(() => {
    const total = feedback.length;
    const sum = feedback.reduce((s, f) => s + f.rating, 0);
    const average = total ? sum / total : 0;
    const low = feedback.filter((f) => f.rating <= 2).length;
    const high = feedback.filter((f) => f.rating >= 4).length;
    return { total, average, low, high };
  }, [feedback]);

  const byRating = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const f of feedback) counts[f.rating] = (counts[f.rating] || 0) + 1;
    const max = Math.max(1, ...Object.values(counts));
    return [5, 4, 3, 2, 1].map((n) => ({ n, count: counts[n], pct: (counts[n] / max) * 100 }));
  }, [feedback]);

  const byBranch = useMemo(() => {
    const map = new Map();
    for (const f of feedback) {
      const key = f.branch || 'Unknown';
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].map(([branch, count]) => ({ branch, count }));
  }, [feedback]);

  const sortedFeedback = useMemo(
    () => [...feedback].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [feedback]
  );

  const pct = (n) => (stats.total ? Math.round((n / stats.total) * 100) : 0);

  const dateRangeLabel = dateFrom && dateTo && dateFrom !== dateTo
    ? `${dateFrom}_to_${dateTo}`
    : (dateFrom || dateTo || 'all');

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Customer Feedback</h1>
          <p className="text-sm text-gray-500 dark:text-ink-400">1&ndash;5 ratings collected by the WhatsApp bot after each order is completed</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="border border-slate-200 dark:border-ink-600 bg-slate-50 dark:bg-ink-700 text-sm font-medium text-slate-700 dark:text-ink-200 rounded-xl p-2 focus:outline-none cursor-pointer"
        >
          <option value="All">All Branches</option>
          <option value="HQ">HQ</option>
          <option value="KM5">KM5</option>
        </select>
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-ink-700 border border-slate-200 dark:border-ink-600 rounded-xl px-3.5 py-2">
          <Calendar size={15} className="text-brand-500 dark:text-brand-400 shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-ink-500 uppercase tracking-wide">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-700 dark:text-ink-200 focus:outline-none"
            />
          </div>
          <span className="w-3 h-px bg-slate-300 dark:bg-ink-600" />
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-ink-500 uppercase tracking-wide">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-700 dark:text-ink-200 focus:outline-none"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              title="Clear date range — show all dates"
              className="text-slate-400 dark:text-ink-500 hover:text-red-500 transition ml-1"
            >
              <X size={15} />
            </button>
          )}
        </div>
        {sortedFeedback.length > 0 && (
          <button
            onClick={() =>
              exportToCSV(
                `customer-feedback-${dateRangeLabel}.csv`,
                sortedFeedback.map((f) => ({
                  Date: new Date(f.createdAt).toISOString().split('T')[0],
                  Branch: f.branch || '',
                  OrderID: f.orderId,
                  Phone: f.phone,
                  Rating: f.rating,
                }))
              )
            }
            className="flex items-center gap-2 bg-slate-50 dark:bg-ink-700 border border-slate-200 dark:border-ink-600 hover:bg-slate-100 dark:hover:bg-ink-600 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-ink-200 transition ml-auto"
          >
            <Download size={16} /> Export CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-10 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-ink-500"><Loader2 size={28} className="animate-spin text-brand-500" /><span className="text-sm font-medium">Loading data...</span></div>
      ) : feedback.length === 0 ? (
        <div className="bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 rounded-2xl p-10 flex flex-col items-center gap-2 text-slate-400 dark:text-ink-500 text-sm shadow-sm">
          <MessageCircle size={28} className="text-slate-300 dark:text-ink-600" />
          No feedback collected yet for this filter.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="group relative bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-400 to-brand-600" />
              <div className="p-3 bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/40 dark:to-brand-800/40 text-brand-600 dark:text-brand-300 rounded-xl border border-brand-100 dark:border-brand-700 group-hover:scale-105 transition-transform">
                <MessageCircle size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400 dark:text-ink-500 tracking-wide">Responses</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5 tabular-nums">{stats.total}</h3>
              </div>
            </div>
            <div className="group relative bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-amber-600" />
              <div className="p-3 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/40 dark:to-amber-800/40 text-amber-500 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-amber-800 group-hover:scale-105 transition-transform">
                <Star size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400 dark:text-ink-500 tracking-wide">Average Rating</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5 tabular-nums">{stats.average.toFixed(1)} <span className="text-sm font-medium text-slate-400 dark:text-ink-500">/ 5</span></h3>
              </div>
            </div>
            <div className="group relative bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
              <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/40 dark:to-emerald-800/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-800 group-hover:scale-105 transition-transform">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400 dark:text-ink-500 tracking-wide">4&ndash;5 Stars</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5 tabular-nums">
                  {stats.high} <span className="text-sm font-medium text-slate-400 dark:text-ink-500">({pct(stats.high)}%)</span>
                </h3>
              </div>
            </div>
            <div className="group relative bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-400 to-red-600" />
              <div className="p-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/40 dark:to-red-800/40 text-red-600 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-800 group-hover:scale-105 transition-transform">
                <AlertTriangle size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400 dark:text-ink-500 tracking-wide">1&ndash;2 Stars</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5 tabular-nums">
                  {stats.low} <span className="text-sm font-medium text-slate-400 dark:text-ink-500">({pct(stats.low)}%)</span>
                </h3>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Rating distribution */}
            <div className="bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 rounded-2xl p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-700 dark:text-ink-200">Rating Distribution</h3>
              <div className="space-y-2.5">
                {byRating.map((r) => (
                  <div key={r.n} className="flex items-center gap-3">
                    <span className="w-10 text-xs font-semibold text-slate-500 dark:text-ink-400 flex items-center gap-0.5">{r.n} <Star size={11} className="fill-amber-400 text-amber-400" /></span>
                    <div className="flex-1 h-2.5 bg-slate-100 dark:bg-ink-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${r.n <= 2 ? 'bg-gradient-to-r from-red-400 to-red-500' : r.n === 3 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'}`}
                        style={{ width: `${r.pct}%` }}
                      />
                    </div>
                    <span className="w-6 text-xs font-semibold text-slate-700 dark:text-ink-200 text-right tabular-nums">{r.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* By branch */}
            <div className="bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 rounded-2xl p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-700 dark:text-ink-200 flex items-center gap-1.5"><MapPin size={15} className="text-brand-500" /> By Branch</h3>
              <div className="space-y-2">
                {byBranch.map((b) => (
                  <div key={b.branch} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-ink-300">{b.branch}</span>
                    <span className="font-semibold text-slate-800 dark:text-white">{b.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Full table */}
          <div className="bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-700 dark:text-ink-200">All Responses</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-ink-700">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-ink-700 text-slate-500 dark:text-ink-400 text-xs uppercase bg-slate-50/70 dark:bg-ink-700/40">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Branch</th>
                    <th className="py-3 px-3">Order ID</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFeedback.map((f) => (
                    <tr key={f.id} className="border-b border-slate-100 dark:border-ink-700 hover:bg-slate-50/80 dark:hover:bg-ink-700/40 transition">
                      <td className="py-3 px-3 text-slate-600 dark:text-ink-300">{new Date(f.createdAt).toISOString().split('T')[0]}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-ink-300">{f.branch || <span className="text-slate-300 dark:text-ink-600">&mdash;</span>}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800 dark:text-white">{f.orderId}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-ink-300">{f.phone}</td>
                      <td className="py-3 px-3"><Stars rating={f.rating} /></td>
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
