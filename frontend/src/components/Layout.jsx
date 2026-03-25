import { Outlet, Link, useLocation } from 'react-router-dom';
import { Shield, LayoutDashboard, FolderOpen, Upload, FileSignature, LogOut, Bell } from 'lucide-react';

const SidebarItem = ({ icon: Icon, label, path, active }) => (
  <Link to={path} className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
    active ? 'bg-gradient-to-r from-neon-blue/20 to-transparent border-l-4 border-neon-blue text-neon-blue' : 'text-slate-400 hover:text-white hover:bg-dark-700/50'
  }`}>
    <Icon className="w-5 h-5" />
    <span className="font-medium">{label}</span>
  </Link>
);

const Layout = () => {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-dark-900 overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 glass-panel border-y-0 border-l-0 rounded-none rounded-r-2xl flex flex-col z-10 relative">
        <div className="p-6 flex items-center space-x-3">
          <Shield className="w-8 h-8 text-neon-blue" />
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">VeriTrace</h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" path="/" active={location.pathname === '/'} />
          <SidebarItem icon={FolderOpen} label="Media Library" path="/cases" active={location.pathname.startsWith('/cases')} />
          <SidebarItem icon={Upload} label="Upload Media" path="/upload" active={location.pathname.startsWith('/upload')} />
          <SidebarItem icon={FileSignature} label="Verification Log" path="/audit" active={location.pathname.startsWith('/audit')} />
        </nav>

        <div className="p-6 border-t border-dark-700/50">
          <div className="flex items-center space-x-3 text-slate-400 hover:text-white cursor-pointer transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Background glow effects */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-neon-cyan/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-neon-blue/10 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2 pointer-events-none" />
        
        {/* Header */}
        <header className="h-20 glass-panel border-x-0 border-t-0 rounded-none bg-dark-800/40 flex items-center justify-between px-8 z-10 relative">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-semibold glowing-text">Public Media Trust Portal</h2>
          </div>
          <div className="flex items-center space-x-6">
            <button className="relative text-slate-400 hover:text-white transition-colors">
              <Bell className="w-6 h-6" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-neon-blue rounded-full"></span>
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-neon-blue to-neon-cyan p-[2px]">
                <div className="w-full h-full bg-dark-800 rounded-full flex items-center justify-center font-bold text-sm">
                  JD
                </div>
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium">Public User</p>
                <p className="text-xs text-slate-400">Community Verification</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8 z-10 relative z-0">
          <Outlet />
        </div>
      </main>

    </div>
  );
};

export default Layout;
