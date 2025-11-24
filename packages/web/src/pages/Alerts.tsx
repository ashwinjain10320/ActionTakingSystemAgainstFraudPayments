import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Alert } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useMemo, memo, useState } from 'react';
import { TriageDrawer } from '../components/TriageDrawer';

// Memoized Alert Row Component for performance
const AlertRow = memo(({ alert, onClick }: { alert: Alert; onClick: () => void }) => {
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'medium':
        return <Clock className="w-5 h-5 text-orange-600" />;
      case 'low':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={`block p-4 border rounded-lg hover:shadow-md transition-all cursor-pointer ${getRiskColor(
        alert.risk
      )}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label={`Open triage for alert ${alert.id.slice(0, 8)}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            {getRiskIcon(alert.risk)}
            <div>
              <h3 className="font-semibold text-gray-900">
                Alert #{alert.id.slice(0, 8)}
              </h3>
              <p className="text-sm text-gray-600">
                Customer: {alert.customerId}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mt-3">
            <div>
              <span className="text-gray-600">Risk Level:</span>
              <span className="ml-2 font-medium capitalize">{alert.risk}</span>
            </div>
            <div>
              <span className="text-gray-600">Created:</span>
              <span className="ml-2 font-medium">
                {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Transaction:</span>
              <span className="ml-2 font-medium">{alert.suspectTxnId}</span>
            </div>
            <div>
              <span className="text-gray-600">Status:</span>
              <span className="ml-2 font-medium capitalize">{alert.status}</span>
            </div>
          </div>
        </div>

        <button 
          className="btn btn-primary text-sm ml-4"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          aria-label="Start triage"
        >
          Start Triage →
        </button>
      </div>
    </div>
  );
});

AlertRow.displayName = 'AlertRow';

export function Alerts() {
  const parentRef = useRef<HTMLDivElement>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const { data: alerts, isLoading, error } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.getAlerts(),
    retry: 3,
    retryDelay: 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <p className="ml-4 text-gray-600">Loading alerts...</p>
      </div>
    );
  }

  if (error) {
    const apiError = error as ApiError;
    return (
      <div className="card">
        <div className="flex items-center justify-center flex-col py-12">
          <XCircle className="w-16 h-16 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Alerts</h3>
          <p className="text-gray-600 text-center max-w-md">
            {apiError.message || 'Unable to fetch alerts. Please try again.'}
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

  // Memoize filtered alerts
  const openAlerts = useMemo(
    () => alerts?.filter((a: Alert) => a.status === 'open') || [],
    [alerts]
  );

  // Setup virtualizer for efficient rendering
  const rowVirtualizer = useVirtualizer({
    count: openAlerts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180,
    overscan: 5,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Alert Queue</h2>
          <p className="text-gray-600 mt-1">{openAlerts.length} open alerts requiring attention</p>
        </div>
      </div>

      {/* Alerts List with Virtualization */}
      <div className="card">
        {openAlerts.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Open Alerts</h3>
            <p className="text-gray-600">All alerts have been resolved or closed.</p>
          </div>
        ) : (
          <div ref={parentRef} className="h-[600px] overflow-auto">
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="pb-3"
                >
                  <AlertRow 
                    alert={openAlerts[virtualRow.index]} 
                    onClick={() => {
                      setSelectedAlert(openAlerts[virtualRow.index]);
                      setIsDrawerOpen(true);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Triage Drawer */}
      {selectedAlert && (
        <TriageDrawer
          alert={selectedAlert}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setTimeout(() => setSelectedAlert(null), 300);
          }}
        />
      )}
    </div>
  );
}
