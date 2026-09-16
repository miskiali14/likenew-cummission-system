'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';
import { Boxes, CheckCircle2, Clock, Calendar, Download, X, DollarSign, Wallet } from 'lucide-react';
import { DEAD_STOCK_GIVEN_OUT_COMMISSION } from '@/lib/commission';

const METHOD_LABEL = {
  IN_PERSON: 'Picked up in person',
  DELIVERY: 'Delivery personnel',
  INCLUDED_IN_ORDER: 'Included with order',
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

export default function DeadStockReportPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [items, setItems] = useState([]);

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

  const fetchReport = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const branchParam = branchFilter !== 'All' ? branchFilter : '';
      const res = await API.get(`/dead-stock/report?branch=${branchParam}&dateFrom=${dateFrom || ''}&dateTo=${dateTo || ''}`);
      setItems(res.data || []);
    } catch (err) {
      console.error('Failed to load dead stock report:', err);
    } finally {
      setLoading(false);
    }
  }, [user, branchFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const stats = useMemo(() => {
    const totalEntries = items.length;
    const totalQuantity = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
    const inStock = items.filter((it) => it.status === 'IN_STOCK');
    const givenOut = items.filter((it) => it.status === 'GIVEN_OUT');
    const inStockQty = inStock.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
    const givenOutQty = givenOut.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
    const givenOutRate = totalEntries > 0 ? (givenOut.length / totalEntries) * 100 : 0;
    const totalCommission = Number((givenOut.length * DEAD_STOCK_GIVEN_OUT_COMMISSION).toFixed(2));
    return { totalEntries, totalQuantity, inStockCount: inStock.length, inStockQty, givenOutCount: givenOut.length, givenOutQty, givenOutRate, totalCommission };
  }, [items]);

  const byUser = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      if (it.status !== 'GIVEN_OUT' || !it.givenOutById) continue;
      const entry = map.get(it.givenOutById) || { userId: it.givenOutById, name: it.givenOutByName || 'Unknown', count: 0 };
      entry.count += 1;
      map.set(it.givenOutById, entry);
    }
    return [...map.values()]
      .map((e) => ({ ...e, commission: Number((e.count * DEAD_STOCK_GIVEN_OUT_COMMISSION).toFixed(2)) }))
      .sort((a, b) => b.commission - a.commission);
  }, [items]);

  const byCategory = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const entry = map.get(it.category) || { category: it.category, count: 0, quantity: 0 };
      entry.count += 1;
      entry.quantity += Number(it.quantity || 0);
      map.set(it.category, entry);
    }
    return [...map.values()].sort((a, b) => b.quantity - a.quantity);
  }, [items]);

  const byBranch = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const entry = map.get(it.branch) || { branch: it.branch, count: 0, quantity: 0 };
      entry.count += 1;
      entry.quantity += Number(it.quantity || 0);
      map.set(it.branch, entry);
    }
    return [...map.values()];
  }, [items]);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [items]
  );

  const dateRangeLabel = dateFrom && dateTo && dateFrom !== dateTo
    ? `${dateFrom}_to_${dateTo}`
    : (dateFrom || dateTo || 'all');

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dead Stock Report</h1>
          <p className="text-sm text-gray-500">Old, uncollected orders — what's still sitting vs. what's gone back out</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
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
        {sortedItems.length > 0 && (
          <button
            onClick={() =>
              exportToCSV(
                `dead-stock-report-${dateRangeLabel}.csv`,
                sortedItems.map((it) => ({
                  Date: it.date,
                  Branch: it.branch,
                  OrderRef: it.orderId,
                  Category: it.category,
                  Quantity: it.quantity,
                  Status: it.status === 'GIVEN_OUT' ? 'Given Out' : 'In Stock',
                  LoggedBy: it.createdByName || '',
                  GivenOutBy: it.givenOutByName || '',
                  GivenOutMethod: METHOD_LABEL[it.givenOutMethod] || it.givenOutMethod || '',
                  GivenOutNotes: it.givenOutNotes || '',
                  Commission: it.status === 'GIVEN_OUT' ? DEAD_STOCK_GIVEN_OUT_COMMISSION.toFixed(2) : '0.00',
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
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-slate-400 text-sm shadow-sm">
          No dead stock entries found for this filter.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="p-3 bg-slate-50 text-slate-600 rounded-xl border border-slate-100">
                <Boxes size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400">Total Entries</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5">
                  {stats.totalEntries} <span className="text-sm font-medium text-slate-400">({stats.totalQuantity} pcs)</span>
                </h3>
              </div>
            </div>
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400">In Stock</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5">
                  {stats.inStockCount} <span className="text-sm font-medium text-slate-400">({stats.inStockQty} pcs)</span>
                </h3>
              </div>
            </div>
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400">Given Out</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5">
                  {stats.givenOutCount} <span className="text-sm font-medium text-slate-400">({stats.givenOutQty} pcs)</span>
                </h3>
              </div>
            </div>
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="p-3 bg-brand-50 text-brand-600 rounded-xl border border-brand-100">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400">Given Out Rate</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{stats.givenOutRate.toFixed(0)}%</h3>
              </div>
            </div>
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                <DollarSign size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400">Given-Out Commission</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5">${stats.totalCommission.toFixed(2)}</h3>
              </div>
            </div>
          </div>

          {/* Commission breakdown by person — separate from every other commission */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Wallet size={16} className="text-brand-600" />
              Commission by Person (${DEAD_STOCK_GIVEN_OUT_COMMISSION.toFixed(2)} per order given out)
            </div>
            {byUser.length === 0 ? (
              <p className="text-sm text-slate-400">No orders given out in this date range.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase bg-slate-50/70">
                      <th className="py-3 px-3">Name</th>
                      <th className="py-3 px-3 text-right">Orders Given Out</th>
                      <th className="py-3 px-3 text-right">Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byUser.map((u) => (
                      <tr key={u.userId} className="border-b border-slate-100 hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 font-semibold text-slate-800">{u.name}</td>
                        <td className="py-3 px-3 text-right text-slate-600">{u.count}</td>
                        <td className="py-3 px-3 text-right font-bold text-amber-700">${u.commission.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100/80 font-bold border-t border-slate-300">
                    <tr>
                      <td className="py-3 px-3 text-slate-800">Total</td>
                      <td className="py-3 px-3 text-right text-slate-900">{stats.givenOutCount}</td>
                      <td className="py-3 px-3 text-right text-amber-800">${stats.totalCommission.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Breakdown by category / branch */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-700">By Category</h3>
              <div className="space-y-2">
                {byCategory.map((c) => (
                  <div key={c.category} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{c.category}</span>
                    <span className="font-semibold text-slate-800">{c.count} entries — {c.quantity} pcs</span>
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
                    <span className="font-semibold text-slate-800">{b.count} entries — {b.quantity} pcs</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Full table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-700">All Entries</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase bg-slate-50/70">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Branch</th>
                    <th className="py-3 px-3">Order Ref</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-right">Qty</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Given Out By</th>
                    <th className="py-3 px-3 text-right">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((it) => (
                    <tr key={it.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 text-slate-600">{it.date}</td>
                      <td className="py-3 px-3 text-slate-600">{it.branch}</td>
                      <td className="py-3 px-3 font-extrabold text-slate-900">{it.orderId}</td>
                      <td className="py-3 px-3">
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {it.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-700">{it.quantity}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                            it.status === 'GIVEN_OUT'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {it.status === 'GIVEN_OUT' ? 'Given Out' : 'In Stock'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{it.givenOutByName || <span className="text-slate-300">—</span>}</td>
                      <td className="py-3 px-3 text-right font-bold text-amber-700">
                        {it.status === 'GIVEN_OUT' ? `$${DEAD_STOCK_GIVEN_OUT_COMMISSION.toFixed(2)}` : <span className="text-slate-300">—</span>}
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
