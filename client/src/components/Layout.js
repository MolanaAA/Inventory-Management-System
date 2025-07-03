import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  FiHome, 
  FiPackage, 
  FiTruck, 
  FiDollarSign, 
  FiMapPin, 
  FiUsers, 
  FiMenu, 
  FiX, 
  FiLogOut, 
  FiUser,
  FiSettings,
  FiGrid
} from 'react-icons/fi';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: FiHome },
    { name: 'Products', href: '/products', icon: FiPackage },
    { name: 'Inventory', href: '/inventory', icon: FiTruck },
    { name: 'Sales', href: '/sales', icon: FiDollarSign },
    ...(isAdmin ? [
      { name: 'Locations', href: '/locations', icon: FiMapPin },
      { name: 'Users', href: '/users', icon: FiUsers }
    ] : [])
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 h-screen fixed left-0 top-0 z-40 bg-white shadow-xl">
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center">
            <FiGrid className="h-8 w-8 text-white mr-3" />
            <h1 className="text-xl font-bold text-white">Inventory Pro</h1>
          </div>
        </div>
        {/* Navigation */}
        <nav className="mt-6 px-3 flex-1 overflow-y-auto">
          <div className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive(item.href)
                      ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-500'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`mr-3 h-5 w-5 ${
                    isActive(item.href) ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                  }`} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>
        {/* User info at bottom */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
                <FiUser className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user?.role}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="ml-2 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
              title="Logout"
            >
              <FiLogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-64 h-full bg-white shadow-xl z-50">
            <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
              <div className="flex items-center">
                <FiGrid className="h-8 w-8 text-white mr-3" />
                <h1 className="text-xl font-bold text-white">Inventory Pro</h1>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-md text-white hover:bg-blue-600"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>
            <nav className="mt-6 px-3 flex-1 overflow-y-auto">
              <div className="space-y-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                        isActive(item.href)
                          ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-500'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className={`mr-3 h-5 w-5 ${
                        isActive(item.href) ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                      }`} />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </nav>
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
                    <FiUser className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {user?.role}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-2 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                  title="Logout"
                >
                  <FiLogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main area (header + content) */}
      <div className="flex flex-col flex-1 min-h-screen ml-0 lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white shadow-sm border-b border-gray-200 h-16 flex items-center px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 mr-4"
          >
            <FiMenu className="h-6 w-6" />
          </button>
          <div className="flex-1 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {navigation.find(item => isActive(item.href))?.name || 'Dashboard'}
              </h2>
              <p className="text-sm text-gray-500">
                Welcome back, {user?.firstName}!
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <div className="relative">
                  <FiSettings className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span>
                </div>
              </button>
              <div className="hidden sm:flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {user?.role}
                  </p>
                </div>
                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
                  <FiUser className="h-4 w-4 text-white" />
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <FiLogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </header>
        {/* Main content */}
        <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout; 