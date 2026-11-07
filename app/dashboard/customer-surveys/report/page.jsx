'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';
import {
  Loader2, ClipboardCheck, MapPin, Gift, MessageSquareWarning,
  Calendar, Download, X, Quote, Compass,
} from 'lucide-react';

const QUESTIONS = [
  { key: 'satisfaction', label: 'Overall satisfaction with Likenew' },
  { key: 'qualityRating', label: 'Washing & ironing quality' },
  { key: 'desiredService', label: 'New service they’d like to see' },
  { key: 'suggestedChanges', label: 'What they’d want changed' },
];

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

export default function CustomerSurveysReportPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [surveys, setSurveys] = useState([]);

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

  const fetchSurveys = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const branchParam = branchFilter !== 'All' ? branchFilter : '';
      const res = await API.get(`/customer-surveys?branch=${branchParam}&dateFrom=${dateFrom || ''}&dateTo=${dateTo || ''}`);
      setSurveys(res.data || []);
    } catch (err) {
      console.error('Failed to load customer survey report:', err);
    } finally {
      setLoading(false);
    }
  }, [user, branchFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchSurveys();
  }, [fetchSurveys]);

  const stats = useMemo(() => {
    const total = surveys.length;
    const tours = surveys.filter((s) => s.tourGiven).length;
    const packages = surveys.filter((s) => s.packageGiven).length;
    const complaints = surveys.filter((s) => s.hasComplaint).length;
    return { total, tours, packages, complaints };
  }, [surveys]);

  const byBranch = useMemo(() => {
    const map = new Map();
    for (const s of surveys) {
      map.set(s.branch, (map.get(s.branch) || 0) + 1);
    }
    return [...map.entries()].map(([branch, count]) => ({ branch, count }));
  }, [surveys]);

  const answersByQuestion = useMemo(() => {
    return QUESTIONS.map((q) => ({
      ...q,
      answers: surveys
        .filter((s) => s[q.key] && s[q.key].trim())
        .map((s) => ({ text: s[q.key], customerName: s.customerName, date: s.date })),
    }));
  }, [surveys]);

  const sortedSurveys = useMemo(
    () => [...surveys].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [surveys]
  );

  const pct = (n) => (stats.total ? Math.round((n / stats.total) * 100) : 0);

  const dateRangeLabel = dateFrom && dateTo && dateFrom !== dateTo
    ? `${dateFrom}_to_${dateTo}`
    : (dateFrom || dateTo || 'all');

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Customer Loyalty Calls Report</h1>
          <p className="text-sm text-gray-500 dark:text-ink-400">How the check-in calls went, and what customers actually said</p>
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
        {sortedSurveys.length > 0 && (
          <button
            onClick={() =>
              exportToCSV(
                `customer-loyalty-calls-${dateRangeLabel}.csv`,
                sortedSurveys.map((s) => ({
                  Date: s.date,
                  Branch: s.branch,
                  Customer: s.customerName,
                  Phone: s.phone,
                  TourGiven: s.tourGiven ? 'Yes' : 'No',
                  PackageGiven: s.packageGiven ? 'Yes' : 'No',
                  HadComplaint: s.hasComplaint ? 'Yes' : 'No',
                  ComplaintNotes: s.complaintNotes || '',
                  Satisfaction: s.satisfaction || '',
                  QualityRating: s.qualityRating || '',
                  DesiredService: s.desiredService || '',
                  SuggestedChanges: s.suggestedChanges || '',
                  LoggedBy: s.createdByName || '',
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
      ) : surveys.length === 0 ? (
        <div className="bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 rounded-2xl p-10 flex flex-col items-center gap-2 text-slate-400 dark:text-ink-500 text-sm shadow-sm">
          <ClipboardCheck size={28} className="text-slate-300 dark:text-ink-600" />
          No loyalty calls found for this filter.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="group relative bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-400 to-brand-600" />
              <div className="p-3 bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/40 dark:to-brand-800/40 text-brand-600 dark:text-brand-300 rounded-xl border border-brand-100 dark:border-brand-700 group-hover:scale-105 transition-transform">
                <ClipboardCheck size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400 dark:text-ink-500 tracking-wide">Calls Made</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5 tabular-nums">{stats.total}</h3>
              </div>
            </div>
            <div className="group relative bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 to-sky-600" />
              <div className="p-3 bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-900/40 dark:to-sky-800/40 text-sky-600 dark:text-sky-400 rounded-xl border border-sky-100 dark:border-sky-800 group-hover:scale-105 transition-transform">
                <Compass size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400 dark:text-ink-500 tracking-wide">Tours Given</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5 tabular-nums">
                  {stats.tours} <span className="text-sm font-medium text-slate-400 dark:text-ink-500">({pct(stats.tours)}%)</span>
                </h3>
              </div>
            </div>
            <div className="group relative bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
              <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/40 dark:to-emerald-800/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-800 group-hover:scale-105 transition-transform">
                <Gift size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400 dark:text-ink-500 tracking-wide">Packages Given</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5 tabular-nums">
                  {stats.packages} <span className="text-sm font-medium text-slate-400 dark:text-ink-500">({pct(stats.packages)}%)</span>
                </h3>
              </div>
            </div>
            <div className="group relative bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-400 to-red-600" />
              <div className="p-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/40 dark:to-red-800/40 text-red-600 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-800 group-hover:scale-105 transition-transform">
                <MessageSquareWarning size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400 dark:text-ink-500 tracking-wide">Had a Complaint</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5 tabular-nums">
                  {stats.complaints} <span className="text-sm font-medium text-slate-400 dark:text-ink-500">({pct(stats.complaints)}%)</span>
                </h3>
              </div>
            </div>
          </div>

          {/* By branch */}
          {byBranch.length > 1 && (
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
          )}

          {/* Customer voices — the actual answers, grouped by question */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Quote className="text-brand-500" size={20} /> In Their Own Words
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {answersByQuestion.map((q) => (
                <div key={q.key} className="bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 rounded-2xl p-6 shadow-sm space-y-3">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-ink-200">{q.label}</h3>
                  {q.answers.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-ink-500">No answers recorded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {q.answers.map((a, i) => (
                        <div key={i} className="relative pl-4 border-l-2 border-brand-200 dark:border-brand-700">
                          <p className="text-sm text-slate-700 dark:text-ink-200 italic">&ldquo;{a.text}&rdquo;</p>
                          <p className="text-xs text-slate-400 dark:text-ink-500 mt-1">&mdash; {a.customerName}, {a.date}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Full calls table */}
          <div className="bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-700 dark:text-ink-200">All Calls</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-ink-700">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-ink-700 text-slate-500 dark:text-ink-400 text-xs uppercase bg-slate-50/70 dark:bg-ink-700/40">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Branch</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Tour</th>
                    <th className="py-3 px-3">Package</th>
                    <th className="py-3 px-3">Complaint</th>
                    <th className="py-3 px-3">Logged By</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSurveys.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 dark:border-ink-700 hover:bg-slate-50/80 dark:hover:bg-ink-700/40 transition">
                      <td className="py-3 px-3 text-slate-600 dark:text-ink-300">{s.date}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-ink-300">{s.branch}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800 dark:text-white">{s.customerName}</td>
                      <td className="py-3 px-3">{s.tourGiven ? '✓' : <span className="text-slate-300 dark:text-ink-600">—</span>}</td>
                      <td className="py-3 px-3">{s.packageGiven ? '✓' : <span className="text-slate-300 dark:text-ink-600">—</span>}</td>
                      <td className="py-3 px-3">
                        {s.hasComplaint ? (
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full border bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">
                            Yes
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-ink-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-ink-300">{s.createdByName || <span className="text-slate-300 dark:text-ink-600">—</span>}</td>
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
