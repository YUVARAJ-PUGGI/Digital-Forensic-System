import { useState, useEffect } from 'react';
import { Activity, TrendingUp, AlertTriangle, CheckCircle2, Shield, Zap, BarChart3, Clock } from 'lucide-react';

const AnimatedCounter = ({ endValue, duration = 2000, label, icon: Icon, color }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let currentValue = 0;
    const increment = endValue / (duration / 50);
    const interval = setInterval(() => {
      currentValue += increment;
      if (currentValue >= endValue) {
        setCount(endValue);
        clearInterval(interval);
      } else {
        setCount(Math.floor(currentValue));
      }
    }, 50);

    return () => clearInterval(interval);
  }, [endValue, duration]);

  return (
    <div className="group glass-panel p-6 hover:shadow-2xl hover:shadow-neon-blue/20 transition-all duration-300 transform hover:scale-105">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-2">{label}</p>
          <h3 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
            {count.toLocaleString()}
          </h3>
        </div>
        <div className={`p-3 rounded-xl ${color} shadow-lg group-hover:shadow-xl transition-all group-hover:scale-110`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
};

const VerdictDistributionChart = ({ verdicts }) => {
  const total = verdicts.AI_GENERATED + verdicts.AUTHENTIC + verdicts.INCONCLUSIVE;
  if (total === 0) {
    return (
      <div className="glass-panel p-6 flex items-center justify-center h-64">
        <p className="text-slate-400">No data available yet</p>
      </div>
    );
  }

  const aiPercent = (verdicts.AI_GENERATED / total) * 100;
  const authPercent = (verdicts.AUTHENTIC / total) * 100;
  const inconclusivePercent = (verdicts.INCONCLUSIVE / total) * 100;

  return (
    <div className="glass-panel p-6 space-y-6">
      <h3 className="text-lg font-bold flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-neon-cyan" />
        Verdict Distribution
      </h3>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-slate-300">AI Generated</span>
            <span className="text-sm font-semibold text-rose-400">{Math.round(aiPercent)}%</span>
          </div>
          <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full transition-all duration-1000"
              style={{ width: `${aiPercent}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-slate-300">Authentic</span>
            <span className="text-sm font-semibold text-emerald-400">{Math.round(authPercent)}%</span>
          </div>
          <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000"
              style={{ width: `${authPercent}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-slate-300">Inconclusive</span>
            <span className="text-sm font-semibold text-amber-400">{Math.round(inconclusivePercent)}%</span>
          </div>
          <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-1000"
              style={{ width: `${inconclusivePercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-dark-700">
        <div className="text-center">
          <p className="text-2xl font-bold text-rose-400">{verdicts.AI_GENERATED}</p>
          <p className="text-xs text-slate-400 mt-1">Flagged</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-400">{verdicts.AUTHENTIC}</p>
          <p className="text-xs text-slate-400 mt-1">Verified</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-amber-400">{verdicts.INCONCLUSIVE}</p>
          <p className="text-xs text-slate-400 mt-1">Unclear</p>
        </div>
      </div>
    </div>
  );
};

const RecentActivityFeed = ({ recentItems }) => {
  const getVerdictColor = (verdict) => {
    if (verdict === 'AI_GENERATED') return 'text-rose-400';
    if (verdict === 'AUTHENTIC') return 'text-emerald-400';
    return 'text-amber-400';
  };

  const getVerdictBg = (verdict) => {
    if (verdict === 'AI_GENERATED') return 'bg-rose-500/10 border border-rose-500/30';
    if (verdict === 'AUTHENTIC') return 'bg-emerald-500/10 border border-emerald-500/30';
    return 'bg-amber-500/10 border border-amber-500/30';
  };

  return (
    <div className="glass-panel p-6 space-y-4">
      <h3 className="text-lg font-bold flex items-center gap-2">
        <Activity className="w-5 h-5 text-neon-cyan" />
        Recent Verifications
      </h3>

      {recentItems.length === 0 ? (
        <p className="text-slate-400 text-center py-8">No verification activity yet</p>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {recentItems.map((item, index) => (
            <div
              key={item._id}
              className={`p-4 rounded-xl border border-dark-700/50 hover:border-neon-blue/30 transition-all transform hover:scale-102 hover:shadow-lg ${getVerdictBg(item.aiAnalysis?.verdict || 'INCONCLUSIVE')} animate-fadeInUp`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-200 truncate">{item.originalName}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-bold uppercase ${getVerdictColor(item.aiAnalysis?.verdict || 'INCONCLUSIVE')}`}>
                    {item.aiAnalysis?.verdict || 'INCONCLUSIVE'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {item.aiAnalysis?.confidence || 0}% Confidence
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Dashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/evidence/analytics/summary');
        if (!response.ok) throw new Error('Failed to fetch analytics');
        const data = await response.json();
        setAnalytics(data);
      } catch (err) {
        setError(err.message);
        console.error('Analytics fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full border-4 border-dark-700 border-t-neon-blue animate-spin mx-auto" />
          <p className="text-slate-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="glass-panel p-8 md:p-12 bg-gradient-to-br from-neon-blue/10 via-dark-800 to-neon-cyan/5 overflow-hidden relative">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-neon-blue/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-neon-cyan/10 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-6 h-6 text-neon-blue animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-widest text-neon-blue">Active Protection</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Media Authenticity Hub</h1>
          <p className="text-slate-300 text-lg max-w-2xl">
            Real-time AI detection and forensic analysis. Verify media integrity before it spreads.
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatedCounter
          endValue={analytics?.total || 0}
          label="Total Verifications"
          icon={Activity}
          color="bg-neon-blue/80 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
        />
        <AnimatedCounter
          endValue={analytics?.verdicts?.AI_GENERATED || 0}
          label="AI Generated Flagged"
          icon={AlertTriangle}
          color="bg-rose-500/80 shadow-[0_0_15px_rgba(244,63,94,0.5)]"
        />
        <AnimatedCounter
          endValue={analytics?.verdicts?.AUTHENTIC || 0}
          label="Verified Authentic"
          icon={CheckCircle2}
          color="bg-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
        />
        <AnimatedCounter
          endValue={analytics?.averageConfidence || 0}
          label="Avg Confidence"
          icon={TrendingUp}
          color="bg-neon-cyan/80 shadow-[0_0_15px_rgba(34,211,238,0.5)]"
          duration={3000}
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <VerdictDistributionChart verdicts={analytics?.verdicts || { AI_GENERATED: 0, AUTHENTIC: 0, INCONCLUSIVE: 0 }} />
        </div>

        {/* Quick Stats */}
        <div className="glass-panel p-6 space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-neon-cyan" />
            Quick Stats
          </h3>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-dark-900/40 border border-dark-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Detection Rate</span>
                <span className="text-2xl font-bold text-neon-blue">
                  {analytics && analytics.total > 0
                    ? Math.round(
                        ((analytics.verdicts.AI_GENERATED + analytics.verdicts.AUTHENTIC) /
                          analytics.total) *
                          100
                      )
                    : 0}
                  %
                </span>
              </div>
              <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-neon-blue to-neon-cyan"
                  style={{
                    width: `${analytics && analytics.total > 0 ? Math.round(((analytics.verdicts.AI_GENERATED + analytics.verdicts.AUTHENTIC) / analytics.total) * 100) : 0}%`
                  }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-dark-900/40 border border-dark-700/50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">False Positive Risk</span>
                <span className="text-2xl font-bold text-amber-400">Low</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Safety-first flagging protocol enabled</p>
            </div>

            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-emerald-400 mt-0.5" />
                <div>
                  <p className="font-medium text-emerald-300">Integrity Protected</p>
                  <p className="text-xs text-emerald-200 mt-1">SHA-256 verification enabled</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <RecentActivityFeed recentItems={analytics?.recent || []} />

      {error && (
        <div className="glass-panel p-6 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
