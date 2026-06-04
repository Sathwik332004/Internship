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
  ClipboardList,
  FileClock,
  CalendarClock,
  ChevronRight,
  Activity
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

  const navGroups = [
    {
      label: 'Operations',
      items: [
        { path: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/billing',         icon: ShoppingCart,    label: 'Billing' },
        { path: '/prescriptions',   icon: ClipboardList,   label: 'Prescriptions' },
        { path: '/bills',           icon: FileText,        label: 'Bills' },
        { path: '/sales-returns',   icon: RotateCcw,       label: 'Sales Returns' },
      ]
    },
    {
      label: 'Inventory',
      items: [
        { path: '/medicines',        icon: Pill,        label: 'Medicines' },
        { path: '/inventory',        icon: Archive,     label: 'Inventory' },
        { path: '/suppliers',        icon: Truck,       label: 'Suppliers' },
        { path: '/purchases',        icon: Package,     label: 'Purchases' },
        { path: '/purchase-orders',  icon: ClipboardList, label: 'Purchase Orders' },
        { path: '/purchase-returns', icon: RotateCcw,   label: 'Purchase Returns' },
      ]
    },
    {
      label: 'Management',
      items: [
        { path: '/notifications',   icon: BellRing,      label: 'Notifications' },
        { path: '/staff-attendance',icon: CalendarClock, label: 'Attendance' },
        { path: '/reports',         icon: BarChart3,     label: 'Reports' },
        ...(isAdmin ? [
          { path: '/audit-logs',    icon: FileClock,     label: 'Audit Logs' },
          { path: '/hsn-codes',     icon: Hash,          label: 'HSN Codes' },
          { path: '/assets',        icon: Box,           label: 'Assets' },
          { path: '/users',         icon: Users,         label: 'Users' },
        ] : [])
      ]
    }
  ];

  useEffect(() => {
    let isMounted = true;

    const fetchUnreadCount = async () => {
      try {
        const response = await notificationAPI.getAll();
        const count = response.data.unreadCount ?? (response.data.data || []).filter((item) => !item.isRead).length;
        if (isMounted) setUnreadCount(count);
      } catch {
        if (isMounted) setUnreadCount(0);
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
    <div className="app-shell min-h-screen flex" style={{ background: 'var(--bg)' }}>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(15,31,61,0.55)', backdropFilter: 'blur(3px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside
        className={`app-sidebar fixed top-0 left-0 z-50 h-full flex flex-col
          w-[272px] transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'var(--sidebar-bg)' }}
      >
        {/* Logo bar */}
        <div className="flex items-center justify-between px-5 py-5"
          style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
          <BrandLogo compact />
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: 'rgba(148,163,184,0.6)' }}>
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `app-nav-item flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all ${
                        isActive ? 'active' : ''
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className="app-nav-icon flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset shrink-0">
                          <item.icon className="h-4 w-4" />
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-60 shrink-0" />}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User panel */}
        <div className="p-3" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          <button
            onClick={() => { navigate('/profile'); setSidebarOpen(false); }}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/8 transition-colors text-left mb-1"
            style={{ '--tw-bg-opacity': 1 }}
          >
            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-sm"
              style={{ background: 'var(--brand)' }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: '#e2e8f0' }}>{user?.name}</p>
              <p className="text-xs capitalize" style={{ color: 'var(--sidebar-text)' }}>{user?.role}</p>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ color: '#f87171' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign Out
          </button>
        </div>

      </aside>

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-[272px]">

        {/* Top bar */}
        <header className="sticky top-0 z-30 px-4 pt-3 lg:px-6 lg:pt-4">
          <div className="app-topbar flex items-center justify-between gap-4 rounded-2xl px-4 py-3 lg:px-5"
            style={{ minHeight: 64 }}>

            {/* Left: mobile menu + breadcrumb */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* System badge — desktop */}
              <div className="hidden lg:flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--brand)' }}>
                  <Activity className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Bhagya Medicals</p>
                  <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-faint)' }}>Pharmacy Management</p>
                </div>
              </div>
            </div>

            {/* Right: notifications + user chip */}
            <div className="flex items-center gap-2.5 ml-auto">

              {/* Notification bell */}
              <button
                onClick={() => navigate('/notifications')}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border transition-colors"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }}
                title="Notifications"
                onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface)'}
              >
                <Bell className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* User chip */}
              <button
                onClick={() => navigate('/profile')}
                className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-colors"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface)'}
              >
                <div className="h-7 w-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: 'var(--brand)' }}>
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold leading-none" style={{ color: 'var(--text)' }}>{user?.name}</p>
                  <p className="text-[10px] capitalize mt-0.5" style={{ color: 'var(--text-faint)' }}>{user?.role}</p>
                </div>
              </button>

            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <div className="app-content-shell mx-auto max-w-[1600px]">
            <Outlet />
          </div>
        </main>

      </div>
    </div>
  );
};

export default Layout;
