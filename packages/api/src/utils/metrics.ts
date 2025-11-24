import { Registry, Counter, Histogram } from 'prom-client';

/**
 * Prometheus Metrics Registry
 * Tracks API performance and agent behavior
 */
class MetricsService {
  public registry: Registry;
  public apiRequestLatency: Histogram;
  public agentLatency: Histogram;
  public toolCallTotal: Counter;
  public agentFallbackTotal: Counter;
  public rateLimitBlockTotal: Counter;
  public actionBlockedTotal: Counter;
  public schemaValidationTotal: Counter;

  constructor() {
    this.registry = new Registry();

    // API request latency histogram
    this.apiRequestLatency = new Histogram({
      name: 'api_request_latency_ms',
      help: 'API request latency in milliseconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
      registers: [this.registry],
    });

    // Agent execution latency
    this.agentLatency = new Histogram({
      name: 'agent_latency_ms',
      help: 'Agent execution latency in milliseconds',
      labelNames: ['agent', 'step'],
      buckets: [50, 100, 200, 500, 1000, 2000, 5000],
      registers: [this.registry],
    });

    // Tool call counter
    this.toolCallTotal = new Counter({
      name: 'tool_call_total',
      help: 'Total number of tool calls',
      labelNames: ['tool', 'ok'],
      registers: [this.registry],
    });

    // Agent fallback counter
    this.agentFallbackTotal = new Counter({
      name: 'agent_fallback_total',
      help: 'Total number of agent fallbacks triggered',
      labelNames: ['tool'],
      registers: [this.registry],
    });

    // Rate limit block counter
    this.rateLimitBlockTotal = new Counter({
      name: 'rate_limit_block_total',
      help: 'Total number of rate limit blocks',
      labelNames: ['client'],
      registers: [this.registry],
    });

    // Action blocked counter
    this.actionBlockedTotal = new Counter({
      name: 'action_blocked_total',
      help: 'Total number of actions blocked by policy',
      labelNames: ['policy'],
      registers: [this.registry],
    });

    // Schema validation counter
    this.schemaValidationTotal = new Counter({
      name: 'schema_validation_total',
      help: 'Total number of schema validations',
      labelNames: ['tool', 'type', 'status'],
      registers: [this.registry],
    });
  }

  /**
   * Get metrics in Prometheus format
   */
  async metrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get content type for Prometheus
   */
  get contentType(): string {
    return this.registry.contentType;
  }
}

const metricsService = new MetricsService();

export const metricsRegistry = metricsService.registry;
export const metrics = {
  apiRequestLatency: metricsService.apiRequestLatency,
  agentLatency: metricsService.agentLatency,
  toolCallTotal: metricsService.toolCallTotal,
  agentFallbackTotal: metricsService.agentFallbackTotal,
  rateLimitBlockTotal: metricsService.rateLimitBlockTotal,
  actionBlockedTotal: metricsService.actionBlockedTotal,
  schemaValidationTotal: metricsService.schemaValidationTotal,
  getMetrics: () => metricsService.metrics(),
  getContentType: () => metricsService.contentType,
};
