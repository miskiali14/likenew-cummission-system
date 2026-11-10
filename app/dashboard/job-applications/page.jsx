'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';
import {
  Loader2, FileText, Users, Download, X, ExternalLink, CheckCircle2,
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

function Modal({ app, onClose }) {
  if (!app) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-ink-800 rounded-2xl shadow-xl max-w-xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">{app.fullName}</h3>
            <p className="text-sm text-slate-500 dark:text-ink-400">{app.role}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-slate-400 dark:text-ink-500">Phone</span><p className="font-medium text-slate-700 dark:text-ink-200">{app.phone}</p></div>
          <div><span className="text-slate-400 dark:text-ink-500">Email</span><p className="font-medium text-slate-700 dark:text-ink-200">{app.email}</p></div>
          <div><span className="text-slate-400 dark:text-ink-500">Location</span><p className="font-medium text-slate-700 dark:text-ink-200">{app.location}</p></div>
          <div><span className="text-slate-400 dark:text-ink-500">Education</span><p className="font-medium text-slate-700 dark:text-ink-200">{app.educationLevel}</p></div>
          <div><span className="text-slate-400 dark:text-ink-500">Experience</span><p className="font-medium text-slate-700 dark:text-ink-200">{app.yearsExperience}</p></div>
          <div><span className="text-slate-400 dark:text-ink-500">Led a team?</span><p className="font-medium text-slate-700 dark:text-ink-200">{app.ledTeam ? `Yes${app.teamSize ? ` (${app.teamSize})` : ''}` : 'No'}</p></div>
          <div><span className="text-slate-400 dark:text-ink-500">Last Title</span><p className="font-medium text-slate-700 dark:text-ink-200">{app.lastTitle || '—'}</p></div>
          <div><span className="text-slate-400 dark:text-ink-500">Last Company</span><p className="font-medium text-slate-700 dark:text-ink-200">{app.lastCompany || '—'}</p></div>
        </div>

        {app.aiTools?.length > 0 && (
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400 dark:text-ink-500">AI Tools</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {app.aiTools.map((t) => (
                <span key={t} className="text-xs bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 px-2 py-1 rounded-full">{t}</span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-sm">
          {app.cvLink && (
            <a href={app.cvLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-brand-600 dark:text-brand-300 font-medium hover:underline">
              <FileText size={15} /> CV <ExternalLink size={12} />
            </a>
          )}
          {app.portfolioLinks && (
            <a href={app.portfolioLinks} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-brand-600 dark:text-brand-300 font-medium hover:underline">
              <ExternalLink size={14} /> Portfolio / Work Links
            </a>
          )}
        </div>

        <div>
          <span className="text-xs font-semibold uppercase text-slate-400 dark:text-ink-500">30-Day Plan</span>
          <p className="mt-1 text-sm text-slate-700 dark:text-ink-200 whitespace-pre-wrap">{app.thirtyDayPlan}</p>
        </div>

        <div>
          <span className="text-xs font-semibold uppercase text-slate-400 dark:text-ink-500">Why This Role</span>
          <p className="mt-1 text-sm text-slate-700 dark:text-ink-200 whitespace-pre-wrap">{app.whyFit}</p>
        </div>

        <p className="text-xs text-slate-400 dark:text-ink-500 pt-2 border-t border-slate-100 dark:border-ink-700">
          Submitted {new Date(app.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export default function JobApplicationsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [roleFilter, setRoleFilter] = useState('All');
  const [selected, setSelected] = useState(null);

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
  }, [router]);

  const fetchApplications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const roleParam = roleFilter !== 'All' ? `?role=${encodeURIComponent(roleFilter)}` : '';
      const res = await API.get(`/job-applications${roleParam}`);
      setApplications(res.data || []);
    } catch (err) {
      console.error('Failed to load job applications:', err);
    } finally {
      setLoading(false);
    }
  }, [user, roleFilter]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const roles = useMemo(() => {
    const set = new Set(applications.map((a) => a.role));
    return ['All', ...set];
  }, [applications]);

  const sorted = useMemo(
    () => [...applications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [applications]
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Job Applications</h1>
          <p className="text-sm text-gray-500 dark:text-ink-400">Applications submitted through the careers page on the website</p>
        </div>
      </div>

      <div className="bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-slate-200 dark:border-ink-600 bg-slate-50 dark:bg-ink-700 text-sm font-medium text-slate-700 dark:text-ink-200 rounded-xl p-2 focus:outline-none cursor-pointer"
        >
          {roles.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {sorted.length > 0 && (
          <button
            onClick={() =>
              exportToCSV(
                `job-applications-${new Date().toISOString().split('T')[0]}.csv`,
                sorted.map((a) => ({
                  Date: new Date(a.createdAt).toISOString().split('T')[0],
                  Role: a.role,
                  Name: a.fullName,
                  Phone: a.phone,
                  Email: a.email,
                  Location: a.location,
                  Education: a.educationLevel,
                  Experience: a.yearsExperience,
                  LedTeam: a.ledTeam ? 'Yes' : 'No',
                  TeamSize: a.teamSize || '',
                  LastTitle: a.lastTitle || '',
                  LastCompany: a.lastCompany || '',
                  AITools: (a.aiTools || []).join('; '),
                  CVLink: a.cvLink,
                  Portfolio: a.portfolioLinks || '',
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
      ) : sorted.length === 0 ? (
        <div className="bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 rounded-2xl p-10 flex flex-col items-center gap-2 text-slate-400 dark:text-ink-500 text-sm shadow-sm">
          <Users size={28} className="text-slate-300 dark:text-ink-600" />
          No applications submitted yet.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="group relative bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 p-5 rounded-2xl flex items-center gap-4 shadow-sm overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-400 to-brand-600" />
              <div className="p-3 bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/40 dark:to-brand-800/40 text-brand-600 dark:text-brand-300 rounded-xl border border-brand-100 dark:border-brand-700">
                <Users size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400 dark:text-ink-500 tracking-wide">Total Applicants</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5 tabular-nums">{sorted.length}</h3>
              </div>
            </div>
            <div className="group relative bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 p-5 rounded-2xl flex items-center gap-4 shadow-sm overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
              <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/40 dark:to-emerald-800/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-800">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-400 dark:text-ink-500 tracking-wide">Have Led a Team</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5 tabular-nums">{sorted.filter((a) => a.ledTeam).length}</h3>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-ink-800 border border-slate-200/80 dark:border-ink-700 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-700 dark:text-ink-200">All Applicants</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-ink-700">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-ink-700 text-slate-500 dark:text-ink-400 text-xs uppercase bg-slate-50/70 dark:bg-ink-700/40">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Name</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Experience</th>
                    <th className="py-3 px-3">CV</th>
                    <th className="py-3 px-3" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((a) => (
                    <tr key={a.id} className="border-b border-slate-100 dark:border-ink-700 hover:bg-slate-50/80 dark:hover:bg-ink-700/40 transition">
                      <td className="py-3 px-3 text-slate-600 dark:text-ink-300">{new Date(a.createdAt).toISOString().split('T')[0]}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800 dark:text-white">{a.fullName}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-ink-300">{a.role}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-ink-300">{a.phone}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-ink-300">{a.yearsExperience}</td>
                      <td className="py-3 px-3">
                        {a.cvLink ? (
                          <a href={a.cvLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-brand-600 dark:text-brand-300 hover:underline inline-flex items-center gap-1">
                            <FileText size={14} /> CV
                          </a>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button onClick={() => setSelected(a)} className="text-xs font-semibold text-brand-600 dark:text-brand-300 hover:underline">
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal app={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
