import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public message: string,
    public status?: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'sentinel-api-key-12345',
      },
      timeout: 30000,
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<any>) => {
        if (error.response) {
          // Server responded with error status
          const message = error.response.data?.error || error.response.data?.message || 'An error occurred';
          throw new ApiError(
            message,
            error.response.status,
            error.response.data?.code,
            error.response.data
          );
        } else if (error.request) {
          // Request made but no response received
          throw new ApiError(
            'Unable to connect to the server. Please check your connection.',
            0,
            'NETWORK_ERROR'
          );
        } else {
          // Error setting up request
          throw new ApiError(error.message || 'An unexpected error occurred');
        }
      }
    );
  }

  // Customer APIs
  async getCustomer(customerId: string) {
    try {
      const { data } = await this.client.get(`/api/customer/${customerId}`);
      return data;
    } catch (error) {
      console.error('Failed to fetch customer:', error);
      throw error;
    }
  }

  async getCustomerTransactions(customerId: string, params?: { from?: string; to?: string; cursor?: string; limit?: number }) {
    try {
      const { data } = await this.client.get(`/api/customer/${customerId}/transactions`, { params });
      return data;
    } catch (error) {
      console.error('Failed to fetch customer transactions:', error);
      throw error;
    }
  }

  // Insights API
  async getCustomerInsights(customerId: string) {
    try {
      const { data } = await this.client.get(`/api/insights/${customerId}/summary`);
      return data;
    } catch (error) {
      console.error('Failed to fetch customer insights:', error);
      throw error;
    }
  }

  // Alerts API
  async getAlerts() {
    try {
      const { data } = await this.client.get('/api/alerts');
      return data;
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      throw error;
    }
  }

  async getAlert(alertId: string) {
    try {
      const { data } = await this.client.get(`/api/alerts/${alertId}`);
      return data;
    } catch (error) {
      console.error('Failed to fetch alert:', error);
      throw error;
    }
  }

  // Triage API
  async startTriage(alertId: string) {
    try {
      const { data } = await this.client.post('/api/triage', { alertId });
      return data;
    } catch (error) {
      console.error('Failed to start triage:', error);
      throw error;
    }
  }

  async getTriageRun(runId: string) {
    try {
      const { data } = await this.client.get(`/api/triage/${runId}`);
      return data;
    } catch (error) {
      console.error('Failed to fetch triage run:', error);
      throw error;
    }
  }

  // Actions API
  async freezeCard(cardId: string, otp?: string) {
    try {
      const payload: any = { cardId };
      if (otp) payload.otp = otp;
      
      const { data } = await this.client.post('/api/action/freeze-card', payload);
      return data;
    } catch (error) {
      console.error('Failed to freeze card:', error);
      throw error;
    }
  }

  async openDispute(txnId: string, reasonCode: string, confirm: boolean) {
    try {
      const { data } = await this.client.post('/api/action/open-dispute', {
        txnId,
        reasonCode,
        confirm,
      });
      return data;
    } catch (error) {
      console.error('Failed to open dispute:', error);
      throw error;
    }
  }

  async contactCustomer(customerId: string, message: string, alertId?: string) {
    try {
      const { data } = await this.client.post('/api/action/contact-customer', {
        customerId,
        message,
        ...(alertId && { alertId }),
      });
      return data;
    } catch (error) {
      console.error('Failed to contact customer:', error);
      throw error;
    }
  }

  async markFalsePositive(alertId: string) {
    try {
      const { data } = await this.client.post('/api/action/mark-false-positive', { alertId });
      return data;
    } catch (error) {
      console.error('Failed to mark false positive:', error);
      throw error;
    }
  }

  // Orchestrator - Update alert status after action
  async updateAlertStatus(alertId: string, actionType: string) {
    try {
      const { data } = await this.client.post('/api/triage/update-alert-status', {
        alertId,
        actionType,
      });
      return data;
    } catch (error) {
      console.error('Failed to update alert status:', error);
      throw error;
    }
  }

  // Orchestrator - Execute action and update alert status atomically
  async executeActionAndUpdateAlert(alertId: string, actionType: string, actionParams?: any) {
    try {
      const { data } = await this.client.post('/api/triage/execute-action', {
        alertId,
        actionType,
        actionParams,
      });
      return data;
    } catch (error) {
      console.error('Failed to execute action and update alert:', error);
      throw error;
    }
  }

  // KB API
  async searchKB(query: string) {
    try {
      const { data } = await this.client.get('/api/kb/search', { params: { q: query } });
      return data;
    } catch (error) {
      console.error('Failed to search knowledge base:', error);
      throw error;
    }
  }

  // Health & Metrics
  async getHealth() {
    try {
      const { data } = await this.client.get('/health');
      return data;
    } catch (error) {
      console.error('Failed to fetch health status:', error);
      throw error;
    }
  }

  async getMetrics() {
    try {
      const { data } = await this.client.get('/metrics');
      return data;
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      throw error;
    }
  }

  // Stats API
  async getStats() {
    try {
      const { data } = await this.client.get('/api/stats');
      return data;
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      throw error;
    }
  }

  async getEvalResults(limit?: number) {
    try {
      const { data } = await this.client.get('/api/stats/evals', { 
        params: { limit } 
      });
      return data;
    } catch (error) {
      console.error('Failed to fetch eval results:', error);
      throw error;
    }
  }

  // SSE for triage streaming
  createTriageStream(alertId: string, runId: string) {
    return new EventSource(`${API_BASE_URL}/api/triage/${runId}/stream?alertId=${alertId}`);
  }
}

export const api = new ApiClient();
