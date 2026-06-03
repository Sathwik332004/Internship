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
  RotateCcw,
  Bell,
  BellRing,
  ClipboardList
} from 'lucide-react';
import { useEffect, useState } from 'react';
import BrandLogo from './BrandLogo';
import { notificationAPI } from '../services/api';

const Layout = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/billing', icon: ShoppingCart, label: 'Billing' },
    { path: '/prescriptions', icon: ClipboardList, label: 'Prescriptions' },
    { path: '/medicines', icon: Pill, label: 'Medicines' },
    { path: '/suppliers', icon: Truck, label: 'Suppliers' },
    { path: '/purchases', icon: Package, label: 'Purchases' },
    { path: '/purchase-returns', icon: RotateCcw, label: 'Purchase Return' },
    { path: '/inventory', icon: Archive, label: 'Inventory' },
    { path: '/bills', icon: FileText, label: 'Bills' },
    { path: '/sales-returns', icon: RotateCcw, label: 'Sales Return' },
    { path: '/notifications', icon: BellRing, label: 'Notifications' },
    { path: '/reports', icon: BarChart3, label: 'Reports' },
    ...(isAdmin ? [
      { path: '/hsn-codes', icon: Hash, label: 'HSN Codes' },
      { path: '/assets', icon: Box, label: 'Assets' },
      { path: '/users', icon: Users, label: 'Users' }
    ] : [])
  ];

  useEffect(() => {
    let isMounted = true;

    const fetchUnreadCount = async () => {
      try {
        const response = await notificationAPI.getAll();
        const count = response.data.unreadCount ?? (response.data.data || []).filter((item) => !item.isRead).length;
        if (isMounted) {
          setUnreadCount(count);
        }
      } catch (error) {
        if (isMounted) {
          setUnreadCount(0);
        }
      }
    };

    fetchUnreadCount();
    const intervalId = window.setInterval(fetchUnreadCount, 60000);
    window.addEventListener('notifications:updated', fetchUnreadCount);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('notifications:updated', fetchUnreadCount);
    };
  }, []);

  return (
    <div className="app-shell min-h-screen medical-grid">

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`app-sidebar fixed top-0 left-0 z-50 h-full w-[86vw] max-w-[320px] transform transition-transform duration-300 ease-in-out sm:max-w-[360px] lg:w-72 lg:max-w-none lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="flex flex-col h-full">

          {/* Logo */}
          <div className="flex items-start justify-between border-b border-gray-200 px-5 py-5">
            <BrandLogo compact />
            <button onClick={() => setSidebarOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-white/60 lg:hidden">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="mt-4 px-3 overflow-auto flex-1">
            <p className="px-4 pb-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">Main Menu</p>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `app-nav-item group mb-1.5 flex items-center gap-3 rounded-2xl px-4 py-3 transition-all ${
                    isActive
                      ? 'active'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <span className="app-nav-icon flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset">
                  <item.icon className="h-5 w-5" />
                </span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* User Profile */}
          <div className="border-t border-white/10 p-4">

            <div
              onClick={() => navigate('/profile')}
              className="mb-4 flex cursor-pointer items-center rounded-[24px] border border-gray-200 bg-white p-3 shadow-[0_12px_28px_rgba(15,23,42,0.06)]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#171717] text-white shadow-sm">
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
              className="flex w-full items-center rounded-2xl px-4 py-3 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 hover:text-rose-800"
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
          <div className="app-topbar flex min-h-[80px] items-center justify-between gap-3 rounded-[24px] px-4 py-3 sm:px-5">
          
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-2xl p-3 text-slate-700 hover:bg-white/70 lg:hidden"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="md:hidden">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">Bhagya Medicals Workspace</p>
              </div>
            </div>

            <div className="ml-0 flex items-center gap-3 sm:ml-auto">
              <button
                type="button"
                onClick={() => navigate('/notifications')}
                className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white text-slate-700 shadow-[0_14px_30px_rgba(15,23,42,0.05)] transition-colors hover:bg-slate-50"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white ring-2 ring-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : null}
              </button>
              <div className="hidden rounded-[20px] border border-gray-200 bg-white px-4 py-2 text-right sm:block">
                <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Signed in as</p>
                <span className="text-sm font-semibold text-slate-900">{user?.name}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-3 sm:p-4 lg:p-6">
          <div className="app-content-shell mx-auto max-w-[1600px]">
            <Outlet />
          </div>
        </main>

      </div>

    </div>
  );
};

export default Layout;
