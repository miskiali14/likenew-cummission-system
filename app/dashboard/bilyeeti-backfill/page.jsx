'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';
import { Gift, Play, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function BilyeetiBackfillPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState({ offset: 0, total: 0 });
  const [totals, setTotals] = useState({ registered: 0, credited: 0, points: 0, errors: 0 });
  const [log, setLog] = useState([]);
  const stopRef = useRef(false);

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

  async function runBackfill() {
    setRunning(true);
    setDone(false);
    stopRef.current = false;
    setLog((l) => [...l, 'Bilaabay backfill-ka...']);

    let offset = 0;
    let keepGoing = true;
    const running_totals = { registered: 0, credited: 0, points: 0, errors: 0 };

    while (keepGoing && !stopRef.current) {
      try {
        const res = await API.post('/admin/bilyeeti-backfill', { offset });
        const data = res.data;
        offset = data.nextOffset;
        running_totals.registered += data.batch.registeredCount;
        running_totals.credited += data.batch.creditedCount;
        running_totals.points += data.batch.totalPointsSent;
        running_totals.errors += data.batch.errorCount;

        setProgress({ offset, total: data.total });
        setTotals({ ...running_totals });
        setLog((l) => [
          ...l.slice(-20),
          `${offset}/${data.total} — ${data.batch.creditedCount} la credit-gareeyay (+${data.batch.totalPointsSent} points), ${data.batch.errorCount} khalad`,
        ]);

        keepGoing = !data.done;
      } catch (err) {
        setLog((l) => [...l, `Khalad: ${err?.response?.data?.error || err.message}`]);
        keepGoing = false;
      }
    }

    setRunning(false);
    setDone(true);
    setLog((l) => [...l, 'Dhammaaday!']);
  }

  if (!user) return null;

  const pct = progress.total ? Math.round((progress.offset / progress.total) * 100) : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center">
          <Gift className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">bilyeeti — Backfill Dhibcaha Hore</h1>
          <p className="text-sm text-gray-500">Hal mar kaliya — u dir dhibcihii CleanCloud ee customer-ka hore u lahaa.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-700 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            Tani waxay u diraysaa bilyeeti dhibco DHAB AH oo customer-yo dhab ah. Waxay qaadan kartaa 1-2 saacadood.
            Riix hal mar kaliya oo ha xidhin daaqadan ilaa ay dhammaato.
          </p>
        </div>

        {!running && !done && (
          <button
            onClick={runBackfill}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-5 py-3 rounded-xl transition-colors"
          >
            <Play className="w-4 h-4" />
            Bilaabi Backfill-ka
          </button>
        )}

        {(running || done) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
              <span>{progress.offset} / {progress.total} customer</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full h-3 bg-gray-100 dark:bg-ink-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-600 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <Stat label="La diiwaan-geliyay" value={totals.registered} />
              <Stat label="La credit-gareeyay" value={totals.credited} />
              <Stat label="Points oo dhan" value={totals.points} />
              <Stat label="Khaladaad" value={totals.errors} />
            </div>

            {done && (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-100 rounded-xl p-3 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Dhammaaday! Dhammaan customer-yadii leh dhibco CleanCloud ayaa hadda bilyeeti ku jira.
              </div>
            )}

            {running && (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Socda...
              </div>
            )}
          </div>
        )}

        {log.length > 0 && (
          <div className="mt-4 bg-gray-50 dark:bg-ink-900 rounded-xl p-3 text-xs font-mono text-gray-600 dark:text-gray-400 max-h-48 overflow-y-auto space-y-1">
            {log.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-gray-50 dark:bg-ink-900 rounded-xl p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
