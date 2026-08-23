'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';
import { calculateOrderCommission } from '@/lib/commission';
import { getCommissionCountedIds } from '@/lib/duplicates';
import { Printer, FileText, Users } from 'lucide-react';

const SECTION_LABEL = { WASHING: 'Dhaqmo', IRONING: 'Feero' };
const RATE_LABEL = { WASHING: '$0.07 / $0.10 / $0.15', IRONING: '$0.10 / $0.15 / $0.20' };

// Commission ties to a 3-way tier (matches the actual rate calculation).
function commissionTierFor(qty) {
  if (qty <= 10) return '1–10';
  if (qty <= 20) return '11–20';
  return '20+';
}

// The order-size-mix tables split that same 1–10 tier into two rows for
// visibility, even though both share one rate.
function displayBandFor(qty) {
  if (qty <= 5) return '1 – 5 items';
  if (qty <= 10) return '6 – 10 items';
  if (qty <= 20) return '11 – 20 items';
  return 'More than 20 items';
}
const DISPLAY_BANDS = ['1 – 5 items', '6 – 10 items', '11 – 20 items', 'More than 20 items'];

function enumerateDates(from, to) {
  const dates = [];
  if (!from || !to) return dates;
  const cur = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function fmt(n, digits = 1) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtInt(n) {
  return Number(n).toLocaleString('en-US');
}
function fmtMoney(n) {
  return `$${Number(n).toFixed(2)}`;
}
function pct(part, whole) {
  if (!whole) return '0.0%';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [reportType, setReportType] = useState('weekly'); // 'weekly' | 'individual'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/login');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }
    setUser(parsedUser);

    // Default to the trailing 7 days, matching a typical weekly report.
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    setDateFrom(weekAgo.toISOString().split('T')[0]);
    setDateTo(today.toISOString().split('T')[0]);
  }, [router]);

  useEffect(() => {
    API.get('/employees')
      .then((res) => setEmployees(res.data || []))
      .catch((err) => console.error('Failed to load employees:', err));
  }, []);

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    if (reportType === 'individual' && !selectedEmployeeId) {
      setLogs([]);
      return;
    }
    setLoading(true);
    const employeeParam = reportType === 'individual' ? `&employeeId=${selectedEmployeeId}` : '';
    API.get(`/logs/all?dateFrom=${dateFrom}&dateTo=${dateTo}${employeeParam}`)
      .then((res) => setLogs(res.data || []))
      .catch((err) => console.error('Failed to load report data:', err))
      .finally(() => setLoading(false));
  }, [reportType, dateFrom, dateTo, selectedEmployeeId]);

  const dateRangeLabel = dateFrom && dateTo
    ? `${formatDateShort(dateFrom)} – ${formatDateShort(dateTo)} ${new Date(dateTo + 'T00:00:00Z').getUTCFullYear()}`
    : '';

  // ============================= WEEKLY REPORT =============================
  const weekly = useMemo(() => {
    if (reportType !== 'weekly' || logs.length === 0) return null;

    const countedIds = getCommissionCountedIds(logs);
    const commissionFor = (log) => (countedIds.has(log.id) ? calculateOrderCommission(log.quantity, log.department) : 0);

    const byStaff = new Map();
    for (const log of logs) {
      const key = `${log.staffName.trim().toLowerCase()}|${log.department}|${log.branch}`;
      if (!byStaff.has(key)) {
        byStaff.set(key, {
          staffName: log.staffName.trim(),
          department: log.department,
          branch: log.branch,
          tier1: 0,
          tier2: 0,
          tier3: 0,
          orders: 0,
          pieces: 0,
          commission: 0,
          days: new Set(),
        });
      }
      const s = byStaff.get(key);
      s.orders += 1;
      s.pieces += log.quantity;
      s.days.add(log.date);
      const tier = commissionTierFor(log.quantity);
      if (tier === '1–10') s.tier1 += 1;
      else if (tier === '11–20') s.tier2 += 1;
      else s.tier3 += 1;
      s.commission += commissionFor(log);
    }
    const staffRows = [...byStaff.values()]
      .map((s) => ({ ...s, daysWorked: s.days.size }))
      .sort((a, b) => b.commission - a.commission);

    const totalOrders = logs.length;
    const totalPieces = logs.reduce((sum, l) => sum + l.quantity, 0);
    const totalCommission = logs.reduce((sum, l) => sum + commissionFor(l), 0);
    const daysInRange = enumerateDates(dateFrom, dateTo).length || 1;
    const staffCount = staffRows.length;

    // Section (department) and branch splits
    const sectionMap = new Map();
    const branchMap = new Map();
    for (const log of logs) {
      if (!sectionMap.has(log.department)) sectionMap.set(log.department, { staff: new Set(), orders: 0, pieces: 0, commission: 0 });
      const sec = sectionMap.get(log.department);
      sec.staff.add(log.staffName.trim().toLowerCase());
      sec.orders += 1;
      sec.pieces += log.quantity;
      sec.commission += commissionFor(log);

      if (!branchMap.has(log.branch)) branchMap.set(log.branch, { staff: new Set(), orders: 0, pieces: 0, commission: 0 });
      const br = branchMap.get(log.branch);
      br.staff.add(log.staffName.trim().toLowerCase());
      br.orders += 1;
      br.pieces += log.quantity;
      br.commission += commissionFor(log);
    }
    const sectionRows = [...sectionMap.entries()].map(([dept, v]) => ({
      label: `${SECTION_LABEL[dept] || dept} (${dept === 'IRONING' ? 'ironing' : 'washing'})`,
      staff: v.staff.size,
      orders: v.orders,
      pieces: v.pieces,
      commission: v.commission,
    }));
    const branchRows = [...branchMap.entries()].map(([br, v]) => ({
      label: `${br} branch`,
      staff: v.staff.size,
      orders: v.orders,
      pieces: v.pieces,
      commission: v.commission,
    }));

    // Daily volume
    const dateMap = new Map();
    for (const log of logs) {
      if (!dateMap.has(log.date)) dateMap.set(log.date, { orders: 0, pieces: 0 });
      const d = dateMap.get(log.date);
      d.orders += 1;
      d.pieces += log.quantity;
    }
    const dailyRows = [...dateMap.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({ date, orders: v.orders, pieces: v.pieces }));
    const avgDailyPieces = totalPieces / dailyRows.length;

    // Order size mix, 4-band, whole operation
    const bandMap = new Map(DISPLAY_BANDS.map((b) => [b, { orders: 0, pieces: 0 }]));
    for (const log of logs) {
      const b = bandMap.get(displayBandFor(log.quantity));
      b.orders += 1;
      b.pieces += log.quantity;
    }
    const bandRows = DISPLAY_BANDS.map((b) => {
      const v = bandMap.get(b);
      return { band: b, orders: v.orders, pieces: v.pieces, avg: v.orders ? v.pieces / v.orders : 0 };
    });
    const bigOrders = logs.filter((l) => l.quantity >= 11);
    const bigOrdersPieces = bigOrders.reduce((s, l) => s + l.quantity, 0);

    // Auto-generated management notes
    const notes = [];
    if (staffRows.length >= 2) {
      const top = staffRows[0];
      const bottom = staffRows[staffRows.length - 1];
      notes.push(
        `Order size is assigned, not chosen. Commission rewards large orders, but supervisors decide who receives them. ${top.staffName} earned ${fmtMoney(top.commission)} and ${bottom.staffName} ${fmtMoney(bottom.commission)} — before treating that as a performance gap, check with the supervisors how bulk orders are allocated.`
      );
    }
    const disadvantaged = staffRows.filter((s) => s.tier3 === 0 && s.orders > 0);
    disadvantaged.forEach((s) => {
      const avgPieces = s.pieces / s.orders;
      notes.push(
        `${s.staffName} is structurally disadvantaged. ${s.orders} orders averaging ${fmt(avgPieces)} pieces, with zero orders above 20 items. Under a size-weighted scheme they cannot compete regardless of effort. Consider a floor based on total pieces.`
      );
    });
    const thinDays = dailyRows.filter((d) => d.pieces < avgDailyPieces * 0.6);
    thinDays.forEach((d) => {
      notes.push(
        `${formatDateShort(d.date)} is thin. ${d.orders} orders against a range average near ${Math.round(totalOrders / dailyRows.length)}. If that is a real half-day it is fine; if entries are missing, commission for that day is understated.`
      );
    });
    const missingMinutes = logs.filter((l) => l.durationMinutes == null).length;
    if (missingMinutes > 0) {
      notes.push(`Duration (Minutes) is missing on ${missingMinutes} of ${totalOrders} order lines this period — minutes-based figures for those lines cannot be reported.`);
    }

    return {
      staffRows,
      totalOrders,
      totalPieces,
      totalCommission,
      daysInRange,
      staffCount,
      sectionRows,
      branchRows,
      dailyRows,
      bandRows,
      bigOrders: bigOrders.length,
      bigOrdersPieces,
      notes,
    };
  }, [logs, reportType, dateFrom, dateTo]);

  // =========================== INDIVIDUAL REPORT ===========================
  const individual = useMemo(() => {
    if (reportType !== 'individual' || !selectedEmployee || logs.length === 0) return null;

    const countedIds = getCommissionCountedIds(logs);
    const commissionFor = (log) => (countedIds.has(log.id) ? calculateOrderCommission(log.quantity, log.department) : 0);

    const totalOrders = logs.length;
    const totalPieces = logs.reduce((sum, l) => sum + l.quantity, 0);
    const totalCommission = logs.reduce((sum, l) => sum + commissionFor(l), 0);
    const daysWorked = new Set(logs.map((l) => l.date)).size;
    const avgPiecesPerOrder = totalOrders ? totalPieces / totalOrders : 0;

    const minutesLogged = logs.filter((l) => l.durationMinutes != null);
    const totalMinutes = minutesLogged.reduce((s, l) => s + l.durationMinutes, 0);
    const hasMinutes = minutesLogged.length > 0;
    const piecesPerMinute = hasMinutes && totalMinutes > 0 ? totalPieces / totalMinutes : null;

    const allDates = enumerateDates(dateFrom, dateTo);
    const dateMap = new Map(allDates.map((d) => [d, { orders: 0, pieces: 0, minutes: 0, hasMinutes: false }]));
    for (const log of logs) {
      if (!dateMap.has(log.date)) dateMap.set(log.date, { orders: 0, pieces: 0, minutes: 0, hasMinutes: false });
      const d = dateMap.get(log.date);
      d.orders += 1;
      d.pieces += log.quantity;
      if (log.durationMinutes != null) {
        d.minutes += log.durationMinutes;
        d.hasMinutes = true;
      }
    }
    const dailyRows = [...dateMap.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    const missingDates = dailyRows.filter(([, v]) => v.orders === 0).map(([d]) => d);

    const shiftMap = new Map();
    for (const log of logs) {
      const label = log.shift === 'SHIFT_2' ? 'Shift 2' : 'Shift 1';
      if (!shiftMap.has(label)) shiftMap.set(label, { orders: 0, pieces: 0 });
      const s = shiftMap.get(label);
      s.orders += 1;
      s.pieces += log.quantity;
    }
    const shiftRows = [...shiftMap.entries()].map(([label, v]) => ({ label, ...v }));

    const bandMap = new Map(DISPLAY_BANDS.map((b) => [b, { orders: 0, pieces: 0 }]));
    for (const log of logs) {
      const b = bandMap.get(displayBandFor(log.quantity));
      b.orders += 1;
      b.pieces += log.quantity;
    }
    const bandRows = DISPLAY_BANDS.map((b) => {
      const v = bandMap.get(b);
      const rate = v.orders > 0 ? calculateOrderCommission(b === '1 – 5 items' ? 1 : b === '6 – 10 items' ? 10 : b === '11 – 20 items' ? 20 : 21, selectedEmployee.department) : 0;
      return {
        band: b,
        orders: v.orders,
        pieces: v.pieces,
        avg: v.orders ? v.pieces / v.orders : 0,
        rate,
        commission: v.orders * rate,
      };
    });

    const bigOrders = logs.filter((l) => l.quantity >= 11);
    const bigOrdersPieces = bigOrders.reduce((s, l) => s + l.quantity, 0);

    const register = [...logs].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    return {
      totalOrders,
      totalPieces,
      totalCommission,
      daysWorked,
      avgPiecesPerOrder,
      hasMinutes,
      totalMinutes,
      piecesPerMinute,
      dailyRows,
      missingDates,
      shiftRows,
      bandRows,
      bigOrders: bigOrders.length,
      bigOrdersPieces,
      register,
      missingMinutesCount: totalOrders - minutesLogged.length,
    };
  }, [logs, reportType, selectedEmployee, dateFrom, dateTo]);

  return (
    <div className="p-6 space-y-6">
      <style>{`
        @media print {
          aside, .no-print { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          body { background: #fff !important; }
          .print-page { box-shadow: none !important; border: none !important; padding: 0 !important; }
          table { break-inside: auto; }
          tr { break-inside: avoid; }
          h2 { break-after: avoid; }
        }
      `}</style>

      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
          <p className="text-sm text-gray-500">Generate a printable weekly overview or an individual staff record</p>
        </div>
      </div>

      {/* Controls */}
      <div className="no-print bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setReportType('weekly')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
              reportType === 'weekly' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users size={14} /> Weekly Operations Overview
          </button>
          <button
            onClick={() => setReportType('individual')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
              reportType === 'individual' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText size={14} /> Individual Staff Report
          </button>
        </div>

        {reportType === 'individual' && (
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 rounded-xl p-2.5 focus:outline-none cursor-pointer min-w-[220px]"
          >
            <option value="">Select a staff member...</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} — {emp.branch} · {emp.department === 'IRONING' ? 'Ironing' : 'Washing'}
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 rounded-xl p-2 focus:outline-none"
          />
          <span className="text-slate-400">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 rounded-xl p-2 focus:outline-none"
          />
        </div>

        {((reportType === 'weekly' && weekly) || (reportType === 'individual' && individual)) && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 py-2 text-sm font-medium transition ml-auto"
          >
            <Printer size={16} /> Print / Save as PDF
          </button>
        )}
      </div>

      {loading && <div className="p-8 text-center text-gray-500">Loading data...</div>}

      {reportType === 'weekly' && !loading && !weekly && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-slate-400 text-sm shadow-sm">
          No orders found for this date range.
        </div>
      )}

      {reportType === 'individual' && !loading && !selectedEmployee && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-slate-400 text-sm shadow-sm">
          Select a staff member above to generate their report.
        </div>
      )}

      {reportType === 'individual' && !loading && selectedEmployee && !individual && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-slate-400 text-sm shadow-sm">
          No orders found for {selectedEmployee.name} in this date range.
        </div>
      )}

      {/* ============================ WEEKLY REPORT ============================ */}
      {reportType === 'weekly' && weekly && (
        <div className="print-page bg-white border border-slate-200/80 rounded-2xl p-8 shadow-sm space-y-8 text-slate-800">
          <div>
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Likenew Smart Laundry</p>
            <h1 className="text-2xl font-bold mt-1">Weekly Operations Overview</h1>
            <p className="text-sm text-slate-500 italic mt-1">
              Management summary — all staff, both branches — {dateRangeLabel}
            </p>
          </div>

          <section>
            <h2 className="text-brand-700 font-bold text-lg mb-3">1. Week at a glance</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-2.5 border border-slate-200 font-semibold">Metric</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Value</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Per day</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-2.5 border border-slate-200">Staff with logged work</td><td className="p-2.5 border border-slate-200 text-right">{weekly.staffCount}</td><td className="p-2.5 border border-slate-200 text-right">—</td></tr>
                <tr><td className="p-2.5 border border-slate-200">Orders processed</td><td className="p-2.5 border border-slate-200 text-right">{fmtInt(weekly.totalOrders)}</td><td className="p-2.5 border border-slate-200 text-right">{fmt(weekly.totalOrders / weekly.daysInRange)}</td></tr>
                <tr><td className="p-2.5 border border-slate-200">Pieces (Quantity)</td><td className="p-2.5 border border-slate-200 text-right">{fmtInt(weekly.totalPieces)}</td><td className="p-2.5 border border-slate-200 text-right">{fmt(weekly.totalPieces / weekly.daysInRange)}</td></tr>
                <tr><td className="p-2.5 border border-slate-200">Average pieces per order</td><td className="p-2.5 border border-slate-200 text-right">{fmt(weekly.totalPieces / weekly.totalOrders)}</td><td className="p-2.5 border border-slate-200 text-right">—</td></tr>
                <tr><td className="p-2.5 border border-slate-200">Commission payable</td><td className="p-2.5 border border-slate-200 text-right">{fmtMoney(weekly.totalCommission)}</td><td className="p-2.5 border border-slate-200 text-right">{fmtMoney(weekly.totalCommission / weekly.daysInRange)}</td></tr>
                <tr><td className="p-2.5 border border-slate-200">Average commission per person</td><td className="p-2.5 border border-slate-200 text-right">{fmtMoney(weekly.totalCommission / weekly.staffCount)}</td><td className="p-2.5 border border-slate-200 text-right">—</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-brand-700 font-bold text-lg mb-1">2. Commission payable by person</h2>
            <p className="text-xs text-slate-500 mb-3">
              Ranked by amount owed. Ironing pays {RATE_LABEL.IRONING} per order for the 1–10, 11–20 and 20+ bands; washing pays {RATE_LABEL.WASHING}.
            </p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-2.5 border border-slate-200 font-semibold">Staff</th>
                  <th className="p-2.5 border border-slate-200 font-semibold">Section</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">1–10</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">11–20</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">20+</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Orders</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Pieces</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Commission</th>
                </tr>
              </thead>
              <tbody>
                {weekly.staffRows.map((s) => (
                  <tr key={`${s.staffName}-${s.department}-${s.branch}`}>
                    <td className="p-2.5 border border-slate-200">{s.staffName}</td>
                    <td className="p-2.5 border border-slate-200">{SECTION_LABEL[s.department]} {s.branch}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{s.tier1}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{s.tier2}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{s.tier3}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{s.orders}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmtInt(s.pieces)}</td>
                    <td className="p-2.5 border border-slate-200 text-right font-semibold">{fmtMoney(s.commission)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <td className="p-2.5 border border-slate-200" colSpan={2}>TOTAL</td>
                  <td className="p-2.5 border border-slate-200 text-right">{weekly.staffRows.reduce((s, r) => s + r.tier1, 0)}</td>
                  <td className="p-2.5 border border-slate-200 text-right">{weekly.staffRows.reduce((s, r) => s + r.tier2, 0)}</td>
                  <td className="p-2.5 border border-slate-200 text-right">{weekly.staffRows.reduce((s, r) => s + r.tier3, 0)}</td>
                  <td className="p-2.5 border border-slate-200 text-right">{weekly.totalOrders}</td>
                  <td className="p-2.5 border border-slate-200 text-right">{fmtInt(weekly.totalPieces)}</td>
                  <td className="p-2.5 border border-slate-200 text-right">{fmtMoney(weekly.totalCommission)}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-sm font-bold mt-2">Total commission payable this period: {fmtMoney(weekly.totalCommission)}</p>
          </section>

          <section>
            <h2 className="text-brand-700 font-bold text-lg mb-3">3. Output and workload</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-2.5 border border-slate-200 font-semibold">Staff</th>
                  <th className="p-2.5 border border-slate-200 font-semibold">Section</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Orders</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Pieces</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Days</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Orders/day</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Pieces/day</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Avg pieces/order</th>
                </tr>
              </thead>
              <tbody>
                {[...weekly.staffRows].sort((a, b) => b.orders - a.orders).map((s) => (
                  <tr key={`${s.staffName}-wl`}>
                    <td className="p-2.5 border border-slate-200">{s.staffName}</td>
                    <td className="p-2.5 border border-slate-200">{SECTION_LABEL[s.department]} {s.branch}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{s.orders}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmtInt(s.pieces)}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{s.daysWorked}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmt(s.orders / s.daysWorked)}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmt(s.pieces / s.daysWorked)}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmt(s.pieces / s.orders)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <td className="p-2.5 border border-slate-200" colSpan={2}>TOTAL</td>
                  <td className="p-2.5 border border-slate-200 text-right">{weekly.totalOrders}</td>
                  <td className="p-2.5 border border-slate-200 text-right">{fmtInt(weekly.totalPieces)}</td>
                  <td className="p-2.5 border border-slate-200 text-right"></td>
                  <td className="p-2.5 border border-slate-200 text-right"></td>
                  <td className="p-2.5 border border-slate-200 text-right"></td>
                  <td className="p-2.5 border border-slate-200 text-right">{fmt(weekly.totalPieces / weekly.totalOrders)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-brand-700 font-bold text-lg mb-3">4. Section and branch split</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-2.5 border border-slate-200 font-semibold">Group</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Staff</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Orders</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Pieces</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Share of pieces</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Commission</th>
                </tr>
              </thead>
              <tbody>
                {[...weekly.sectionRows, ...weekly.branchRows].map((r) => (
                  <tr key={r.label}>
                    <td className="p-2.5 border border-slate-200">{r.label}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{r.staff}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{r.orders}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmtInt(r.pieces)}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{pct(r.pieces, weekly.totalPieces)}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmtMoney(r.commission)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <td className="p-2.5 border border-slate-200">ALL STAFF</td>
                  <td className="p-2.5 border border-slate-200 text-right">{weekly.staffCount}</td>
                  <td className="p-2.5 border border-slate-200 text-right">{weekly.totalOrders}</td>
                  <td className="p-2.5 border border-slate-200 text-right">{fmtInt(weekly.totalPieces)}</td>
                  <td className="p-2.5 border border-slate-200 text-right">100.0%</td>
                  <td className="p-2.5 border border-slate-200 text-right">{fmtMoney(weekly.totalCommission)}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs italic text-slate-500 mt-2">Section rows and branch rows each cover all {weekly.staffCount} staff, counted two different ways — do not add them together.</p>
          </section>

          <section>
            <h2 className="text-brand-700 font-bold text-lg mb-3">5. Daily volume across the operation</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-2.5 border border-slate-200 font-semibold">Date</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Orders</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Pieces</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Share of period</th>
                </tr>
              </thead>
              <tbody>
                {weekly.dailyRows.map((d) => (
                  <tr key={d.date}>
                    <td className="p-2.5 border border-slate-200">{formatDateShort(d.date)}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{d.orders}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmtInt(d.pieces)}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{pct(d.pieces, weekly.totalPieces)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <td className="p-2.5 border border-slate-200">TOTAL</td>
                  <td className="p-2.5 border border-slate-200 text-right">{weekly.totalOrders}</td>
                  <td className="p-2.5 border border-slate-200 text-right">{fmtInt(weekly.totalPieces)}</td>
                  <td className="p-2.5 border border-slate-200 text-right">100.0%</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-brand-700 font-bold text-lg mb-3">6. Order size mix across the whole operation</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-2.5 border border-slate-200 font-semibold">Order size band</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Orders</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Share of orders</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Pieces</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Share of pieces</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Avg</th>
                </tr>
              </thead>
              <tbody>
                {weekly.bandRows.map((b) => (
                  <tr key={b.band}>
                    <td className="p-2.5 border border-slate-200">{b.band}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{b.orders}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{pct(b.orders, weekly.totalOrders)}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmtInt(b.pieces)}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{pct(b.pieces, weekly.totalPieces)}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmt(b.avg)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <td className="p-2.5 border border-slate-200">TOTAL</td>
                  <td className="p-2.5 border border-slate-200 text-right">{weekly.totalOrders}</td>
                  <td className="p-2.5 border border-slate-200 text-right">100.0%</td>
                  <td className="p-2.5 border border-slate-200 text-right">{fmtInt(weekly.totalPieces)}</td>
                  <td className="p-2.5 border border-slate-200 text-right">100.0%</td>
                  <td className="p-2.5 border border-slate-200 text-right">{fmt(weekly.totalPieces / weekly.totalOrders)}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs italic text-slate-500 mt-2">
              Concentration: {pct(weekly.bigOrders, weekly.totalOrders)} of orders were 11 items or more, but they carried {pct(weekly.bigOrdersPieces, weekly.totalPieces)} of all pieces. Small orders dominate the count; large orders dominate the actual work.
            </p>
          </section>

          {weekly.notes.length > 0 && (
            <section>
              <h2 className="text-brand-700 font-bold text-lg mb-3">7. Points for management</h2>
              <div className="space-y-2 text-sm">
                {weekly.notes.map((note, idx) => (
                  <p key={idx} className="text-slate-700">{note}</p>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ========================= INDIVIDUAL REPORT ========================= */}
      {reportType === 'individual' && individual && selectedEmployee && (
        <div className="print-page bg-white border border-slate-200/80 rounded-2xl p-8 shadow-sm space-y-8 text-slate-800">
          <div>
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Likenew Smart Laundry</p>
            <h1 className="text-2xl font-bold mt-1">{selectedEmployee.name}</h1>
            <p className="text-sm text-slate-500 italic">
              {selectedEmployee.department === 'IRONING' ? 'Ironing' : 'Washing'} Operator, {selectedEmployee.branch} Branch ({SECTION_LABEL[selectedEmployee.department]} {selectedEmployee.branch})
            </p>
            <p className="text-sm font-semibold mt-2">Individual Performance & Commission Record — {dateRangeLabel}</p>
          </div>

          <section>
            <h2 className="text-brand-700 font-bold text-lg mb-3">1. Summary</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-2.5 border border-slate-200 font-semibold">Metric</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Value</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Per working day</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-2.5 border border-slate-200">Orders processed</td><td className="p-2.5 border border-slate-200 text-right">{individual.totalOrders}</td><td className="p-2.5 border border-slate-200 text-right">{fmt(individual.totalOrders / individual.daysWorked)}</td></tr>
                <tr><td className="p-2.5 border border-slate-200">Pieces (Quantity)</td><td className="p-2.5 border border-slate-200 text-right">{fmtInt(individual.totalPieces)}</td><td className="p-2.5 border border-slate-200 text-right">{fmt(individual.totalPieces / individual.daysWorked)}</td></tr>
                <tr><td className="p-2.5 border border-slate-200">Minutes logged</td><td className="p-2.5 border border-slate-200 text-right" colSpan={2}>{individual.hasMinutes ? fmtInt(individual.totalMinutes) : 'not recorded'}</td></tr>
                <tr><td className="p-2.5 border border-slate-200">Days worked (of {enumerateDates(dateFrom, dateTo).length})</td><td className="p-2.5 border border-slate-200 text-right" colSpan={2}>{individual.daysWorked}</td></tr>
                <tr><td className="p-2.5 border border-slate-200">Average pieces per order</td><td className="p-2.5 border border-slate-200 text-right" colSpan={2}>{fmt(individual.avgPiecesPerOrder)}</td></tr>
                <tr><td className="p-2.5 border border-slate-200">Pieces per minute</td><td className="p-2.5 border border-slate-200 text-right" colSpan={2}>{individual.piecesPerMinute != null ? fmt(individual.piecesPerMinute, 2) : '—'}</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-brand-700 font-bold text-lg mb-3">2. Daily record, {dateRangeLabel}</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-2.5 border border-slate-200 font-semibold">Date</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Orders</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Pieces</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Minutes</th>
                </tr>
              </thead>
              <tbody>
                {individual.dailyRows.map(([date, v]) => (
                  <tr key={date}>
                    <td className="p-2.5 border border-slate-200">{formatDateShort(date)}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{v.orders || '—'}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{v.orders ? fmtInt(v.pieces) : '—'}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{v.hasMinutes ? fmtInt(v.minutes) : '—'}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <td className="p-2.5 border border-slate-200">TOTAL</td>
                  <td className="p-2.5 border border-slate-200 text-right">{individual.totalOrders}</td>
                  <td className="p-2.5 border border-slate-200 text-right">{fmtInt(individual.totalPieces)}</td>
                  <td className="p-2.5 border border-slate-200 text-right">{individual.hasMinutes ? fmtInt(individual.totalMinutes) : '—'}</td>
                </tr>
              </tbody>
            </table>
            {individual.missingDates.length > 0 && (
              <p className="text-xs italic text-slate-500 mt-2">
                No entries logged on: {individual.missingDates.map(formatDateShort).join(', ')}. Confirm whether these were rest days or unlogged work.
              </p>
            )}
          </section>

          <section>
            <h2 className="text-brand-700 font-bold text-lg mb-3">3. Shift breakdown</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-2.5 border border-slate-200 font-semibold">Shift</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Orders</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Pieces</th>
                </tr>
              </thead>
              <tbody>
                {individual.shiftRows.map((s) => (
                  <tr key={s.label}>
                    <td className="p-2.5 border border-slate-200">{s.label}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{s.orders}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmtInt(s.pieces)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-brand-700 font-bold text-lg mb-1">4. Order size breakdown (commission bands)</h2>
            <p className="text-xs text-slate-500 mb-3">
              Each order line is placed in a band by its Quantity. Commission is paid per order at the {selectedEmployee.department === 'IRONING' ? 'ironing' : 'washing'} rate for that band: orders × rate.
            </p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-2.5 border border-slate-200 font-semibold">Order size band</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Orders</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Share of orders</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Pieces</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Share of pieces</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Avg pieces/order</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Rate per order</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Commission</th>
                </tr>
              </thead>
              <tbody>
                {individual.bandRows.map((b) => (
                  <tr key={b.band}>
                    <td className="p-2.5 border border-slate-200">{b.band}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{b.orders}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{pct(b.orders, individual.totalOrders)}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmtInt(b.pieces)}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{pct(b.pieces, individual.totalPieces)}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmt(b.avg)}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{b.orders > 0 ? fmtMoney(b.rate) : '—'}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{fmtMoney(b.commission)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <td className="p-2.5 border border-slate-200">TOTAL</td>
                  <td className="p-2.5 border border-slate-200 text-right">{individual.totalOrders}</td>
                  <td className="p-2.5 border border-slate-200 text-right">100.0%</td>
                  <td className="p-2.5 border border-slate-200 text-right">{fmtInt(individual.totalPieces)}</td>
                  <td className="p-2.5 border border-slate-200 text-right">100.0%</td>
                  <td className="p-2.5 border border-slate-200 text-right">{fmt(individual.avgPiecesPerOrder)}</td>
                  <td className="p-2.5 border border-slate-200 text-right"></td>
                  <td className="p-2.5 border border-slate-200 text-right">{fmtMoney(individual.totalCommission)}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-sm font-bold mt-2">Commission earned this period: {fmtMoney(individual.totalCommission)}</p>
            <p className="text-xs italic text-slate-500 mt-2">
              {selectedEmployee.department === 'IRONING' ? 'Ironing' : 'Washing'} rates: 1–10 items {fmtMoney(individual.bandRows[0]?.rate || 0)} per order; 11–20 items {fmtMoney(individual.bandRows[2]?.rate || 0)} per order; more than 20 items {fmtMoney(individual.bandRows[3]?.rate || 0)} per order. The 1–5 and 6–10 rows are listed separately to show workload mix, but both sit in the same tier.
            </p>
            <p className="text-xs italic text-slate-500 mt-1">
              Large-order contribution: {individual.bigOrders} of {individual.totalOrders} orders ({pct(individual.bigOrders, individual.totalOrders)}) were 11 items or more, and those orders carried {fmtInt(individual.bigOrdersPieces)} of {fmtInt(individual.totalPieces)} pieces ({pct(individual.bigOrdersPieces, individual.totalPieces)}) of this person's total volume.
            </p>
          </section>

          <section>
            <h2 className="text-brand-700 font-bold text-lg mb-1">5. Full order register</h2>
            <p className="text-xs text-slate-500 mb-3">
              Every order line recorded against {selectedEmployee.name} between {formatDateShort(dateFrom)} and {formatDateShort(dateTo)} ({individual.register.length} lines). Branch: {selectedEmployee.branch}.
            </p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-2.5 border border-slate-200 font-semibold">Order ID</th>
                  <th className="p-2.5 border border-slate-200 font-semibold">Date</th>
                  <th className="p-2.5 border border-slate-200 font-semibold">Shift</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Qty</th>
                  <th className="p-2.5 border border-slate-200 font-semibold text-right">Mins</th>
                  <th className="p-2.5 border border-slate-200 font-semibold">Assigned By</th>
                </tr>
              </thead>
              <tbody>
                {individual.register.map((log) => (
                  <tr key={log.id}>
                    <td className="p-2.5 border border-slate-200">{log.orderId}</td>
                    <td className="p-2.5 border border-slate-200">{formatDateShort(log.date)}</td>
                    <td className="p-2.5 border border-slate-200">{log.shift === 'SHIFT_2' ? 'Shift 2' : 'Shift 1'}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{log.quantity}</td>
                    <td className="p-2.5 border border-slate-200 text-right">{log.durationMinutes ?? '—'}</td>
                    <td className="p-2.5 border border-slate-200">{log.assignedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {individual.missingMinutesCount > 0 && (
              <p className="text-xs italic text-slate-500 mt-2">
                Data quality: Duration (Minutes) is not filled in for {individual.missingMinutesCount} of this staff member's {individual.totalOrders} lines this period, so minutes-based figures cannot be fully reported.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
