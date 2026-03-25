import { useState, useEffect, useMemo } from 'react';
import { Search, Download, FileDown, Filter, Calendar, BarChart3, Trash2, ArrowUpDown } from 'lucide-react';

const HISTORY_KEY = 'veritrace_public_history';

const toPercentDisplay = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const scaled = numeric <= 1 ? numeric * 100 : numeric;
  return Math.round(Math.max(0, Math.min(100, scaled)) * 100) / 100;
};

const toDateTime = (value) => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return 'N/A';
  }
};

const toDate = (value) => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return 'N/A';
  }
};

const statusClass = (status) => {
  if (status === 'AI_GENERATED') return 'text-rose-300 bg-rose-500/20 border-rose-500/40';
  if (status === 'AUTHENTIC') return 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40';
  return 'text-amber-300 bg-amber-500/20 border-amber-500/40';
};

const convertToCSV = (items) => {
  const headers = ['File Name', 'Verdict', 'Probability (%)', 'Timestamp'];
  const rows = items.map((item) => [
    item.fileName || 'Unknown',
    item.verdict || 'N/A',
    item.probability || 0,
    toDateTime(item.timestamp),
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  return csv;
};

const exportData = (items, format) => {
  if (format === 'csv') {
    const csv = convertToCSV(items);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `verification-log-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  } else if (format === 'json') {
    const json = JSON.stringify(items, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `verification-log-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
};

const VerificationLog = () => {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [verdict, setVerdict] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minConfidence, setMinConfidence] = useState(0);
  const [maxConfidence, setMaxConfidence] = useState(100);
  const [sortBy, setSortBy] = useState('date-desc');
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 15;

  // Load history from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setItems(Array.isArray(parsed) ? parsed : []);
    } catch {
      setItems([]);
    }
  }, []);

  // Filter and sort logic
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search by filename
    if (searchTerm) {
      result = result.filter((item) =>
        (item.fileName || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by verdict
    if (verdict) {
      result = result.filter((item) => item.verdict === verdict);
    }

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate);
      result = result.filter((item) => new Date(item.timestamp) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter((item) => new Date(item.timestamp) <= end);
    }

    // Filter by confidence range
    result = result.filter(
      (item) => item.probability >= minConfidence && item.probability <= maxConfidence
    );

    // Sort
    if (sortBy === 'date-desc') {
      result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } else if (sortBy === 'date-asc') {
      result.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } else if (sortBy === 'confidence-desc') {
      result.sort((a, b) => (b.probability || 0) - (a.probability || 0));
    } else if (sortBy === 'confidence-asc') {
      result.sort((a, b) => (a.probability || 0) - (b.probability || 0));
    } else if (sortBy === 'filename') {
      result.sort((a, b) => (a.fileName || '').localeCompare(b.fileName || ''));
    }

    return result;
  }, [items, searchTerm, verdict, startDate, endDate, minConfidence, maxConfidence, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Statistics
  const stats = useMemo(() => {
    const total = filteredItems.length;
    const aiGenerated = filteredItems.filter((item) => item.verdict === 'AI_GENERATED').length;
    const authentic = filteredItems.filter((item) => item.verdict === 'AUTHENTIC').length;
    const inconclusive = filteredItems.filter((item) => item.verdict === 'INCONCLUSIVE').length;
    const avgConfidence =
      total > 0
        ? Math.round(
            (filteredItems.reduce((sum, item) => sum + (item.probability || 0), 0) / total) * 100
          ) / 100
        : 0;

    return { total, aiGenerated, authentic, inconclusive, avgConfidence };
  }, [filteredItems]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setVerdict('');
    setStartDate('');
    setEndDate('');
    setMinConfidence(0);
    setMaxConfidence(100);
    setSortBy('date-desc');
    setCurrentPage(1);
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all verification history? This cannot be undone.')) {
      setItems([]);
      localStorage.removeItem(HISTORY_KEY);
      setCurrentPage(1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="w-8 h-8 text-neon-cyan" />
              Verification Log
            </h2>
            <p className="text-slate-400 mt-2">
              Search, filter, and export your media verification history
            </p>
          </div>
          <div className="text-sm text-slate-300 text-right">
            <p className="font-semibold">{filteredItems.length}</p>
            <p className="text-slate-500">{filteredItems.length === 1 ? 'check' : 'checks'} found</p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel p-4">
            <p className="text-slate-400 text-xs font-medium mb-1">Total Checks</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-slate-400 text-xs font-medium mb-1">AI Generated</p>
            <p className="text-2xl font-bold text-rose-400">{stats.aiGenerated}</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-slate-400 text-xs font-medium mb-1">Authentic</p>
            <p className="text-2xl font-bold text-emerald-400">{stats.authentic}</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-slate-400 text-xs font-medium mb-1">Avg Confidence</p>
            <p className="text-2xl font-bold text-neon-blue">{stats.avgConfidence}%</p>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Filter className="w-5 h-5 text-neon-cyan" />
            Filters
          </h3>
          <button
            onClick={handleClearFilters}
            className="text-xs px-2 py-1 rounded text-slate-400 hover:text-white transition-colors"
          >
            Reset All
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by file name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="glass-input pl-10 w-full"
          />
        </div>

        {/* Filter Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Verdict Filter */}
          <div>
            <label className="block text-xs text-slate-400 font-medium mb-2">Verdict</label>
            <select
              value={verdict}
              onChange={(e) => {
                setVerdict(e.target.value);
                setCurrentPage(1);
              }}
              className="glass-input w-full appearance-none"
            >
              <option value="">All Verdicts</option>
              <option value="AI_GENERATED">AI Generated</option>
              <option value="AUTHENTIC">Authentic</option>
              <option value="INCONCLUSIVE">Inconclusive</option>
            </select>
          </div>

          {/* Start Date Filter */}
          <div>
            <label className="block text-xs text-slate-400 font-medium mb-2">
              <Calendar className="w-3 h-3 inline mr-1" />
              From
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="glass-input w-full"
            />
          </div>

          {/* End Date Filter */}
          <div>
            <label className="block text-xs text-slate-400 font-medium mb-2">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="glass-input w-full"
            />
          </div>

          {/* Confidence Range */}
          <div>
            <label className="block text-xs text-slate-400 font-medium mb-2">
              Confidence: {minConfidence}% - {maxConfidence}%
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={minConfidence}
                onChange={(e) => {
                  setMinConfidence(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="glass-input w-1/2 text-sm"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={maxConfidence}
                onChange={(e) => {
                  setMaxConfidence(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="glass-input w-1/2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Sort and Actions */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
          <div className="w-full md:w-auto">
            <label className="block text-xs text-slate-400 font-medium mb-2">
              <ArrowUpDown className="w-3 h-3 inline mr-1" />
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="glass-input w-full md:w-48 appearance-none"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="confidence-desc">Highest Confidence</option>
              <option value="confidence-asc">Lowest Confidence</option>
              <option value="filename">File Name (A-Z)</option>
            </select>
          </div>

          {/* Export Buttons */}
          {filteredItems.length > 0 && (
            <div className="flex gap-3 ml-auto">
              <button
                onClick={() => exportData(filteredItems, 'csv')}
                className="btn-outline flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={() => exportData(filteredItems, 'json')}
                className="btn-outline flex items-center gap-2 text-sm"
              >
                <FileDown className="w-4 h-4" />
                Export JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results Table */}
      {filteredItems.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <p className="text-slate-400">
            {items.length === 0 ? 'No verification history yet.' : 'No checks match your filters.'}
          </p>
          {items.length > 0 && (
            <button
              onClick={handleClearFilters}
              className="mt-4 text-neon-blue hover:text-neon-cyan transition-colors text-sm"
            >
              Clear filters to see all checks
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="glass-panel p-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-dark-700 text-slate-400">
                  <th className="pb-3 font-medium">File Name</th>
                  <th className="pb-3 font-medium">Verdict</th>
                  <th className="pb-3 font-medium text-right">Probability</th>
                  <th className="pb-3 font-medium">Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => (
                  <tr key={item.id} className="border-b border-dark-700/50 hover:bg-dark-800/30 transition-colors">
                    <td className="py-3 font-medium text-slate-200 truncate">{item.fileName}</td>
                    <td className="py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusClass(item.verdict)}`}>
                        {item.verdict}
                      </span>
                    </td>
                    <td className="py-3 text-right font-semibold text-slate-100">
                      {item.probability}%
                    </td>
                    <td className="py-3 text-slate-400 text-xs">{toDateTime(item.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between glass-panel p-4">
              <p className="text-sm text-slate-400">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="btn-outline text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((pageNum, idx, arr) => (
                    <div key={pageNum}>
                      {idx > 0 && arr[idx - 1] !== pageNum - 1 && (
                        <span className="px-2 text-slate-500">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                          pageNum === currentPage
                            ? 'bg-neon-blue text-white'
                            : 'hover:bg-dark-700 text-slate-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    </div>
                  ))}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="btn-outline text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Danger Zone */}
      {items.length > 0 && (
        <div className="glass-panel p-6 border border-rose-500/20 bg-rose-500/5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-rose-400 mb-1">Danger Zone</h3>
              <p className="text-sm text-slate-400">Permanently delete all verification history</p>
            </div>
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 transition-all text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Clear History
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationLog;
