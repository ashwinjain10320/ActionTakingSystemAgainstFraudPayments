import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { Play, CheckCircle, XCircle, Clock, AlertTriangle, X } from 'lucide-react';
import { TriageEvent, Alert } from '../types';

interface TriageDrawerProps {
  alert: Alert;
  isOpen: boolean;
  onClose: () => void;
}

export function TriageDrawer({ alert, isOpen, onClose }: TriageDrawerProps) {
  const [events, setEvents] = useState<TriageEvent[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [modalMessage, setModalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [triageResult, setTriageResult] = useState<any>(null);
  const queryClient = useQueryClient();
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Fetch full alert details with customer/cards when drawer opens
  const { data: fullAlert } = useQuery({
    queryKey: ['alert', alert.id],
    queryFn: () => api.getAlert(alert.id),
    enabled: isOpen,
    staleTime: 30000,
  });

  // Use full alert data if available, otherwise use prop
  const alertData = fullAlert || alert;

  // Save focus on mount and restore on unmount
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setTimeout(() => closeButtonRef.current?.focus(), 100);
    }
    return () => {
      if (!isOpen && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;

    const focusableElements = drawerRef.current.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen, triageResult, isStreaming]);

  const startTriageMutation = useMutation({
    mutationFn: (alertId: string) => api.startTriage(alertId),
    onSuccess: (data) => {
      startStreaming(data.runId);
    },
  });

  const freezeCardMutation = useMutation({
    mutationFn: ({ cardId, otp }: { cardId: string; otp?: string }) =>
      api.freezeCard(cardId, otp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert', alert.id] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setModalMessage({ type: 'success', text: '✅ Card frozen successfully!' });
      setShowSuccessModal(true);
    },
    onError: (error: any) => {
      const apiError = error as ApiError;
      setModalMessage({ type: 'error', text: apiError.message || 'Failed to freeze card' });
      setShowSuccessModal(true);
    },
  });

  const openDisputeMutation = useMutation({
    mutationFn: ({ txnId, reasonCode }: { txnId: string; reasonCode: string }) =>
      api.openDispute(txnId, reasonCode, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert', alert.id] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setModalMessage({ type: 'success', text: '✅ Dispute opened successfully!' });
      setShowSuccessModal(true);
    },
    onError: (error: any) => {
      const apiError = error as ApiError;
      setModalMessage({ type: 'error', text: apiError.message || 'Failed to open dispute' });
      setShowSuccessModal(true);
    },
  });

  const contactCustomerMutation = useMutation({
    mutationFn: ({ customerId, message, alertId }: { customerId: string; message: string; alertId?: string }) =>
      api.contactCustomer(customerId, message, alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert', alert.id] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setModalMessage({ type: 'success', text: '✅ Customer contact case created!' });
      setShowSuccessModal(true);
    },
    onError: (error: any) => {
      const apiError = error as ApiError;
      setModalMessage({ type: 'error', text: apiError.message || 'Failed to contact customer' });
      setShowSuccessModal(true);
    },
  });

  const markFalsePositiveMutation = useMutation({
    mutationFn: (alertId: string) => api.markFalsePositive(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert', alert.id] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setModalMessage({ type: 'success', text: '✅ Marked as false positive!' });
      setShowSuccessModal(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    },
    onError: (error: any) => {
      const apiError = error as ApiError;
      setModalMessage({ type: 'error', text: apiError.message || 'Failed to mark as false positive' });
      setShowSuccessModal(true);
    },
  });

  const startStreaming = (runId: string) => {
    setIsStreaming(true);
    setEvents([]);

    const eventSource = api.createTriageStream(alert.id, runId);

    eventSource.onmessage = (event) => {
      const data: TriageEvent = JSON.parse(event.data);
      
      // Update existing event or add new one
      setEvents((prev) => {
        // If it's a tool_update with step, check if we should update existing
        if (data.type === 'tool_update' && data.step) {
          const existingIndex = prev.findIndex(
            (e) => e.type === 'tool_update' && e.step === data.step && e.status === 'running'
          );
          
          if (existingIndex !== -1 && data.status === 'completed') {
            // Replace the running event with completed
            const updated = [...prev];
            updated[existingIndex] = data;
            return updated;
          }
        }
        
        // Otherwise, add new event
        return [...prev, data];
      });

      if (data.type === 'decision_finalized') {
        setTriageResult(data);
      }

      if (data.type === 'completed') {
        setIsStreaming(false);
        eventSource.close();
        setModalMessage({ 
          type: 'success', 
          text: '✅ Triage completed successfully! Review the recommendation and take action.' 
        });
        setShowSuccessModal(true);
      }

      if (data.type === 'error') {
        setIsStreaming(false);
        eventSource.close();
        setModalMessage({ 
          type: 'error', 
          text: 'Triage failed. Please try again or contact support.' 
        });
        setShowSuccessModal(true);
      }
    };

    eventSource.onerror = () => {
      setIsStreaming(false);
      eventSource.close();
    };
  };

  const handleStartTriage = () => {
    startTriageMutation.mutate(alert.id);
  };

  const handleFreezeCard = () => {
    if (!alertData.customer?.cards?.[0]) {
      setModalMessage({ type: 'error', text: 'No card found for this customer' });
      setShowSuccessModal(true);
      return;
    }
    const cardId = alertData.customer.cards[0].id;
    const otp = alertData.customer.kycLevel === 'basic' ? prompt('Enter OTP (use 123456 for demo):') : undefined;
    freezeCardMutation.mutate({ cardId, otp: otp || undefined });
  };

  const handleOpenDispute = () => {
    if (!alert.suspectTxnId) return;
    const reasonCode = prompt('Enter reason code (10.4, 12.1, 13.1):') || '10.4';
    openDisputeMutation.mutate({ txnId: alert.suspectTxnId, reasonCode });
  };

  const handleContactCustomer = () => {
    const message = prompt('Enter message for customer (minimum 10 characters):') || 'We need to verify recent activity on your account.';
    if (message && message.trim().length < 10) {
      setModalMessage({ type: 'error', text: 'Message must be at least 10 characters' });
      setShowSuccessModal(true);
      return;
    }
    contactCustomerMutation.mutate({ customerId: alert.customerId, message, alertId: alert.id });
  };

  const handleMarkFalsePositive = () => {
    if (confirm('Are you sure you want to mark this as a false positive?')) {
      markFalsePositiveMutation.mutate(alert.id);
    }
  };

  const getEventIcon = (event: TriageEvent) => {
    switch (event.type) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'plan_built':
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
      case 'tool_update':
        return event.status === 'completed' ? (
          <CheckCircle className="w-5 h-5 text-green-600" />
        ) : (
          <Clock className="w-5 h-5 text-yellow-600 animate-spin" />
        );
      case 'fallback_triggered':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'decision_finalized':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getRiskBadge = (risk: string) => {
    const colors = {
      high: 'bg-red-100 text-red-800 border-red-200',
      medium: 'bg-orange-100 text-orange-800 border-orange-200',
      low: 'bg-green-100 text-green-800 border-green-200',
    };
    return colors[risk as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Success/Error Modal Popup */}
      {showSuccessModal && modalMessage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setShowSuccessModal(false)}
            aria-hidden="true"
          />
          <div
            className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full z-10 animate-fadeIn"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start space-x-4">
              {modalMessage.type === 'success' ? (
                <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
              ) : (
                <XCircle className="w-8 h-8 text-red-600 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {modalMessage.type === 'success' ? 'Success' : 'Error'}
                </h3>
                <p className="text-gray-700">{modalMessage.text}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowSuccessModal(false)}
                className="btn btn-primary"
                autoFocus
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed inset-y-0 right-0 w-full max-w-3xl bg-white shadow-2xl z-50 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 id="drawer-title" className="text-xl font-bold text-gray-900">
              Alert Triage
            </h2>
            <p className="text-sm text-gray-600">Alert ID: {alert.id.slice(0, 8)}</p>
          </div>
          <div className="flex items-center space-x-3">
            {!isStreaming && !triageResult && (
              <button
                onClick={handleStartTriage}
                disabled={startTriageMutation.isPending}
                className="btn btn-primary flex items-center space-x-2"
                aria-label="Start triage process"
              >
                <Play className="w-4 h-4" />
                <span>{startTriageMutation.isPending ? 'Starting...' : 'Start Triage'}</span>
              </button>
            )}
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close drawer"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Alert Info */}
          <div className="card">
            <h3 className="font-semibold mb-3">Alert Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Customer:</span>
                <Link
                  to={`/customer/${alertData.customerId}`}
                  className="ml-2 font-medium text-primary-600 hover:text-primary-700 hover:underline"
                >
                  {alertData.customer?.name || alertData.customerId}
                </Link>
              </div>
              <div>
                <span className="text-gray-600">Risk Level:</span>
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium border ${getRiskBadge(alertData.risk)}`}>
                  {alertData.risk.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Suspect Transaction:</span>
                <span className="ml-2 font-mono text-xs">{alertData.suspectTxnId}</span>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>
                <span className="ml-2 font-medium capitalize">{alertData.status}</span>
              </div>
            </div>
          </div>

          {/* Triage Stream */}
          {(isStreaming || events.length > 0) && (
            <div className="card" role="region" aria-label="Triage progress">
              <h3 id="triage-progress-title" className="font-semibold mb-4">Triage Progress</h3>
              <div className="space-y-3" role="log" aria-live="polite" aria-atomic="false" aria-labelledby="triage-progress-title">
                {events.map((event, idx) => (
                  <div key={idx} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 mt-1">{getEventIcon(event)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 capitalize">
                          {event.type.replace(/_/g, ' ')}
                        </span>
                        {event.duration && <span className="text-xs text-gray-500">{event.duration}ms</span>}
                      </div>

                      {event.plan && (
                        <div className="mt-1 text-sm text-gray-600">Plan: {event.plan.join(' → ')}</div>
                      )}

                      {event.step && (
                        <div className="mt-1 text-sm text-gray-600">
                          Step: <span className="font-mono">{event.step}</span>
                          {event.status && ` (${event.status})`}
                        </div>
                      )}

                      {event.reason && <div className="mt-1 text-sm text-orange-600">Fallback: {event.reason}</div>}

                      {event.reasons && (
                        <div className="mt-2 space-y-1">
                          {event.reasons.map((reason, i) => (
                            <div key={i} className="text-sm text-gray-700">
                              • {reason}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {isStreaming && (
                <div className="mt-4 flex items-center space-x-2 text-sm text-gray-600" aria-live="polite">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                  <span>Processing triage...</span>
                </div>
              )}
            </div>
          )}

          {/* Decision & Actions */}
          {triageResult && (
            <div className="card">
              <h3 className="font-semibold mb-4">Recommended Action</h3>

              <div className={`p-4 rounded-lg border mb-4 ${getRiskBadge(triageResult.risk)}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-lg">Risk: {triageResult.risk?.toUpperCase()}</span>
                  <span className="text-sm">Processed in {triageResult.latencyMs}ms</span>
                </div>
                <div className="text-sm font-medium">
                  Action: {triageResult.recommendedAction?.replace(/_/g, ' ')}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleFreezeCard}
                  disabled={freezeCardMutation.isPending}
                  className="btn btn-danger"
                  aria-label="Freeze customer card"
                >
                  {freezeCardMutation.isPending ? 'Freezing...' : 'Freeze Card'}
                </button>
                <button
                  onClick={handleOpenDispute}
                  disabled={openDisputeMutation.isPending}
                  className="btn btn-primary"
                  aria-label="Open dispute for transaction"
                >
                  {openDisputeMutation.isPending ? 'Opening...' : 'Open Dispute'}
                </button>
                <button
                  onClick={handleContactCustomer}
                  disabled={contactCustomerMutation.isPending}
                  className="btn btn-secondary"
                  aria-label="Contact customer"
                >
                  {contactCustomerMutation.isPending ? 'Creating...' : 'Contact Customer'}
                </button>
                <button
                  onClick={handleMarkFalsePositive}
                  disabled={markFalsePositiveMutation.isPending}
                  className="btn btn-secondary"
                  aria-label="Mark alert as false positive"
                >
                  {markFalsePositiveMutation.isPending ? 'Marking...' : 'Mark False Positive'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
