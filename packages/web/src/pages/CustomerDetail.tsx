import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { CreditCard, User, TrendingUp, ChevronLeft, XCircle, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Transaction } from '../types';
import { useState, memo } from 'react';

// Memoized Transaction Row Component
const TransactionRow = memo(({ txn, formatCurrency }: { txn: Transaction; formatCurrency: (cents: number) => string }) => (
  <tr className="border-b border-gray-100 hover:bg-gray-50">
    <td className="py-2 px-3">
      {new Date(txn.ts).toLocaleDateString()}
    </td>
    <td className="py-2 px-3">{txn.merchant}</td>
    <td className="py-2 px-3">
      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
        {txn.mcc}
      </span>
    </td>
    <td className="py-2 px-3 text-right font-medium">
      {formatCurrency(txn.amountCents)}
    </td>
    <td className="py-2 px-3 text-gray-600 font-mono text-xs">
      {txn.cardId.slice(-8)}
    </td>
  </tr>
));

TransactionRow.displayName = 'TransactionRow';

export function CustomerDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const [cursor, setCursor] = useState<string | undefined>();

  const { data: customer, isLoading: customerLoading, error: customerError } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => api.getCustomer(customerId!),
    enabled: !!customerId,
    retry: 2,
  });

  const { data: transactions, isLoading: transactionsLoading, error: transactionsError } = useQuery({
    queryKey: ['transactions', customerId, cursor],
    queryFn: () => api.getCustomerTransactions(customerId!, { cursor, limit: 50 }),
    enabled: !!customerId,
    retry: 2,
  });

  const { data: insights, error: insightsError } = useQuery({
    queryKey: ['insights', customerId],
    queryFn: () => api.getCustomerInsights(customerId!),
    enabled: !!customerId,
    retry: 1,
  });

  if (customerLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <p className="ml-4 text-gray-600">Loading customer details...</p>
      </div>
    );
  }

  if (customerError) {
    const error = customerError as ApiError;
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link to="/alerts" className="text-gray-600 hover:text-gray-900">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">Customer Details</h2>
        </div>
        <div className="card">
          <div className="flex items-center justify-center flex-col py-12">
            <XCircle className="w-16 h-16 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Customer</h3>
            <p className="text-gray-600 text-center max-w-md">
              {error.message || 'Unable to fetch customer details.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary mt-4"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="card">
        <div className="flex items-center justify-center flex-col py-12">
          <AlertTriangle className="w-16 h-16 text-orange-500 mb-4" />
          <p className="text-center text-gray-600">Customer not found</p>
          <Link to="/alerts" className="btn btn-secondary mt-4">
            Back to Alerts
          </Link>
        </div>
      </div>
    );
  }

  const formatCurrency = (cents: number) => {
    return `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{customer.name}</h2>
          <p className="text-gray-600">{customer.emailMasked}</p>
        </div>
      </div>

      {/* Customer Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center space-x-3 mb-2">
            <User className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold">Customer Info</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600">ID:</span>
              <span className="ml-2 font-mono">{customer.id}</span>
            </div>
            <div>
              <span className="text-gray-600">KYC Level:</span>
              <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                customer.kycLevel === 'full' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {customer.kycLevel.toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Member Since:</span>
              <span className="ml-2">{formatDistanceToNow(new Date(customer.createdAt), { addSuffix: true })}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-3 mb-2">
            <CreditCard className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold">Cards</h3>
          </div>
          <div className="space-y-2">
            {customer.cards?.map((card: any) => (
              <div key={card.id} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono">•••• {card.last4}</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    card.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {card.status}
                  </span>
                </div>
                <div className="text-gray-600">{card.network}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-3 mb-2">
            <TrendingUp className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold">Accounts</h3>
          </div>
          <div className="space-y-2">
            {customer.accounts?.map((account: any) => (
              <div key={account.id} className="text-sm">
                <div className="font-semibold">{formatCurrency(account.balanceCents)}</div>
                <div className="text-gray-600">{account.currency}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Insights */}
      {insightsError ? (
        <div className="card">
          <div className="text-center py-6">
            <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-3" />
            <p className="text-sm text-gray-600">Unable to load customer insights</p>
          </div>
        </div>
      ) : insights && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-semibold mb-3">Top Merchants</h3>
            <div className="space-y-2">
              {insights.topMerchants && insights.topMerchants.length > 0 ? (
                insights.topMerchants.slice(0, 5).map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{item.merchant}</span>
                    <span className="text-gray-600">{item.count} transactions</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No data available</p>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-3">Spending Categories</h3>
            <div className="space-y-2">
              {insights.categories && insights.categories.length > 0 ? (
                insights.categories.slice(0, 5).map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{item.name}</span>
                    <span className="text-gray-600">{(item.pct * 100).toFixed(1)}%</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No data available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Anomalies */}
      {insights?.anomalies && insights.anomalies.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-3">Anomalies Detected</h3>
          <div className="space-y-2">
            {insights.anomalies.map((anomaly: any, idx: number) => (
              <div key={idx} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{anomaly.merchant}</div>
                    <div className="text-gray-600">{new Date(anomaly.ts).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(anomaly.amountCents)}</div>
                    <div className="text-gray-600">z-score: {anomaly.z}</div>
                  </div>
                </div>
                <div className="mt-1 text-yellow-800">{anomaly.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions with Virtualization */}
      <div className="card">
        <h3 className="font-semibold mb-4">Recent Transactions</h3>
        
        {transactionsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="ml-3 text-gray-600">Loading transactions...</p>
          </div>
        ) : transactionsError ? (
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-3" />
            <p className="text-sm text-gray-600">Unable to load transactions</p>
          </div>
        ) : transactions?.items && transactions.items.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3">Date</th>
                    <th className="text-left py-2 px-3">Merchant</th>
                    <th className="text-left py-2 px-3">Category</th>
                    <th className="text-right py-2 px-3">Amount</th>
                    <th className="text-left py-2 px-3">Card</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.items.map((txn: Transaction) => (
                    <TransactionRow key={txn.id} txn={txn} formatCurrency={formatCurrency} />
                  ))}
                </tbody>
              </table>
            </div>

            {transactions.nextCursor && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setCursor(transactions.nextCursor)}
                  className="btn btn-secondary text-sm"
                >
                  Load More
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No transactions found</p>
          </div>
        )}
      </div>
    </div>
  );
}
