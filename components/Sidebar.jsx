'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const userRole = user?.role; // 'ADMIN' | 'SALES' | 'QUALITY_CONTROL'

  const isActive = (path) => pathname === path 
    ? 'bg-brand-600 text-white font-medium'
    : 'text-gray-300 hover:bg-gray-800';

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen p-4 flex flex-col justify-between">
      <div>
        <div className="mb-8 font-bold text-xl tracking-wide text-center border-b border-gray-800 pb-4">
          Likenew Laundry
        </div>

        <nav className="space-y-2">
          {/* ================= ADMIN ONLY ================= */}
          {userRole === 'ADMIN' && (
            <>
              <div className="text-xs font-semibold text-gray-500 uppercase px-3 py-1">Admin Panel</div>
              <Link href="/dashboard" className={`block px-4 py-2.5 rounded-lg transition ${isActive('/dashboard')}`}>
                📊 Overview
              </Link>
              <Link href="/dashboard/users" className={`block px-4 py-2.5 rounded-lg transition ${isActive('/dashboard/users')}`}>
                👥 Users Management
              </Link>
              <Link href="/dashboard/employees" className={`block px-4 py-2.5 rounded-lg transition ${isActive('/dashboard/employees')}`}>
                🧑‍🔧 Employees & Commission
              </Link>
              <Link href="/dashboard/registrars" className={`block px-4 py-2.5 rounded-lg transition ${isActive('/dashboard/registrars')}`}>
                📝 Assigned By List
              </Link>
              <div className="my-3 border-t border-gray-800" />
            </>
          )}

          {/* ================= SALES ================= */}
          {userRole === 'SALES' && (
            <>
              <div className="text-xs font-semibold text-gray-500 uppercase px-3 py-1">Sales Section</div>
              <Link href="/dashboard" className={`block px-4 py-2.5 rounded-lg transition ${isActive('/dashboard')}`}>
                🧺 Washing Logs & Report
              </Link>
            </>
          )}

          {/* ================= QUALITY CONTROL ================= */}
          {userRole === 'QUALITY_CONTROL' && (
            <>
              <div className="text-xs font-semibold text-gray-500 uppercase px-3 py-1">QC Section</div>
              <Link href="/dashboard" className={`block px-4 py-2.5 rounded-lg transition ${isActive('/dashboard')}`}>
                👔 Ironing Logs & Report
              </Link>
            </>
          )}

          {/* ================= VIEWER (read-only) ================= */}
          {userRole === 'VIEWER' && (
            <>
              <div className="text-xs font-semibold text-gray-500 uppercase px-3 py-1">Viewer</div>
              <Link href="/dashboard" className={`block px-4 py-2.5 rounded-lg transition ${isActive('/dashboard')}`}>
                👁️ Branch Overview
              </Link>
            </>
          )}
        </nav>
      </div>

      {/* Profile Info */}
      <div className="border-t border-gray-800 pt-4">
        <div className="text-sm font-semibold">{user?.fullName || 'User'}</div>
        <div className="text-xs text-brand-300 capitalize">{user?.role} — {user?.branch || 'HQ'}</div>
      </div>
    </aside>
  );
}