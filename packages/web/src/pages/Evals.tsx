import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CheckCircle, XCircle, AlertTriangle, Play, TrendingUp, TrendingDown } from 'lucide-react';

interface EvalResult {
  id: string;
  timestamp: string;
  scenario: string;
  expected: string;
  actual: string;
  passed: boolean;
  latencyMs: number;
  details?: string;
}

export function Evals() {
  const [isRunning, setIsRunning] = useState(false);

  // Fetch all alerts to run evals on
  const { data: alerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.getAlerts(),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch real eval results from backend
  const { data: results = [], isLoading, refetch } = useQuery({
    queryKey: ['eval-results'],
    queryFn: () => api.getEvalResults(50),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const passedCount = results.filter((r: EvalResult) => r.passed).length;
  const failedCount = results.filter((r: EvalResult) => !r.passed).length;
  const accuracy = results.length > 0 ? ((passedCount / results.length) * 100).toFixed(1) : '0.0';
  const avgLatency = results.length > 0 
    ? (results.reduce((sum: number, r: EvalResult) => sum + r.latencyMs, 0) / results.length).toFixed(0)
    : '0';

  // Build Confusion Matrix from real data
  const actions = ['freeze_card', 'contact_customer', 'open_dispute', 'mark_false_positive'];
  const confusionMatrix: Record<string, Record<string, number>> = {};
  
  actions.forEach(expected => {
    confusionMatrix[expected] = {};
    actions.forEach(actual => {
      confusionMatrix[expected][actual] = results.filter(
        (r: EvalResult) => r.expected === expected && r.actual === actual
      ).length;
    });
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <p className="ml-4 text-gray-600">Loading evaluation results...</p>
      </div>
    );
  }

  const handleRunEvals = async () => {
    if (!alerts || alerts.length === 0) {
      alert('No alerts available to run evals');
      return;
    }

    setIsRunning(true);
    const alertsToRun = alerts.slice(0, 5); // Run evals on first 5 alerts
    const runIds: string[] = [];

    try {
      // Run triage on multiple alerts
      for (const alert of alertsToRun) {
        const response = await api.startTriage(alert.id);
        runIds.push(response.runId);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Wait for all triages to complete
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Refetch eval results
      await refetch();
      
      alert(`Evaluation completed! Ran ${runIds.length} triage sessions.`);
    } catch (error: any) {
      console.error('Eval run error:', error);
      alert(`Eval run failed: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Evaluation Dashboard</h2>
          <p className="text-gray-600 mt-1">Run and analyze triage agent performance</p>
        </div>
        <button
          onClick={handleRunEvals}
          disabled={isRunning}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Play className="w-4 h-4" />
          <span>{isRunning ? 'Running...' : 'Run Evals'}</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Accuracy</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{accuracy}%</p>
            </div>
            {parseFloat(accuracy) >= 80 ? (
              <TrendingUp className="w-10 h-10 text-green-400" />
            ) : (
              <TrendingDown className="w-10 h-10 text-red-400" />
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Passed</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{passedCount}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Failed</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{failedCount}</p>
            </div>
            <XCircle className="w-10 h-10 text-red-400" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Latency</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{avgLatency}ms</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-orange-400" />
          </div>
        </div>
      </div>

      {/* Confusion Matrix */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Confusion Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-3 px-3 font-semibold">Actual / Expected</th>
                <th className="text-center py-3 px-3 font-semibold">Freeze Card</th>
                <th className="text-center py-3 px-3 font-semibold">Contact Customer</th>
                <th className="text-center py-3 px-3 font-semibold">Open Dispute</th>
                <th className="text-center py-3 px-3 font-semibold">False Positive</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-3 px-3 font-medium">Freeze Card</td>
                <td className="text-center py-3 px-3 bg-green-50 font-semibold">
                  {confusionMatrix.freeze_card.freeze_card}
                </td>
                <td className="text-center py-3 px-3 bg-red-50">
                  {confusionMatrix.freeze_card.contact_customer}
                </td>
                <td className="text-center py-3 px-3">{confusionMatrix.freeze_card.open_dispute}</td>
                <td className="text-center py-3 px-3">{confusionMatrix.freeze_card.mark_false_positive}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-3 px-3 font-medium">Contact Customer</td>
                <td className="text-center py-3 px-3">{confusionMatrix.contact_customer.freeze_card}</td>
                <td className="text-center py-3 px-3 bg-green-50 font-semibold">
                  {confusionMatrix.contact_customer.contact_customer}
                </td>
                <td className="text-center py-3 px-3 bg-red-50">
                  {confusionMatrix.contact_customer.open_dispute}
                </td>
                <td className="text-center py-3 px-3">{confusionMatrix.contact_customer.mark_false_positive}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-3 px-3 font-medium">Open Dispute</td>
                <td className="text-center py-3 px-3">{confusionMatrix.open_dispute.freeze_card}</td>
                <td className="text-center py-3 px-3">{confusionMatrix.open_dispute.contact_customer}</td>
                <td className="text-center py-3 px-3 bg-green-50 font-semibold">
                  {confusionMatrix.open_dispute.open_dispute}
                </td>
                <td className="text-center py-3 px-3">{confusionMatrix.open_dispute.mark_false_positive}</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-medium">False Positive</td>
                <td className="text-center py-3 px-3">{confusionMatrix.mark_false_positive.freeze_card}</td>
                <td className="text-center py-3 px-3">{confusionMatrix.mark_false_positive.contact_customer}</td>
                <td className="text-center py-3 px-3">{confusionMatrix.mark_false_positive.open_dispute}</td>
                <td className="text-center py-3 px-3 bg-green-50 font-semibold">
                  {confusionMatrix.mark_false_positive.mark_false_positive}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-600">
          <p>
            <span className="inline-block w-4 h-4 bg-green-50 border border-green-200 mr-2"></span>
            Correct predictions (diagonal)
          </p>
          <p className="mt-1">
            <span className="inline-block w-4 h-4 bg-red-50 border border-red-200 mr-2"></span>
            Incorrect predictions
          </p>
        </div>
      </div>

      {/* Top Failures */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Top Failures</h3>
        <div className="space-y-3">
          {results
            .filter((r: EvalResult) => !r.passed)
            .map((result: EvalResult) => (
              <div key={result.id} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span className="font-semibold text-gray-900">{result.scenario}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                      <div>
                        <span className="text-gray-600">Expected:</span>
                        <span className="ml-2 font-medium text-gray-900">{result.expected}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Actual:</span>
                        <span className="ml-2 font-medium text-red-600">{result.actual}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Latency:</span>
                        <span className="ml-2 font-medium">{result.latencyMs}ms</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Test ID:</span>
                        <span className="ml-2 font-mono text-xs">{result.id}</span>
                      </div>
                    </div>
                    {result.details && (
                      <div className="mt-2 p-2 bg-white rounded text-sm text-gray-700">
                        <strong>Details:</strong> {result.details}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* All Results */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">All Test Results</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3">Status</th>
                <th className="text-left py-2 px-3">Scenario</th>
                <th className="text-left py-2 px-3">Expected</th>
                <th className="text-left py-2 px-3">Actual</th>
                <th className="text-right py-2 px-3">Latency</th>
                <th className="text-left py-2 px-3">Test ID</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result: EvalResult) => (
                <tr key={result.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3">
                    {result.passed ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                  </td>
                  <td className="py-2 px-3">{result.scenario}</td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                      {result.expected}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        result.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {result.actual}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono">{result.latencyMs}ms</td>
                  <td className="py-2 px-3 font-mono text-xs text-gray-600">{result.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
