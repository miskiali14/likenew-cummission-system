'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import API from '../../lib/api';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import { 
  LogOut, 
  Shirt, 
  Flame, 
  ShoppingBag, 
  DollarSign, 
  RefreshCw, 
  Building2, 
  Send,
  Edit2,
  Clock,
  Filter,
  Users,
  Loader2,
  UserCheck,
  Trash2,
  Download
} from 'lucide-react';

const BRANCHES = [
  { id: 'All', name: 'All Branches' },
  { id: 'HQ', name: 'HQ Branch' },
  { id: 'KM5', name: 'KM5 Branch' },
];

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[1][0]).toUpperCase();
};

// Exports an array of flat objects to a downloaded CSV file.
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

// Groups a logs array (already sorted newest-first) by staff member, so a
// staff name isn't repeated on every order row — each group keeps its
// orders together under one name, ordered by that staff's most recent order.
const groupLogsByStaff = (logsArr) => {
  const map = new Map();
  logsArr.forEach((log) => {
    // Normalized (case/whitespace-insensitive) so accidental duplicate Employee
    // records for the same person (e.g. "hassan nur" vs "Hasan Nur") still merge.
    const key = (log.staffName || '').trim().toLowerCase();
    if (!map.has(key)) {
      map.set(key, { key, staffName: log.staffName.trim(), orders: [] });
    }
    map.get(key).orders.push(log);
  });
  return Array.from(map.values());
};

// Reusable Staff Work Summary / Leaderboard Report.
// Used by ADMIN (all staff, filterable) and by SALES / QUALITY_CONTROL users
// (scoped to their own branch & department) so everyone can see the report.
function StaffSummaryReport({
  staffSummary,
  title,
  subtitle,
  showBranchColumn = true,
  selectedDate,
  onDateChange,
}) {
  const showCommission = staffSummary.some((s) => s.commissionEarned !== undefined);

  const staffSummaryTotals = useMemo(() => {
    return staffSummary.reduce(
      (acc, item) => ({
        totalItems: acc.totalItems + Number(item.totalQuantity || 0),
        totalOrders: acc.totalOrders + Number(item.totalOrdersHandled || 0),
        totalMinutes: acc.totalMinutes + Number(item.totalDuration || 0),
      }),
      { totalItems: 0, totalOrders: 0, totalMinutes: 0 }
    );
  }, [staffSummary]);

  const rankedStaffSummary = useMemo(() => {
    return [...staffSummary].sort(
      (a, b) => Number(b.totalQuantity || 0) - Number(a.totalQuantity || 0)
    );
  }, [staffSummary]);

  const maxStaffQuantity = useMemo(() => {
    return Math.max(1, ...staffSummary.map((s) => Number(s.totalQuantity || 0)));
  }, [staffSummary]);

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl border border-brand-100">
            <Users size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">{title}</h2>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        {onDateChange && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none"
            />
          </div>
        )}
        {staffSummary.length > 0 && (
          <button
            onClick={() =>
              exportToCSV(
                `staff-report-${selectedDate || 'all'}.csv`,
                rankedStaffSummary.map((s) => ({
                  Rank: rankedStaffSummary.indexOf(s) + 1,
                  StaffName: s.staffName,
                  Department: s.department,
                  ...(showBranchColumn ? { Branch: s.branch } : {}),
                  TotalItems: s.totalQuantity,
                  TotalOrders: s.totalOrdersHandled,
                  TotalMinutes: s.totalDuration,
                  ...(s.commissionEarned !== undefined
                    ? { Commission: s.commissionEarned ?? '' }
                    : {}),
                }))
              )
            }
            className="flex items-center gap-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-700 transition"
          >
            <Download size={16} /> Export CSV
          </button>
        )}
        {staffSummary.length > 0 && (
          <div className="flex items-center gap-4 text-xs bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
            <span className="text-slate-500">
              Team Total: <b className="text-emerald-600">{staffSummaryTotals.totalItems} Pcs</b>
            </span>
            <span className="w-px h-4 bg-slate-200" />
            <span className="text-slate-500">
              <b className="text-slate-900">{staffSummaryTotals.totalOrders}</b> Orders
            </span>
            <span className="w-px h-4 bg-slate-200" />
            <span className="text-slate-500">
              <b className="text-brand-700">{staffSummaryTotals.totalMinutes}</b> Min
            </span>
          </div>
        )}
      </div>

      {staffSummary.length === 0 ? (
        <p className="text-center py-8 text-slate-400 text-sm">
          No staff summary data found for this filter.
        </p>
      ) : (
        <>
          {/* Top performer highlight cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rankedStaffSummary.slice(0, 3).map((staff, idx) => {
              const medal = ['🥇', '🥈', '🥉'][idx];
              const ringColor = ['ring-amber-300', 'ring-slate-300', 'ring-orange-300'][idx];
              const badgeColor = [
                'bg-amber-100 text-amber-700 border-amber-200',
                'bg-slate-100 text-slate-600 border-slate-200',
                'bg-orange-100 text-orange-700 border-orange-200',
              ][idx];
              return (
                <div
                  key={idx}
                  className={`relative rounded-2xl p-4 border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 ring-1 ${ringColor} shadow-sm`}
                >
                  <span className={`absolute -top-2.5 -right-2.5 text-xs font-bold px-2 py-1 rounded-full border shadow-sm ${badgeColor}`}>
                    {medal} #{idx + 1}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 shrink-0 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-sm">
                      {getInitials(staff.staffName)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{staff.staffName}</p>
                      <p className="text-[11px] text-slate-400">{staff.branch} &middot; {staff.department}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-2xl font-extrabold text-slate-900">{staff.totalQuantity}</span>
                    <span className="text-[11px] text-slate-400">pieces handled</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full"
                      style={{ width: `${(Number(staff.totalQuantity || 0) / maxStaffQuantity) * 100}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
                    <span>{staff.totalOrdersHandled} orders</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span>{staff.totalDuration} min</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ranking Graph */}
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rankedStaffSummary} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="staffName" width={110} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="totalQuantity" name="Pieces Handled" fill="#7c3aed" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Full ranked table */}
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase bg-slate-50/70">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">Staff Name</th>
                  <th className="py-3 px-3">Department</th>
                  {showBranchColumn && <th className="py-3 px-3">Branch</th>}
                  <th className="py-3 px-3">Performance</th>
                  <th className="py-3 px-3 text-right">Total Items</th>
                  <th className="py-3 px-3 text-right">Total Orders</th>
                  <th className="py-3 px-3 text-right">Total Minutes</th>
                  {showCommission && <th className="py-3 px-3 text-right">Commission</th>}
                </tr>
              </thead>
              <tbody>
                {rankedStaffSummary.map((staff, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 text-slate-400 font-semibold">{idx + 1}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 shrink-0 rounded-full bg-brand-50 text-brand-700 border border-brand-100 flex items-center justify-center text-[10px] font-bold">
                          {getInitials(staff.staffName)}
                        </div>
                        <span className="font-semibold text-slate-800">{staff.staffName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                          staff.department === 'IRONING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {staff.department}
                      </span>
                    </td>
                    {showBranchColumn && <td className="py-3 px-3 text-slate-600">{staff.branch}</td>}
                    <td className="py-3 px-3">
                      <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full"
                          style={{ width: `${(Number(staff.totalQuantity || 0) / maxStaffQuantity) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-600">{staff.totalQuantity} Pcs</td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-700">{staff.totalOrdersHandled} Orders</td>
                    <td className="py-3 px-3 text-right font-semibold text-brand-700">{staff.totalDuration} Min</td>
                    {showCommission && (
                      <td className="py-3 px-3 text-right font-bold text-amber-700">
                        {staff.commissionEarned != null ? staff.commissionEarned.toFixed(2) : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100/80 font-bold border-t border-slate-300">
                <tr>
                  <td colSpan={showBranchColumn ? 5 : 4} className="py-3 px-3 text-slate-800">Overall Report Total:</td>
                  <td className="py-3 px-3 text-right text-emerald-700">{staffSummaryTotals.totalItems} Pcs</td>
                  <td className="py-3 px-3 text-right text-slate-900">{staffSummaryTotals.totalOrders} Orders</td>
                  <td className="py-3 px-3 text-right text-brand-800">{staffSummaryTotals.totalMinutes} Min</td>
                  {showCommission && (
                    <td className="py-3 px-3 text-right text-amber-800">
                      {rankedStaffSummary
                        .reduce((sum, s) => sum + (s.commissionEarned || 0), 0)
                        .toFixed(2)}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedDate, setSelectedDate] = useState('');
  const [stats, setStats] = useState({ washing: 0, ironing: 0, totalOrders: 0, totalCommission: 0 });
  const [logs, setLogs] = useState([]);
  const [staffSummary, setStaffSummary] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [registrars, setRegistrars] = useState([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Personal My Logs State
  const [myLogsData, setMyLogsData] = useState({
    staffName: '',
    totalQuantity: 0,
    totalDuration: 0,
    totalOrdersHandled: 0,
    logs: []
  });

  // Full order edit modal state
  const [editingOrderLog, setEditingOrderLog] = useState(null);
  const [editOrderForm, setEditOrderForm] = useState({
    orderId: '',
    quantity: '',
    shift: 'SHIFT_1',
    employeeId: '',
    durationMinutes: '',
  });
  const [editOrderEmployees, setEditOrderEmployees] = useState([]);
  const [savingOrderEdit, setSavingOrderEdit] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    orderId: '',
    quantity: '',
    date: '',
    registrarId: '',
    shift: 'SHIFT_1',
    employeeId: '',
    durationMinutes: '',
  });

  // Hydration Safe Today Date
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData((prev) => ({ ...prev, date: today }));
    setSelectedDate(today);
  }, []);

  // 1. Initial User Load & Authentication Check
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!storedToken) {
      router.push('/login');
      return;
    }

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);

        if (parsedUser.role !== 'ADMIN') {
          setSelectedBranch(parsedUser.branch || 'HQ');
        }
      } catch (e) {
        console.error('Error parsing stored user', e);
      }
    }
    setAuthLoading(false);
  }, [router]);

  // Dynamic Staff Memoization
  const currentBranch = user?.branch || 'HQ';
  const currentDept = user?.role === 'QUALITY_CONTROL' ? 'IRONING' : 'WASHING';
  // Sales/QC can only edit or delete orders registered today; Admin has no such limit.
  const todayStr = new Date().toISOString().split('T')[0];

  // Fetch real Employees for this branch/department (replaces the old hardcoded staff list)
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await API.get(`/employees?branch=${currentBranch}&department=${currentDept}`);
      setEmployees(res.data || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  }, [currentBranch, currentDept]);

  // Fetch real Registrars ("Assigned By") for this branch/role
  const fetchRegistrars = useCallback(async () => {
    try {
      const res = await API.get(`/registrars?branch=${currentBranch}&role=${user?.role}`);
      setRegistrars(res.data || []);
    } catch (err) {
      console.error('Error fetching registrars:', err);
    }
  }, [currentBranch, user?.role]);

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      fetchEmployees();
      fetchRegistrars();
    }
  }, [user, fetchEmployees, fetchRegistrars]);

  // Update default staff selection in form when the employee list changes
  useEffect(() => {
    if (employees.length > 0) {
      setFormData((prev) => ({
        ...prev,
        employeeId: prev.employeeId && employees.some((e) => e.id === prev.employeeId)
          ? prev.employeeId
          : employees[0].id,
      }));
    }
  }, [employees]);

  // Update default registrar selection in form when the registrar list changes
  useEffect(() => {
    if (registrars.length > 0) {
      setFormData((prev) => ({
        ...prev,
        registrarId: prev.registrarId && registrars.some((r) => r.id === prev.registrarId)
          ? prev.registrarId
          : registrars[0].id,
      }));
    }
  }, [registrars]);

  // Admin Data Fetching
  const fetchAdminDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const branchParam = selectedBranch === 'All' ? '' : selectedBranch;
      const deptParam = selectedDept === 'All' ? '' : selectedDept;
      const dateParam = selectedDate || '';

      const results = await Promise.allSettled([
        API.get(`/logs/stats?branch=${branchParam}`),
        API.get(`/logs/all?branch=${branchParam}&department=${deptParam}`),
        API.get(`/logs/staff-summary?branch=${branchParam}&department=${deptParam}&date=${dateParam}`)
      ]);

      if (results[0].status === 'fulfilled') {
        const statsData = results[0].value.data;
        setStats({
          washing: statsData?.washing || 0,
          ironing: statsData?.ironing || 0,
          totalOrders: statsData?.totalOrders || 0,
          totalCommission: statsData?.totalCommission || 0,
        });
      }

      if (results[1].status === 'fulfilled') {
        setLogs(results[1].value.data || []);
      }

      if (results[2].status === 'fulfilled') {
        setStaffSummary(results[2].value.data || []);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, selectedDept, selectedDate]);

  // Safe Staff Data Fetching
  const fetchRoleLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const endpoint = user.role === 'QUALITY_CONTROL' ? '/logs/ironing' : '/logs/washing';
      const res = await API.get(`${endpoint}?branch=${currentBranch}`);
      setLogs(res.data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  }, [user, currentBranch]);

  // Fetching Personal Logs for whichever Registrar is currently selected
  // in the "Assigned By" dropdown (/logs/my-logs?registrarId=...)
  const fetchMyLogs = useCallback(async () => {
    if (!formData.registrarId) return;

    try {
      const res = await API.get("/logs/my-logs", { params: { registrarId: formData.registrarId } });
      const data = res.data || {};

      setMyLogsData({
        staffName: data.staffName || "",
        totalQuantity: data.totalQuantity || 0,
        totalDuration: data.totalDuration || 0,
        totalOrdersHandled: data.totalOrdersHandled || 0,
        logs: data.logs || [],
      });
    } catch (err) {
      console.error("MY LOGS ERROR:", err.response?.data || err.message);
    }
  }, [formData.registrarId]);

  // Fetching the Staff Summary Report for SALES / QUALITY_CONTROL users,
  // scoped to their own branch & department, so they also see the report.
  const fetchMyBranchStaffSummary = useCallback(async () => {
    try {
      const res = await API.get(
        `/logs/staff-summary?branch=${currentBranch}&department=${currentDept}&date=${selectedDate || ''}`
      );
      setStaffSummary(res.data || []);
    } catch (err) {
      const debugInfo = `URL: ${err.config?.url}\nStatus: ${err.response?.status}\nBackend message: ${JSON.stringify(err.response?.data)}`;
      console.error(debugInfo);
      alert('STAFF SUMMARY DEBUG:\n\n' + debugInfo);
    }
  }, [currentBranch, currentDept, selectedDate]);

  // Main Effect for fetching Dashboard Data
  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') {
        fetchAdminDashboardData();
      } else {
        fetchRoleLogs();
        fetchMyLogs();
        fetchMyBranchStaffSummary();
      }
    }
  }, [user, selectedBranch, selectedDept, selectedDate, formData.registrarId, fetchAdminDashboardData, fetchRoleLogs, fetchMyLogs, fetchMyBranchStaffSummary]);

  // Calculated Totals for Reports
  const logsTotals = useMemo(() => {
    return logs.reduce(
      (acc, item) => ({
        totalQuantity: acc.totalQuantity + Number(item.quantity || 0),
        totalMinutes: acc.totalMinutes + Number(item.durationMinutes || 0),
      }),
      { totalQuantity: 0, totalMinutes: 0 }
    );
  }, [logs]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const handleSubmitLog = async (e) => {
    e.preventDefault();

    const orderIdNum = Number(formData.orderId);
    const quantityNum = Number(formData.quantity);

    if (!orderIdNum || !quantityNum) {
      alert('Please enter valid positive numbers for Order ID and Quantity!');
      return;
    }

    if (!formData.employeeId) {
      alert('Please select a staff member!');
      return;
    }

    if (!formData.registrarId) {
      alert('Please select who is registering this (Assigned By)!');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        orderId: orderIdNum,
        quantity: quantityNum,
        date: formData.date,
        registrarId: formData.registrarId,
        shift: formData.shift,
        employeeId: formData.employeeId,
        durationMinutes: formData.durationMinutes === '' ? null : Number(formData.durationMinutes),
      };

      await API.post('/logs', payload);

      setFormData((prev) => ({
        ...prev,
        orderId: '',
        quantity: '',
        durationMinutes: '',
      }));

      alert('Log saved successfully!');
      fetchRoleLogs();
      fetchMyLogs();
      fetchMyBranchStaffSummary();
    } catch (err) {
      console.error('API Error Response:', err.response?.data);
      alert(err.response?.data?.message || 'An error occurred while saving the log');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditOrderModal = async (log) => {
    setEditingOrderLog(log);
    setEditOrderForm({
      orderId: log.orderId,
      quantity: log.quantity,
      shift: log.shift,
      employeeId: log.employeeId || '',
      durationMinutes: log.durationMinutes ?? '',
    });
    try {
      const res = await API.get(`/employees?branch=${log.branch}&department=${log.department}`);
      setEditOrderEmployees(res.data || []);
    } catch (err) {
      setEditOrderEmployees([]);
    }
  };

  const closeEditOrderModal = () => {
    setEditingOrderLog(null);
    setEditOrderEmployees([]);
  };

  const handleSaveOrderEdit = async (e) => {
    e.preventDefault();
    if (!editingOrderLog) return;

    setSavingOrderEdit(true);
    try {
      await API.patch(`/logs/${editingOrderLog.id}`, {
        orderId: Number(editOrderForm.orderId),
        quantity: Number(editOrderForm.quantity),
        shift: editOrderForm.shift,
        employeeId: editOrderForm.employeeId,
        durationMinutes: editOrderForm.durationMinutes === '' ? null : Number(editOrderForm.durationMinutes),
      });
      closeEditOrderModal();
      if (user?.role === 'ADMIN') {
        fetchAdminDashboardData();
      } else {
        fetchRoleLogs();
        fetchMyLogs();
        fetchMyBranchStaffSummary();
      }
    } catch (err) {
      console.error('Update Error:', err.response?.data);
      alert(err.response?.data?.message || 'An error occurred while saving the order');
    } finally {
      setSavingOrderEdit(false);
    }
  };

  const handleDeleteLog = async (logId) => {
    if (!confirm('Are you sure you want to delete this log? This action cannot be undone.')) return;

    try {
      await API.delete(`/logs/${logId}`);
      if (user?.role === 'ADMIN') {
        fetchAdminDashboardData();
      } else {
        fetchRoleLogs();
        fetchMyLogs();
        fetchMyBranchStaffSummary();
      }
    } catch (err) {
      console.error('Delete Error:', err.response?.data);
      alert(err.response?.data?.message || 'An error occurred while deleting the log');
    }
  };

  const chartData = [
    { name: 'Washing Department', Logs: stats.washing },
    { name: 'Ironing Department', Logs: stats.ironing },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-600" size={36} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      {/* Top Header */}
      <header className="max-w-7xl mx-auto flex justify-between items-center gap-4 pb-6 border-b border-slate-200 bg-white p-5 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <span className="text-slate-900">LIKE NEW</span>
            <span className="text-xs px-3 py-1 rounded-full font-semibold text-brand-700 bg-brand-100 border border-brand-200">
              {user?.role || 'STAFF'}
            </span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Welcome back, <span className="text-slate-900 font-medium">{user?.fullName || 'User'}</span> 
            {user?.role !== 'ADMIN' && (
              <span className="ml-2 font-bold text-slate-700">({currentBranch})</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {user?.role === 'ADMIN' && (
            <>
              {/* Branch Filter Dropdown */}
              <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2">
                <Building2 size={18} className="text-slate-500" />
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none cursor-pointer"
                >
                  {BRANCHES.map((b) => (
                    <option key={b.id} value={b.id} className="bg-white text-slate-800">
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => fetchAdminDashboardData()}
                className="p-2.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded-xl text-slate-600 transition"
                title="Refresh Data"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
            </>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-xl transition text-sm font-medium"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto mt-8 space-y-8">
        {/* ADMIN DASHBOARD VIEW */}
        {user?.role === 'ADMIN' && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                  <Shirt size={28} />
                </div>
                <div>
                  <p className="text-xs uppercase font-semibold text-slate-400">Washing Logs</p>
                  <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{stats.washing}</h3>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                  <Flame size={28} />
                </div>
                <div>
                  <p className="text-xs uppercase font-semibold text-slate-400">Ironing Logs</p>
                  <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{stats.ironing}</h3>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
                <div className="p-3 bg-brand-50 text-brand-600 rounded-xl border border-brand-100">
                  <ShoppingBag size={28} />
                </div>
                <div>
                  <p className="text-xs uppercase font-semibold text-slate-400">Total Orders</p>
                  <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{stats.totalOrders}</h3>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                  <DollarSign size={28} />
                </div>
                <div>
                  <p className="text-xs uppercase font-semibold text-slate-400">Total Commission</p>
                  <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{stats.totalCommission.toFixed(2)}</h3>
                </div>
              </div>
            </div>

            {/* Chart Graph */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Registration Analytics ({selectedBranch})</h2>
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Logs" fill="#8884d2" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* STAFF SUMMARY — LEADERBOARD (all staff, admin-filterable) */}
            <StaffSummaryReport
              staffSummary={staffSummary}
              title="Staff Work Summary Report"
              subtitle="Total items, orders, and duration processed by each staff member"
              showBranchColumn={true}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
            />

            {/* ALL LOGS TABLE FOR ADMIN */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">All Registered Logs</h2>
                  <p className="text-xs text-slate-500">View and manage all registered logs from KM5 and HQ branches</p>
                </div>

                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-slate-500" />
                  <span className="text-xs font-semibold text-slate-600">Department:</span>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 rounded-xl p-2 focus:outline-none cursor-pointer"
                  >
                    <option value="All">All Departments</option>
                    <option value="WASHING">Washing</option>
                    <option value="IRONING">Ironing</option>
                  </select>
                  {logs.length > 0 && (
                    <button
                      onClick={() =>
                        exportToCSV(
                          `all-logs-${new Date().toISOString().split('T')[0]}.csv`,
                          logs.map((item) => ({
                            OrderID: item.orderId,
                            Branch: item.branch,
                            Department: item.department,
                            Staff: item.staffName,
                            Quantity: item.quantity,
                            DurationMinutes: item.durationMinutes,
                            AssignedBy: item.assignedBy,
                            Date: item.date,
                          }))
                        )
                      }
                      className="flex items-center gap-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition"
                    >
                      <Download size={16} /> Export CSV
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase bg-slate-50/50">
                      <th className="py-3 px-3">Order ID</th>
                      <th className="py-3 px-3">Branch</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3">Staff</th>
                      <th className="py-3 px-3">Qty</th>
                      <th className="py-3 px-3">Duration</th>
                      <th className="py-3 px-3">Assigned By</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="text-center py-6 text-slate-400">
                          No log records found.
                        </td>
                      </tr>
                    ) : (
                      groupLogsByStaff(logs).flatMap((group) =>
                        group.orders.map((item, idx) => (
                          <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                            <td className="py-3 px-3 font-semibold text-slate-800">#{item.orderId}</td>
                            <td className="py-3 px-3">
                              <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                {item.branch || 'HQ'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                                  item.department === 'IRONING'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}
                              >
                                {item.department}
                              </span>
                            </td>
                            {idx === 0 && (
                              <td
                                className="py-3 px-3 font-medium text-slate-700 align-top border-l border-slate-100"
                                rowSpan={group.orders.length}
                              >
                                {group.staffName}
                                {group.orders.length > 1 && (
                                  <span className="ml-1.5 text-[11px] font-semibold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full">
                                    {group.orders.length} orders
                                  </span>
                                )}
                              </td>
                            )}
                            <td className="py-3 px-3">{item.quantity}</td>
                            <td className="py-3 px-3">
                              <span className="flex items-center gap-1 text-slate-600">
                                <Clock size={14} className="text-slate-400" />
                                {item.durationMinutes != null ? `${item.durationMinutes} Min` : (
                                  <span className="text-slate-400 italic">Not set</span>
                                )}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-500">{item.assignedBy}</td>
                            <td className="py-3 px-3 text-slate-500">{item.date}</td>
                            <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => openEditOrderModal(item)}
                                    className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"
                                    title="Edit Order"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLog(item.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                    title="Delete Log"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                            </td>
                          </tr>
                        ))
                      )
                    )}
                  </tbody>
                  {logs.length > 0 && (
                    <tfoot className="bg-slate-100/80 font-bold border-t border-slate-300">
                      <tr>
                        <td colSpan="4" className="py-3 px-3 text-slate-800">Total ({logs.length} Log Entries):</td>
                        <td className="py-3 px-3 text-emerald-700">{logsTotals.totalQuantity} Pcs</td>
                        <td className="py-3 px-3 text-brand-800">{logsTotals.totalMinutes} Min</td>
                        <td colSpan="3"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}

        {/* STAFF (SALES / QUALITY CONTROL) DASHBOARD */}
        {user?.role !== 'ADMIN' && (
          <div className="space-y-8">
            {/* Form */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <div className="border-b border-slate-100 pb-3 mb-5 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800">
                  Register New Log ({user?.role === 'QUALITY_CONTROL' ? 'Ironing' : 'Washing'})
                </h2>
                <span className="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded-lg font-semibold border border-slate-200">
                  Branch: {currentBranch}
                </span>
              </div>

              <form onSubmit={handleSubmitLog} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">1. Order ID</label>
                  <input
                    type="number"
                    required
                    placeholder="E.g. 1024"
                    value={formData.orderId}
                    onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">2. Quantity</label>
                  <input
                    type="number"
                    required
                    placeholder="E.g. 12"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">3. Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">4. Assigned By</label>
                  <select
                    required
                    value={formData.registrarId}
                    onChange={(e) => setFormData({ ...formData, registrarId: e.target.value })}
                    className="w-full border border-slate-200 bg-white rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none cursor-pointer"
                  >
                    {registrars.length === 0 && <option value="">No one found — add one first</option>}
                    {registrars.map((reg) => (
                      <option key={reg.id} value={reg.id}>
                        {reg.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">5. Shift</label>
                  <select
                    value={formData.shift}
                    onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none cursor-pointer"
                  >
                    <option value="SHIFT_1">SHIFT 1</option>
                    <option value="SHIFT_2">SHIFT 2</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">6. Staff Member ({currentBranch})</label>
                  <select
                    required
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="w-full border border-slate-200 bg-white rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none cursor-pointer"
                  >
                    {employees.length === 0 && <option value="">No employees found — add one first</option>}
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">7. Duration (Min) — optional</label>
                  <input
                    type="number"
                    placeholder="Leave blank if not known yet"
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2 lg:col-span-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                  >
                    <Send size={16} />
                    <span>{submitting ? 'Saving...' : 'Save Log'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* MY LOGS PERSONAL STATS */}
            {myLogsData.staffName && (
              <div className="bg-gradient-to-br from-brand-800 to-brand-900 text-white rounded-2xl p-6 shadow-md border border-brand-800/50 space-y-4">
                <div className="flex items-center gap-3 border-b border-brand-700/50 pb-3">
                  <UserCheck className="text-brand-300" size={24} />
                  <div>
                    <h2 className="text-lg font-bold">Personal Work Report ({myLogsData.staffName})</h2>
                    <p className="text-xs text-brand-200">Personal summary of logs handled under your account</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                    <p className="text-xs font-medium text-brand-200">Total Items</p>
                    <h4 className="text-2xl font-extrabold text-white mt-1">{myLogsData.totalQuantity} Pcs</h4>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                    <p className="text-xs font-medium text-brand-200">Total Duration</p>
                    <h4 className="text-2xl font-extrabold text-brand-300 mt-1">{myLogsData.totalDuration} Min</h4>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                    <p className="text-xs font-medium text-brand-200">Orders Processed</p>
                    <h4 className="text-2xl font-extrabold text-emerald-400 mt-1">{myLogsData.totalOrdersHandled} Orders</h4>
                  </div>
                </div>
              </div>
            )}

            {/* STAFF SUMMARY — visible to SALES / QUALITY_CONTROL, scoped to their own branch & department */}
            <StaffSummaryReport
              staffSummary={staffSummary}
              title={`${currentBranch} Branch Report (${currentDept === 'IRONING' ? 'Ironing' : 'Washing'})`}
              subtitle="How everyone in your branch & department is performing"
              showBranchColumn={false}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
            />

            {/* LOGS LIST FOR STAFF */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h3 className="text-md font-bold text-slate-800 mb-4">
                Logs for {currentBranch} Branch ({user?.role === 'QUALITY_CONTROL' ? 'Ironing' : 'Washing'})
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase">
                      <th className="py-3 px-2">Order ID</th>
                      <th className="py-3 px-2">Staff</th>
                      <th className="py-3 px-2">Qty</th>
                      <th className="py-3 px-2">Duration (Min)</th>
                      <th className="py-3 px-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-6 text-slate-400">
                          No active logs found for {currentBranch} branch at this time.
                        </td>
                      </tr>
                    ) : (
                      groupLogsByStaff(logs).flatMap((group) =>
                        group.orders.map((item, idx) => (
                          <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-2 font-semibold text-slate-800">#{item.orderId}</td>
                            {idx === 0 && (
                              <td className="py-3 px-2 align-top" rowSpan={group.orders.length}>
                                {group.staffName}
                                {group.orders.length > 1 && (
                                  <span className="ml-1.5 text-[11px] font-semibold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full">
                                    {group.orders.length} orders
                                  </span>
                                )}
                              </td>
                            )}
                            <td className="py-3 px-2">{item.quantity}</td>
                            <td className="py-3 px-2 font-medium">
                              {item.durationMinutes != null ? `${item.durationMinutes} Min` : (
                                <span className="text-slate-400 italic">Not set</span>
                              )}
                            </td>
                            <td className="py-3 px-2">
                              {item.date !== todayStr ? (
                                <span className="text-[11px] text-slate-400 italic">Locked</span>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => openEditOrderModal(item)}
                                    className="p-1 text-slate-400 hover:text-brand-600 rounded"
                                    title="Edit Order"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLog(item.id)}
                                    className="p-1 text-slate-400 hover:text-red-600 rounded"
                                    title="Delete Log"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )
                    )}
                  </tbody>
                  {logs.length > 0 && (
                    <tfoot className="bg-slate-100/80 font-bold border-t border-slate-300">
                      <tr>
                        <td colSpan="2" className="py-3 px-2 text-slate-800">Total ({logs.length} Orders):</td>
                        <td className="py-3 px-2 text-emerald-700">{logsTotals.totalQuantity} Pcs</td>
                        <td className="py-3 px-2 text-brand-800">{logsTotals.totalMinutes} Min</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* EDIT ORDER MODAL */}
      {editingOrderLog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-slate-800">
              Edit Order #{editingOrderLog.orderId}
            </h2>
            <form onSubmit={handleSaveOrderEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Order ID</label>
                  <input
                    type="number"
                    required
                    value={editOrderForm.orderId}
                    onChange={(e) => setEditOrderForm({ ...editOrderForm, orderId: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Quantity</label>
                  <input
                    type="number"
                    required
                    value={editOrderForm.quantity}
                    onChange={(e) => setEditOrderForm({ ...editOrderForm, quantity: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Shift</label>
                  <select
                    value={editOrderForm.shift}
                    onChange={(e) => setEditOrderForm({ ...editOrderForm, shift: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    <option value="SHIFT_1">SHIFT 1</option>
                    <option value="SHIFT_2">SHIFT 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Duration (Min) — optional</label>
                  <input
                    type="number"
                    placeholder="Leave blank if not known yet"
                    value={editOrderForm.durationMinutes}
                    onChange={(e) => setEditOrderForm({ ...editOrderForm, durationMinutes: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Staff Member</label>
                <select
                  required
                  value={editOrderForm.employeeId}
                  onChange={(e) => setEditOrderForm({ ...editOrderForm, employeeId: e.target.value })}
                  className="w-full border border-slate-200 bg-white rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none cursor-pointer"
                >
                  {editOrderEmployees.length === 0 && <option value="">Loading employees…</option>}
                  {editOrderEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEditOrderModal}
                  className="px-4 py-2 border rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingOrderEdit}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                >
                  {savingOrderEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
