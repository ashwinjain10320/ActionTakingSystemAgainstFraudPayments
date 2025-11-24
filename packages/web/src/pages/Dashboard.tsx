import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { Activity, AlertTriangle, CheckCircle, Clock, XCircle, FileText, Timer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert } from '../types';

export function Dashboard() {
  const { data: alerts, isLoading, error: alertsError } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.getAlerts(),
    retry: 3,
    retryDelay: 1000,
  });

  const { data: health, error: healthError } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.getHealth(),
    refetchInterval: 30000,
    retry: 2,
  });

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.getStats(),
    refetchInterval: 10000, // Refresh every 10 seconds
    retry: 2,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <p className="ml-4 text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  if (alertsError) {
    const error = alertsError as ApiError;
    return (
      <div className="card">
        <div className="flex items-center justify-center flex-col py-12">
          <XCircle className="w-16 h-16 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Dashboard</h3>
          <p className="text-gray-600 text-center max-w-md">
            {error.message || 'Unable to fetch alerts. Please try again.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary mt-4"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const openAlerts = alerts?.filter((a: Alert) => a.status === 'open') || [];
  const highRiskAlerts = openAlerts.filter((a: Alert) => a.risk === 'high');
  const mediumRiskAlerts = openAlerts.filter((a: Alert) => a.risk === 'medium');
  const lowRiskAlerts = openAlerts.filter((a: Alert) => a.risk === 'low');
  
  // Get real data from backend stats API
  const disputesOpened = stats?.disputes?.opened || 0;
  const avgTriageLatency = stats?.triage?.avgLatency || '0ms';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-1">Monitor alerts and system health</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Alerts</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{openAlerts.length}</p>
            </div>
            <Activity className="w-10 h-10 text-gray-400" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">High Risk</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{highRiskAlerts.length}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Medium Risk</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{mediumRiskAlerts.length}</p>
            </div>
            <Clock className="w-10 h-10 text-orange-400" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low Risk</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{lowRiskAlerts.length}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Disputes Opened</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{disputesOpened}</p>
              <p className="text-xs text-gray-500 mt-1">of {stats?.actions?.total || 0} total actions</p>
            </div>
            <FileText className="w-10 h-10 text-blue-400" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Triage Latency</p>
              <p className="text-3xl font-bold text-purple-600 mt-1">{avgTriageLatency}</p>
              <p className="text-xs text-gray-500 mt-1">{stats?.triage?.successRate || 0}% success rate</p>
            </div>
            <Timer className="w-10 h-10 text-purple-400" />
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-3">System Health</h3>
        {healthError ? (
          <div className="text-center py-4">
            <p className="text-sm text-red-600">Unable to fetch health status</p>
          </div>
        ) : health ? (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">API Status</p>
              <p className="text-green-600 font-medium flex items-center mt-1">
                <CheckCircle className="w-4 h-4 mr-1" />
                {health.status}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Database</p>
              <p className="text-green-600 font-medium flex items-center mt-1">
                <CheckCircle className="w-4 h-4 mr-1" />
                {health.database || 'connected'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Redis</p>
              <p className="text-green-600 font-medium flex items-center mt-1">
                <CheckCircle className="w-4 h-4 mr-1" />
                {health.redis || 'connected'}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        )}
      </div>

      {/* Recent High-Risk Alerts */}
      {highRiskAlerts.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">High Risk Alerts</h3>
            <Link to="/alerts" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              View All →
            </Link>
          </div>
          
          <div className="space-y-3">
            {highRiskAlerts.slice(0, 5).map((alert: Alert) => (
              <div
                key={alert.id}
                className="block p-4 bg-red-50 border border-red-200 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                        HIGH RISK
                      </span>
                      <span className="text-sm text-gray-600">
                        Customer: {alert.customerId}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Alert ID: {alert.id}
                    </p>
                  </div>
                  <Link to="/alerts" className="btn btn-danger text-sm">
                    View in Queue →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
