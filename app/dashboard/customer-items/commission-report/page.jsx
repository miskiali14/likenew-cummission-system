'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';
import { DollarSign, Package, Calendar, Download, X, Wallet } from 'lucide-react';

const COLLECTION_METHOD_LABEL = {
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

export default function CustomerItemCommissionReportPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState(null);

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
  }, [router]);

  const fetchReport = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await API.get(`/customer-items/commission?dateFrom=${dateFrom || ''}&dateTo=${dateTo || ''}`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load commission report:', err);
    } finally {
      setLoading(false);
    }
  }, [user, dateFrom, dateTo]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const isAdmin = user?.role === 'ADMIN';
  const items = data?.items || [];

  const dateRangeLabel = dateFrom && dateTo && dateFrom !== dateTo
    ? `${dateFrom}_to_${dateTo}`
    : (dateFrom || dateTo || 'all');

  const csvRows = useMemo(
    () =>
      items.map((it) => ({
        DateClaimed: it.claimedAt ? new Date(it.claimedAt).toISOString().split('T')[0] : '',
        CustomerID: it.customerId,
        CustomerName: it.customerName,
        Item: it.description,
        Branch: it.branch,
        ...(isAdmin ? { CollectedBy: it.claimedByName } : {}),
        CollectionMethod: COLLECTION_METHOD_LABEL[it.collectionMethod] || it.collectionMethod || '',
        Notes: it.collectionNotes || '',
        Commission: it.commission.toFixed(2),
      })),
    [items, isAdmin]
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Customer Item Commission Report</h1>
          <p className="text-sm text-gray-500">
            $0.50 per item collected — tracked entirely separately from washing/ironing commission
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
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
        {csvRows.length > 0 && (
          <button
            onClick={() => exportToCSV(`customer-item-commission-${dateRangeLabel}.csv`, csvRows)}
            className="flex items-center gap-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-700 transition ml-auto"
          >
            <Download size={16} /> Export CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading data...</div>
      ) : !data ? null : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                <DollarSign size={26} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400">
                  {isAdmin ? 'Total Commission' : 'Your Commission'}
                </p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5">
                  ${(isAdmin ? data.totalCommission : data.myCommission).toFixed(2)}
                </h3>
              </div>
            </div>
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="p-3 bg-brand-50 text-brand-600 rounded-xl border border-brand-100">
                <Package size={26} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400">
                  {isAdmin ? 'Total Items Claimed' : 'Your Items Claimed'}
                </p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5">
                  {isAdmin ? data.totalClaimedCount : data.myClaimedCount}
                </h3>
              </div>
            </div>
          </div>

          {/* Per-person breakdown — Admin only */}
          {isAdmin && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <Wallet size={16} className="text-brand-600" />
                Breakdown by Person
              </div>
              {data.byUser.length === 0 ? (
                <p className="text-sm text-slate-400">No items claimed in this date range.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase bg-slate-50/70">
                        <th className="py-3 px-3">Name</th>
                        <th className="py-3 px-3 text-right">Items Claimed</th>
                        <th className="py-3 px-3 text-right">Commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byUser.map((u) => (
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
                        <td className="py-3 px-3 text-right text-slate-900">{data.totalClaimedCount}</td>
                        <td className="py-3 px-3 text-right text-amber-800">${data.totalCommission.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Full claimed items history */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-700">
              {isAdmin ? 'All Claimed Items' : 'Your Claimed Items'}
            </h3>
            {items.length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-sm">No items claimed in this date range.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase bg-slate-50/70">
                      <th className="py-3 px-3">Date Claimed</th>
                      <th className="py-3 px-3">Customer</th>
                      <th className="py-3 px-3">Item</th>
                      <th className="py-3 px-3">Branch</th>
                      {isAdmin && <th className="py-3 px-3">Collected By</th>}
                      <th className="py-3 px-3">Method</th>
                      <th className="py-3 px-3">Notes</th>
                      <th className="py-3 px-3 text-right">Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 text-slate-600">
                          {it.claimedAt ? new Date(it.claimedAt).toISOString().split('T')[0] : '—'}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">{it.customerName}</td>
                        <td className="py-3 px-3 text-slate-600">{it.description}</td>
                        <td className="py-3 px-3 text-slate-600">{it.branch}</td>
                        {isAdmin && <td className="py-3 px-3 text-slate-600">{it.claimedByName}</td>}
                        <td className="py-3 px-3 text-slate-600">
                          {COLLECTION_METHOD_LABEL[it.collectionMethod] || it.collectionMethod}
                        </td>
                        <td className="py-3 px-3 text-slate-500 max-w-xs truncate" title={it.collectionNotes || ''}>
                          {it.collectionNotes || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-amber-700">${it.commission.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100/80 font-bold border-t border-slate-300">
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="py-3 px-3 text-slate-800">Total:</td>
                      <td className="py-3 px-3 text-right text-amber-800">
                        ${(isAdmin ? data.totalCommission : data.myCommission).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
