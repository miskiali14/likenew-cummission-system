'use client';

import { useState } from 'react';
import API from '@/lib/api';
import { Search, Package, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export default function FindMyItemPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 3) {
      setError('Please enter at least 3 characters (your name, ID, or phone number).');
      return;
    }
    setError('');
    setLoading(true);
    setSearched(true);
    try {
      const res = await API.get(`/public/customer-items/search?q=${encodeURIComponent(q)}`);
      setResults(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white flex flex-col">
      <header className="py-8 text-center">
        <h1 className="text-3xl font-extrabold text-brand-700 tracking-tight">LIKE NEW LAUNDRY</h1>
        <p className="text-slate-500 text-sm mt-1">Find an item you left behind</p>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 pb-16">
        <div className="w-full max-w-lg">
          <form onSubmit={handleSearch} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
            <label className="block text-sm font-semibold text-slate-700">
              Search by your name, ID, or phone number
            </label>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-brand-400">
              <Search size={18} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="E.g. Ahmed Zaki, 11250, or 0615..."
                className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none w-full"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle size={16} /> {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {searched && !loading && (
            <div className="mt-6 space-y-3">
              {results && results.length === 0 && (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-slate-400 text-sm shadow-sm flex flex-col items-center gap-2">
                  <Package size={26} className="text-slate-300" />
                  No matching items found. Please check your details or visit the branch.
                </div>
              )}

              {results && results.map((item, idx) => (
                <div key={idx} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-800">{item.customerName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {item.branch} branch &middot; ID {item.customerId} &middot; {item.date}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full ${
                        item.status === 'CLAIMED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {item.status === 'CLAIMED' ? (
                        <>
                          <CheckCircle2 size={13} /> Already Claimed
                        </>
                      ) : (
                        <>
                          <Clock size={13} /> Held at Branch
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-3">{item.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="text-center text-xs text-slate-400 pb-6">
        Have questions? Visit your branch or contact staff directly.
      </footer>
    </div>
  );
}
