import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Pill, 
  ShoppingCart, 
  FileText, 
  Users, 
  Package, 
  Truck, 
  BarChart3, 
  Box,
  LogOut,
  Menu,
  X,
  Hash,
  Archive,
  RotateCcw
} from 'lucide-react';
import { useState } from 'react';
import BrandLogo from './BrandLogo';

const Layout = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/billing', icon: ShoppingCart, label: 'Billing' },
    { path: '/medicines', icon: Pill, label: 'Medicines' },
    { path: '/suppliers', icon: Truck, label: 'Suppliers' },
    { path: '/purchases', icon: Package, label: 'Purchases' },
    { path: '/inventory', icon: Archive, label: 'Inventory' },
    { path: '/bills', icon: FileText, label: 'Bills' },
    { path: '/sales-returns', icon: RotateCcw, label: 'Sales Return' },
    { path: '/reports', icon: BarChart3, label: 'Reports' },
    ...(isAdmin ? [
      { path: '/hsn-codes', icon: Hash, label: 'HSN Codes' },
      { path: '/assets', icon: Box, label: 'Assets' },
      { path: '/users', icon: Users, label: 'Users' }
    ] : [])
  ];

  return (
    <div className="min-h-screen medical-grid">

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`glass-panel fixed top-0 left-0 z-50 h-full w-[86vw] max-w-[320px] border-r border-white/40 shadow-[0_24px_70px_rgba(15,23,42,0.14)] transform transition-transform duration-300 ease-in-out sm:max-w-[360px] lg:w-72 lg:max-w-none lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="flex flex-col h-full">

          {/* Logo */}
          <div className="flex items-start justify-between px-5 py-5 border-b border-slate-200/70">
            <BrandLogo compact />
            <button onClick={() => setSidebarOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-white/70 lg:hidden">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="mt-4 px-3 overflow-auto flex-1">
            <p className="px-4 pb-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400">Workspace</p>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `group mb-1.5 flex items-center gap-3 rounded-2xl px-4 py-3 transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-600 to-lime-500 text-white shadow-[0_16px_34px_rgba(34,197,94,0.28)]'
                      : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
                  }`
                }
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/14 ring-1 ring-inset ring-white/20 group-hover:bg-white/80">
                  <item.icon className="h-5 w-5" />
                </span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* User Profile */}
          <div className="border-t border-slate-200/70 p-4">

            <div
              onClick={() => navigate('/profile')}
              className="premium-card mb-4 flex items-center cursor-pointer rounded-3xl p-3"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-lime-500 text-white shadow-lg">
                <span className="font-semibold">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="ml-3">
                <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{user?.role}</p>
              </div>

            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex w-full items-center rounded-2xl px-4 py-3 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Logout
            </button>

          </div>

        </div>

      </aside>

      {/* Main Content */}
      <div className="lg:pl-72">

        {/* Header */}
        <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4 lg:px-6 lg:pt-4">
          <div className="glass-panel flex min-h-[72px] flex-col justify-between gap-3 rounded-[24px] border border-white/50 px-4 py-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center sm:rounded-[28px] sm:px-5">
          
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-2xl p-3 text-slate-600 hover:bg-white/80 lg:hidden"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">Bhagya Medicals</p>
              </div>
            </div>

            <div className="ml-0 flex items-center space-x-4 sm:ml-auto">
              <div className="hidden rounded-2xl bg-gradient-to-r from-emerald-50 to-lime-50 px-4 py-2 text-right sm:block">
                <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Signed in as</p>
                <span className="text-sm font-semibold text-slate-900">{user?.name}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-3 sm:p-4 lg:p-6">
          <div className="mx-auto max-w-[1600px]">
            <Outlet />
          </div>
        </main>

      </div>

    </div>
  );
};

export default Layout;
