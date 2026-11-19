'use client';

import { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';

export default function CheckPointsPage() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!phone.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/public/loyalty-lookup?phone=${encodeURIComponent(phone.trim())}`);
      const data = await res.json();
      if (!data.ok) {
        setError('Wax qalad ah ayaa dhacay. Isku day mar kale.');
      } else if (!data.found) {
        setResult({ found: false });
      } else {
        setResult({ found: true, points: data.points, name: data.name });
      }
    } catch {
      setError('Wax qalad ah ayaa dhacay. Isku day mar kale.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 text-white mb-4">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Likenew Rewards</h1>
          <p className="text-gray-500 mt-1">Hubi dhibcahaaga (loyalty points)</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg shadow-brand-900/5 border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Lambarka telefoonkaaga</label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="61xxxxxxx"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            <Search className="w-4 h-4" />
            {loading ? 'Waa la hubinayaa...' : 'Hubi Dhibcahayga'}
          </button>
        </form>

        {error && (
          <div className="mt-4 text-center text-red-600 bg-red-50 border border-red-100 rounded-xl py-3 px-4">
            {error}
          </div>
        )}

        {result && result.found === false && (
          <div className="mt-4 text-center text-gray-600 bg-gray-50 border border-gray-100 rounded-xl py-4 px-4">
            Lambarkan lama helin. Hubi inaad gelisay si sax ah, ama la xiriir xarunta.
          </div>
        )}

        {result && result.found && (
          <div className="mt-4 text-center bg-brand-600 text-white rounded-2xl py-8 px-6 shadow-lg shadow-brand-900/20">
            {result.name && <p className="text-brand-100 text-sm mb-1">{result.name}</p>}
            <p className="text-5xl font-extrabold tracking-tight">{result.points}</p>
            <p className="text-brand-100 mt-1">dhibco (points)</p>
          </div>
        )}
      </div>
    </div>
  );
}
