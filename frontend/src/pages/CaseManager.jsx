import { Search, FolderPlus, MoreVertical, FileText } from 'lucide-react';

const mockCases = [
  { id: 'CR-2026-089', title: 'Viral Misinformation Image Set', status: 'open', officers: 3, evidenceCount: 12, date: '2026-03-22' },
  { id: 'CR-2026-102', title: 'Deepfake Promotion Campaign', status: 'under_review', officers: 5, evidenceCount: 45, date: '2026-03-24' },
  { id: 'CR-2026-133', title: 'Public Submission Batch', status: 'closed', officers: 2, evidenceCount: 4, date: '2026-03-15' },
];

const CaseManager = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold">Media Library</h2>
          <p className="text-slate-400">Track media verification records and review status by submission group</p>
        </div>
        <button className="btn-primary flex items-center space-x-2">
          <FolderPlus className="w-5 h-5" />
          <span>New Record</span>
        </button>
      </div>

      <div className="glass-panel p-6">
        {/* Search and Filter */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search by record ID, title, or assigned reviewer..." 
              className="glass-input pl-10"
            />
          </div>
          <select className="glass-input w-48 appearance-none">
            <option>All Statuses</option>
            <option>Open</option>
            <option>Under Review</option>
            <option>Closed</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-dark-700 text-slate-400 text-sm">
                <th className="pb-3 font-medium">Record ID</th>
                <th className="pb-3 font-medium">Title</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Media Files</th>
                <th className="pb-3 font-medium">Assigned</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {mockCases.map((c) => (
                <tr key={c.id} className="border-b border-dark-700/50 hover:bg-dark-800/50 transition-colors group">
                  <td className="py-4 font-mono text-neon-blue">{c.id}</td>
                  <td className="py-4 font-medium text-slate-200">{c.title}</td>
                  <td className="py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      c.status === 'open' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      c.status === 'under_review' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                    }`}>
                      {c.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center space-x-2 text-slate-300">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <span>{c.evidenceCount} Files</span>
                    </div>
                  </td>
                  <td className="py-4 text-slate-400">{c.officers} Reviewers</td>
                  <td className="py-4 text-right">
                    <button className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-dark-700">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CaseManager;
