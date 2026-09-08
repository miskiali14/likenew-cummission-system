'use client';

import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({ children }) {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      setUser(JSON.parse(localStorage.getItem('user') || '{}'));
    } catch {
      setUser({});
    }
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar — hidden on md+ where the sidebar is always visible */}
        <div className="md:hidden flex items-center gap-3 bg-gray-900 text-white px-4 py-3 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="p-1.5 rounded-lg hover:bg-gray-800 transition"
          >
            <Menu size={22} />
          </button>
          <span className="font-bold tracking-wide">Likenew Laundry</span>
        </div>
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
