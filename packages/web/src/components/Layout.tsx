import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, AlertCircle, Activity, BarChart3 } from 'lucide-react';

export function Layout() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Activity className="w-8 h-8 text-primary-600" />
              <h1 className="text-xl font-bold text-gray-900">Sentinel Support</h1>
            </div>
            
            <nav className="flex space-x-1">
              <Link
                to="/dashboard"
                className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                  isActive('/dashboard')
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="font-medium">Dashboard</span>
              </Link>
              
              <Link
                to="/alerts"
                className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                  isActive('/alerts')
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">Alerts</span>
              </Link>
              
              <Link
                to="/evals"
                className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                  isActive('/evals')
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span className="font-medium">Evals</span>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
