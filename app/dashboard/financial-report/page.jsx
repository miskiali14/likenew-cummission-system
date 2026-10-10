'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Loader2, Inbox, DollarSign, Calendar, Download, TrendingUp, Package, X, User } from 'lucide-react';
import { calculateOrderCommission } from '@/lib/commission';
import { findDuplicateOrderKeys, getCommissionCountedIds } from '@/lib/duplicates';

const BRANCH_COLORS = { HQ: '#6d4698', KM5: '#d97706' };
const DEPT_COLORS = { WASHING: '#2563eb', IRONING: '#d97706' };

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

export default function FinancialReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState('All');
  const [department, setDepartment] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [rows, setRows] = useState([]);

  // Personal Staff Report — pick one employee, independent date range, full
  // order-by-order breakdown, downloadable on its own.
  const [employees, setEmployees] = useState([]);
  const [personalEmployeeId, setPersonalEmployeeId] = useState('');
  const [personalDateFrom, setPersonalDateFrom] = useState('');
  const [personalDateTo, setPersonalDateTo] = useState('');
  const [personalLogs, setPersonalLogs] = useState([]);
  const [personalLoading, setPersonalLoading] = useState(false);
  // Every order in this employee's branch & department (all staff, not just
  // this one) over the same date range — used to catch duplicates that exist
  // BETWEEN staff members, e.g. two different people both registering #123.
  const [personalContextLogs, setPersonalContextLogs] = useState([]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [router]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const branchParam = branch === 'All' ? '' : branch;
      const deptParam = department === 'All' ? '' : department;
      const res = await API.get(
        `/logs/staff-summary?branch=${branchParam}&department=${deptParam}&dateFrom=${dateFrom || ''}&dateTo=${dateTo || ''}`
      );
      setRows(res.data || []);
    } catch (err) {
      console.error('Failed to load financial report:', err);
    } finally {
      setLoading(false);
    }
  }, [branch, department, dateFrom, dateTo]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Load the full employee list once (all branches/departments) for the
  // personal-report staff picker.
  useEffect(() => {
    API.get('/employees')
      .then((res) => setEmployees(res.data || []))
      .catch((err) => console.error('Failed to load employees:', err));
  }, []);

  useEffect(() => {
    if (!personalEmployeeId) {
      setPersonalLogs([]);
      setPersonalContextLogs([]);
      return;
    }
    setPersonalLoading(true);
    API.get(
      `/logs/all?employeeId=${personalEmployeeId}&dateFrom=${personalDateFrom || ''}&dateTo=${personalDateTo || ''}`
    )
      .then((res) => setPersonalLogs(res.data || []))
      .catch((err) => console.error('Failed to load personal report:', err))
      .finally(() => setPersonalLoading(false));
  }, [personalEmployeeId, personalDateFrom, personalDateTo]);

  const selectedEmployee = employees.find((e) => e.id === personalEmployeeId);

  // Fetch every order in the same branch & department (all staff) so
  // duplicates can be detected even when the other side was registered by a
  // different staff member.
  useEffect(() => {
    if (!selectedEmployee) {
      setPersonalContextLogs([]);
      return;
    }
    API.get(
      `/logs/all?branch=${selectedEmployee.branch}&department=${selectedEmployee.department}&dateFrom=${personalDateFrom || ''}&dateTo=${personalDateTo || ''}`
    )
      .then((res) => setPersonalContextLogs(res.data || []))
      .catch((err) => console.error('Failed to load duplicate context:', err));
  }, [selectedEmployee, personalDateFrom, personalDateTo]);

  // Duplicate orders (same orderId/department/branch, whoever registered
  // them) only earn commission once, on whichever entry came first — decided
  // against the full branch/department context, not just this one staffer's
  // own list, since the other duplicate might belong to someone else.
  const commissionCountedIds = useMemo(() => getCommissionCountedIds(personalContextLogs), [personalContextLogs]);

  const personalTotals = useMemo(() => {
    return personalLogs.reduce(
      (acc, log) => ({
        orders: acc.orders + 1,
        items: acc.items + Number(log.quantity || 0),
        commission: acc.commission + (commissionCountedIds.has(log.id) ? calculateOrderCommission(log.quantity, log.department) : 0),
      }),
      { orders: 0, items: 0, commission: 0 }
    );
  }, [personalLogs, commissionCountedIds]);

  const personalDateRangeLabel = personalDateFrom && personalDateTo && personalDateFrom !== personalDateTo
    ? `${personalDateFrom}_to_${personalDateTo}`
    : (personalDateFrom || personalDateTo || 'all');

  // Orders with the same orderId/department/branch as another order in the
  // branch — whether registered twice by this same staffer, or by a
  // different one entirely (e.g. Hassan Nur and Qasim both logging #123).
  const personalDuplicateKeys = useMemo(() => findDuplicateOrderKeys(personalContextLogs), [personalContextLogs]);

  // For each duplicate key, the other staff name(s) sharing that order —
  // shown so it's clear this isn't just a self-duplicate.
  const otherStaffByDuplicateKey = useMemo(() => {
    const map = new Map();
    for (const log of personalContextLogs) {
      const key = `${log.orderId}|${log.department}|${log.branch}`;
      if (!personalDuplicateKeys.has(key)) continue;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(log.staffName);
    }
    return map;
  }, [personalContextLogs, personalDuplicateKeys]);

  const personalDuplicateOrderCount = useMemo(
    () => personalLogs.filter((log) => personalDuplicateKeys.has(`${log.orderId}|${log.department}|${log.branch}`)).length,
    [personalLogs, personalDuplicateKeys]
  );

  const overall = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        commission: acc.commission + Number(r.commissionEarned || 0),
        orders: acc.orders + Number(r.totalOrdersHandled || 0),
        items: acc.items + Number(r.totalQuantity || 0),
      }),
      { commission: 0, orders: 0, items: 0 }
    );
  }, [rows]);

  const byBranch = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.branch)) map.set(r.branch, { name: r.branch, commission: 0, orders: 0 });
      const g = map.get(r.branch);
      g.commission += Number(r.commissionEarned || 0);
      g.orders += Number(r.totalOrdersHandled || 0);
    }
    return Array.from(map.values());
  }, [rows]);

  const byDepartment = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.department)) map.set(r.department, { name: r.department, commission: 0, orders: 0 });
      const g = map.get(r.department);
      g.commission += Number(r.commissionEarned || 0);
      g.orders += Number(r.totalOrdersHandled || 0);
    }
    return Array.from(map.values());
  }, [rows]);

  const rankedByCommission = useMemo(() => {
    return [...rows].sort((a, b) => (b.commissionEarned || 0) - (a.commissionEarned || 0));
  }, [rows]);

  const dateRangeLabel = dateFrom && dateTo && dateFrom !== dateTo
    ? `${dateFrom}_to_${dateTo}`
    : (dateFrom || dateTo || 'all');

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Financial Report</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Commission earned across branches, departments, and staff</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-xl p-2 focus:outline-none cursor-pointer"
        >
          <option value="All">All Branches</option>
          <option value="HQ">HQ</option>
          <option value="KM5">KM5</option>
        </select>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-xl p-2 focus:outline-none cursor-pointer"
        >
          <option value="All">All Departments</option>
          <option value="WASHING">Washing</option>
          <option value="IRONING">Ironing</option>
        </select>
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3.5 py-2">
          <Calendar size={15} className="text-brand-500 dark:text-brand-400 shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
            />
          </div>
          <span className="w-3 h-px bg-slate-300 dark:bg-slate-600" />
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              title="Clear date range — show all dates"
              className="text-slate-400 dark:text-slate-500 hover:text-red-500 transition ml-1"
            >
              <X size={15} />
            </button>
          )}
        </div>
        {rankedByCommission.length > 0 && (
          <button
            onClick={() =>
              exportToCSV(
                `financial-report-${dateRangeLabel}.csv`,
                rankedByCommission.map((r, idx) => ({
                  Rank: idx + 1,
                  StaffName: r.staffName,
                  Branch: r.branch,
                  Department: r.department,
                  TotalOrders: r.totalOrdersHandled,
                  TotalItems: r.totalQuantity,
                  Commission: r.commissionEarned?.toFixed(2) ?? '',
                }))
              )
            }
            className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition ml-auto"
          >
            <Download size={16} /> Export CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-10 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500"><Loader2 size={28} className="animate-spin text-brand-500 dark:text-brand-400" /><span className="text-sm font-medium">Loading data...</span></div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-10 flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500 text-sm shadow-sm">
          <Inbox size={28} className="text-slate-300 dark:text-slate-600" />
          No commission data found for this filter.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="group relative bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
              <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/40 dark:to-emerald-800/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-800 group-hover:scale-105 transition-transform">
                <DollarSign size={26} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wide">Total Commission</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5 tabular-nums">${overall.commission.toFixed(2)}</h3>
              </div>
            </div>
            <div className="group relative bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-400 to-brand-600" />
              <div className="p-3 bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/40 dark:to-brand-800/40 text-brand-600 dark:text-brand-300 rounded-xl border border-brand-100 dark:border-brand-700 group-hover:scale-105 transition-transform">
                <TrendingUp size={26} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wide">Total Orders</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5 tabular-nums">{overall.orders}</h3>
              </div>
            </div>
            <div className="group relative bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-amber-600" />
              <div className="p-3 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/40 dark:to-amber-800/40 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-amber-800 group-hover:scale-105 transition-transform">
                <Package size={26} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wide">Total Items</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5 tabular-nums">{overall.items}</h3>
              </div>
            </div>
          </div>

          {/* Breakdown charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Commission by Branch</h3>
              <div className="w-full h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byBranch}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                    <Bar dataKey="commission" radius={[8, 8, 0, 0]}>
                      {byBranch.map((entry) => (
                        <Cell key={entry.name} fill={BRANCH_COLORS[entry.name] || '#6d4698'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Commission by Department</h3>
              <div className="w-full h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDepartment}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                    <Bar dataKey="commission" radius={[8, 8, 0, 0]}>
                      {byDepartment.map((entry) => (
                        <Cell key={entry.name} fill={DEPT_COLORS[entry.name] || '#2563eb'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Ranked staff table, sorted by commission earned */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Staff Ranked by Commission Earned</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase bg-slate-50/70 dark:bg-slate-700/40">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Staff Name</th>
                    <th className="py-3 px-3">Branch</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3 text-right">Total Orders</th>
                    <th className="py-3 px-3 text-right">Total Items</th>
                    <th className="py-3 px-3 text-right">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedByCommission.map((r, idx) => (
                    <tr key={`${r.staffName}-${r.branch}-${r.department}`} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition">
                      <td className="py-3 px-3 text-slate-400 dark:text-slate-500 font-semibold">{idx + 1}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800 dark:text-white">{r.staffName}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{r.branch}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                            r.department === 'IRONING'
                              ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                              : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                          }`}
                        >
                          {r.department}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-700 dark:text-slate-200">{r.totalOrdersHandled}</td>
                      <td className="py-3 px-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">{r.totalQuantity} Pcs</td>
                      <td className="py-3 px-3 text-right font-bold text-amber-700 dark:text-amber-400">${(r.commissionEarned || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100/80 dark:bg-slate-700/60 font-bold border-t border-slate-300 dark:border-slate-600">
                  <tr>
                    <td colSpan={4} className="py-3 px-3 text-slate-800 dark:text-white">Overall Total:</td>
                    <td className="py-3 px-3 text-right text-slate-900 dark:text-white">{overall.orders} Orders</td>
                    <td className="py-3 px-3 text-right text-emerald-700 dark:text-emerald-400">{overall.items} Pcs</td>
                    <td className="py-3 px-3 text-right text-amber-800 dark:text-amber-400">${overall.commission.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Personal Staff Report — select one staff member, own date range, full order history */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
          <div className="p-2.5 bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 rounded-xl border border-brand-100 dark:border-brand-700">
            <User size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Personal Staff Report</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Pick a staff member to see their full commission history</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={personalEmployeeId}
            onChange={(e) => setPersonalEmployeeId(e.target.value)}
            className="border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none cursor-pointer min-w-[220px]"
          >
            <option value="">Select a staff member...</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} — {emp.branch} · {emp.department === 'IRONING' ? 'Ironing' : 'Washing'}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3.5 py-2">
            <Calendar size={15} className="text-brand-500 dark:text-brand-400 shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">From</span>
              <input
                type="date"
                value={personalDateFrom}
                onChange={(e) => setPersonalDateFrom(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
              />
            </div>
            <span className="w-3 h-px bg-slate-300 dark:bg-slate-600" />
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">To</span>
              <input
                type="date"
                value={personalDateTo}
                onChange={(e) => setPersonalDateTo(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
              />
            </div>
            {(personalDateFrom || personalDateTo) && (
              <button
                onClick={() => { setPersonalDateFrom(''); setPersonalDateTo(''); }}
                title="Clear date range — show all dates"
                className="text-slate-400 dark:text-slate-500 hover:text-red-500 transition ml-1"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {personalEmployeeId && personalLogs.length > 0 && (
            <button
              onClick={() =>
                exportToCSV(
                  `${selectedEmployee?.name || 'staff'}-report-${personalDateRangeLabel}.csv`,
                  personalLogs.map((log) => ({
                    OrderID: log.orderId,
                    Date: log.date,
                    Branch: log.branch,
                    Department: log.department,
                    Quantity: log.quantity,
                    DurationMinutes: log.durationMinutes ?? '',
                    Commission: (commissionCountedIds.has(log.id) ? calculateOrderCommission(log.quantity, log.department) : 0).toFixed(2),
                    Duplicate: (() => {
                      const key = `${log.orderId}|${log.department}|${log.branch}`;
                      if (!personalDuplicateKeys.has(key)) return '';
                      const otherStaff = [...(otherStaffByDuplicateKey.get(key) || [])].filter(
                        (name) => name !== log.staffName
                      );
                      return otherStaff.length ? `Yes (also: ${otherStaff.join(', ')})` : 'Yes';
                    })(),
                  }))
                )
              }
              className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition ml-auto"
            >
              <Download size={16} /> Download
            </button>
          )}
        </div>

        {!personalEmployeeId ? (
          <div className="py-10 flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500 text-sm">
            <User size={28} className="text-slate-300 dark:text-slate-600" />
            Select a staff member above to view their personal report.
          </div>
        ) : personalLoading ? (
          <div className="p-10 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500"><Loader2 size={28} className="animate-spin text-brand-500 dark:text-brand-400" /><span className="text-sm font-medium">Loading data...</span></div>
        ) : personalLogs.length === 0 ? (
          <div className="py-10 flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500 text-sm">
            <Inbox size={28} className="text-slate-300 dark:text-slate-600" />
            No orders found for {selectedEmployee?.name} in this date range.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 p-4 rounded-xl">
                <p className="text-xs uppercase font-semibold text-slate-400 dark:text-slate-500">Total Orders</p>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mt-0.5">{personalTotals.orders}</h3>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 p-4 rounded-xl">
                <p className="text-xs uppercase font-semibold text-slate-400 dark:text-slate-500">Total Items</p>
                <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{personalTotals.items} Pcs</h3>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 p-4 rounded-xl">
                <p className="text-xs uppercase font-semibold text-slate-400 dark:text-slate-500">Total Commission</p>
                <h3 className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-0.5">${personalTotals.commission.toFixed(2)}</h3>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 p-4 rounded-xl">
                <p className="text-xs uppercase font-semibold text-slate-400 dark:text-slate-500">Duplicate Orders</p>
                <h3 className={`text-xl font-bold mt-0.5 ${personalDuplicateOrderCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>
                  {personalDuplicateOrderCount}
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase bg-slate-50/70 dark:bg-slate-700/40">
                    <th className="py-3 px-3">Order ID</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3 text-right">Quantity</th>
                    <th className="py-3 px-3 text-right">Duration</th>
                    <th className="py-3 px-3 text-right">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {personalLogs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition">
                      <td className="py-3 px-3 font-extrabold text-slate-900 dark:text-white">
                        #{log.orderId}
                        {(() => {
                          const key = `${log.orderId}|${log.department}|${log.branch}`;
                          if (!personalDuplicateKeys.has(key)) return null;
                          const otherStaff = [...(otherStaffByDuplicateKey.get(key) || [])].filter(
                            (name) => name !== log.staffName
                          );
                          return (
                            <span
                              className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 align-middle"
                              title={otherStaff.length ? `Also registered by: ${otherStaff.join(', ')}` : 'Registered more than once'}
                            >
                              Duplicate{otherStaff.length ? ` — also ${otherStaff.join(', ')}` : ''}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{log.date}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                            log.department === 'IRONING'
                              ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                              : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                          }`}
                        >
                          {log.department}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">{log.quantity} Pcs</td>
                      <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300">
                        {log.durationMinutes != null ? `${log.durationMinutes} Min` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {commissionCountedIds.has(log.id) ? (
                          <span className="font-bold text-amber-700 dark:text-amber-400">
                            ${calculateOrderCommission(log.quantity, log.department).toFixed(2)}
                          </span>
                        ) : (
                          <span className="font-bold text-slate-400 dark:text-slate-500" title="Duplicate order — commission not counted">
                            $0.00
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100/80 dark:bg-slate-700/60 font-bold border-t border-slate-300 dark:border-slate-600">
                  <tr>
                    <td colSpan={3} className="py-3 px-3 text-slate-800 dark:text-white">Overall Total:</td>
                    <td className="py-3 px-3 text-right text-emerald-700 dark:text-emerald-400">{personalTotals.items} Pcs</td>
                    <td className="py-3 px-3 text-right"></td>
                    <td className="py-3 px-3 text-right text-amber-800 dark:text-amber-400">${personalTotals.commission.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
