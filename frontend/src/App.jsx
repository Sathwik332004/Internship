import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';


// Pages
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import AdminProfile from "./pages/AdminProfile";
import Medicines from './pages/Medicines';
import Billing from './pages/Billing';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import PurchaseReturns from './pages/PurchaseReturns';
import Inventory from './pages/Inventory';
import Bills from './pages/Bills';
import SalesReturns from './pages/SalesReturns';
import Reports from './pages/Reports';
import Assets from './pages/Assets';
import Users from './pages/Users';
import HSNCodes from './pages/HSNCodes';

// Components
import Layout from './components/Layout';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }
  
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }
  
  return isAuthenticated && isAdmin ? children : <Navigate to="/dashboard" />;
};

function AppRoutes() {
  const routes = [
    { path: '/login', element: <Login /> },
    { path: '/forgot-password', element: <ForgotPassword /> },
    {
      path: '/',
      element: <PrivateRoute><Layout /></PrivateRoute>,
      children: [
  { index: true, element: <Navigate to="/dashboard" /> },
  { path: 'dashboard', element: <Dashboard /> },
  { path: 'medicines', element: <Medicines /> },
  { path: 'billing', element: <Billing /> },
  { path: 'suppliers', element: <Suppliers /> },
  { path: 'purchases', element: <Purchases /> },
  { path: 'purchase-returns', element: <PurchaseReturns /> },
  { path: 'inventory', element: <Inventory /> },
  { path: 'bills', element: <Bills /> },
  { path: 'sales-returns', element: <SalesReturns /> },
  { path: 'reports', element: <Reports /> },
  { path: 'profile', element: <AdminProfile /> },   // âœ… ADD THIS
  { path: 'hsn-codes', element: <AdminRoute><HSNCodes /></AdminRoute> },
  { path: 'assets', element: <AdminRoute><Assets /></AdminRoute> },
  { path: 'users', element: <AdminRoute><Users /></AdminRoute> },
],
    },
  ];

  const router = createBrowserRouter(routes, {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  });

  return <RouterProvider router={router} />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  return (
    <>
      <AppRoutes />
      <ToastContainer 
        position="top-right" 
        autoClose={3000}
        hideProgressBar
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        toastClassName="app-toast"
        bodyClassName="app-toast-body"
        progressClassName="app-toast-progress"
        toastStyle={{
          borderRadius: '16px',
          fontFamily: 'Manrope, Segoe UI, sans-serif'
        }}
      />
    </>
  );
}

export default App;
