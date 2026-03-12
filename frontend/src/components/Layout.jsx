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
  Archive
} from 'lucide-react';
import { useState } from 'react';

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
    { path: '/reports', icon: BarChart3, label: 'Reports' },
    ...(isAdmin ? [
      { path: '/hsn-codes', icon: Hash, label: 'HSN Codes' },
      { path: '/assets', icon: Box, label: 'Assets' },
      { path: '/users', icon: Users, label: 'Users' }
    ] : [])
  ];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="flex flex-col h-full">

          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b">
            <h1 className="text-xl font-bold text-blue-600">Medical Store</h1>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="mt-4 px-2 overflow-auto flex-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 mb-1 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t">

            <div
              onClick={() => navigate('/profile')}
              className="flex items-center mb-4 cursor-pointer hover:bg-gray-100 p-2 rounded-lg"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-semibold">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>

            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 rounded-lg hover:bg-red-50"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Logout
            </button>

          </div>

        </div>

      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">

        {/* Header */}
        <header className="sticky top-0 z-30 h-16 bg-white shadow-sm flex items-center justify-between px-4">
          
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-md hover:bg-gray-100"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="ml-auto flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              Welcome, <span className="font-medium">{user?.name}</span>
            </span>
          </div>

        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>

      </div>

    </div>
  );
};

export default Layout;