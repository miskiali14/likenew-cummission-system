'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      setUser(JSON.parse(localStorage.getItem('user') || '{}'));
    } catch {
      setUser({});
    }
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
