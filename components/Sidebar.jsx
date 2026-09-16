'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserCog,
  ClipboardList,
  Wallet,
  Briefcase,
  Coins,
  Printer,
  MessageSquareWarning,
  BarChart3,
  Boxes,
  WashingMachine,
  Shirt,
  Eye,
  Headset,
  PhoneCall,
  ChevronDown,
} from 'lucide-react';

function NavLink({ href, icon: Icon, label, isActive, onClose, indent }) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition text-sm ${indent ? 'ml-2' : ''} ${
        isActive ? 'bg-brand-600 text-white font-medium' : 'text-gray-300 hover:bg-gray-800'
      }`}
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function NavGroup({ storageKey, label, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`sidebar_${storageKey}`);
      if (stored !== null) setOpen(stored === '1');
    } catch (e) {
      // localStorage unavailable — keep default
    }
  }, [storageKey]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(`sidebar_${storageKey}`, next ? '1' : '0');
      } catch (e) {
        // ignore
      }
      return next;
    });
  };

  return (
    <div>
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-300 transition"
      >
        <span>{label}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="space-y-1 mt-0.5">{children}</div>}
    </div>
  );
}

export default function Sidebar({ user, isOpen = false, onClose = () => {} }) {
  const pathname = usePathname();
  const userRole = user?.role;

  const isActive = (path) => pathname === path;

  return (
    <>
      {/* Backdrop — mobile only, closes the drawer on tap */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`w-64 bg-gray-900 text-white min-h-screen p-4 flex flex-col justify-between
          fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out
          md:static md:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
      <div onClick={(e) => { if (e.target.closest('a')) onClose(); }}>
        <div className="mb-6 font-bold text-xl tracking-wide text-center border-b border-gray-800 pb-4">
          Likenew Laundry
        </div>

        <nav className="space-y-4 overflow-y-auto max-h-[calc(100vh-140px)] pr-1">
          {/* ================= ADMIN ONLY ================= */}
          {userRole === 'ADMIN' && (
            <>
              <NavLink href="/dashboard" icon={LayoutDashboard} label="Overview" isActive={isActive('/dashboard')} />

              <NavGroup storageKey="admin_team" label="Team">
                <NavLink href="/dashboard/users" icon={Users} label="Users Management" isActive={isActive('/dashboard/users')} indent />
                <NavLink href="/dashboard/employees" icon={UserCog} label="Employees & Commission" isActive={isActive('/dashboard/employees')} indent />
                <NavLink href="/dashboard/registrars" icon={ClipboardList} label="Assigned By List" isActive={isActive('/dashboard/registrars')} indent />
              </NavGroup>

              <NavGroup storageKey="admin_reports" label="Reports">
                <NavLink href="/dashboard/financial-report" icon={Wallet} label="Financial Report" isActive={isActive('/dashboard/financial-report')} indent />
                <NavLink href="/dashboard/reports" icon={Printer} label="Print Reports" isActive={isActive('/dashboard/reports')} indent />
              </NavGroup>

              <NavGroup storageKey="admin_items" label="Customer Items">
                <NavLink href="/dashboard/customer-items" icon={Briefcase} label="Customer Items" isActive={isActive('/dashboard/customer-items')} indent />
                <NavLink href="/dashboard/customer-items/commission-report" icon={Coins} label="Item Commission Report" isActive={isActive('/dashboard/customer-items/commission-report')} indent />
              </NavGroup>

              <NavGroup storageKey="admin_complaints" label="Complaints">
                <NavLink href="/dashboard/complaints" icon={MessageSquareWarning} label="Complaints" isActive={isActive('/dashboard/complaints')} indent />
                <NavLink href="/dashboard/complaints/report" icon={BarChart3} label="Complaints Report" isActive={isActive('/dashboard/complaints/report')} indent />
              </NavGroup>

              <NavGroup storageKey="admin_deadstock" label="Dead Stock">
                <NavLink href="/dashboard/dead-stock" icon={Boxes} label="Dead Stock" isActive={isActive('/dashboard/dead-stock')} indent />
                <NavLink href="/dashboard/dead-stock/report" icon={BarChart3} label="Dead Stock Report" isActive={isActive('/dashboard/dead-stock/report')} indent />
              </NavGroup>

              <div className="border-t border-gray-800 pt-1" />
            </>
          )}

          {/* ================= SALES ================= */}
          {userRole === 'SALES' && (
            <>
              <div className="text-xs font-semibold text-gray-500 uppercase px-3 py-1">Sales Section</div>
              <NavLink href="/dashboard" icon={WashingMachine} label="Washing Logs & Report" isActive={isActive('/dashboard')} />
              <NavLink href="/dashboard/complaints" icon={MessageSquareWarning} label="Complaints" isActive={isActive('/dashboard/complaints')} />
            </>
          )}

          {/* ================= CUSTOMER CARE ================= */}
          {userRole === 'CUSTOMER_CARE' && (
            <>
              <div className="text-xs font-semibold text-gray-500 uppercase px-3 py-1 flex items-center gap-1.5">
                <Headset size={14} /> Customer Care
              </div>
              <NavLink href="/dashboard/complaints" icon={MessageSquareWarning} label="Complaints" isActive={isActive('/dashboard/complaints')} />
              <NavLink href="/dashboard/complaints/report" icon={BarChart3} label="Complaints Report" isActive={isActive('/dashboard/complaints/report')} />
              <NavLink href="/dashboard/dead-stock" icon={Boxes} label="Dead Stock" isActive={isActive('/dashboard/dead-stock')} />
              <NavLink href="/dashboard/dead-stock/report" icon={BarChart3} label="Dead Stock Report" isActive={isActive('/dashboard/dead-stock/report')} />
            </>
          )}

          {/* ================= CALL CENTER ================= */}
          {userRole === 'CALL_CENTER' && (
            <>
              <div className="text-xs font-semibold text-gray-500 uppercase px-3 py-1 flex items-center gap-1.5">
                <PhoneCall size={14} /> Call Center
              </div>
              <NavLink href="/dashboard/customer-items" icon={Briefcase} label="Customer Items" isActive={isActive('/dashboard/customer-items')} />
              <NavLink href="/dashboard/customer-items/commission-report" icon={Coins} label="My Commission Report" isActive={isActive('/dashboard/customer-items/commission-report')} />
              <NavLink href="/dashboard/complaints" icon={MessageSquareWarning} label="Complaints" isActive={isActive('/dashboard/complaints')} />
            </>
          )}

          {/* ================= QUALITY CONTROL ================= */}
          {userRole === 'QUALITY_CONTROL' && (
            <>
              <div className="text-xs font-semibold text-gray-500 uppercase px-3 py-1">QC Section</div>
              <NavLink href="/dashboard" icon={Shirt} label="Ironing Logs & Report" isActive={isActive('/dashboard')} />
            </>
          )}

          {/* ================= VIEWER (read-only) ================= */}
          {userRole === 'VIEWER' && (
            <>
              <div className="text-xs font-semibold text-gray-500 uppercase px-3 py-1">Viewer</div>
              <NavLink href="/dashboard" icon={Eye} label="Branch Overview" isActive={isActive('/dashboard')} />
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
    </>
  );
}
