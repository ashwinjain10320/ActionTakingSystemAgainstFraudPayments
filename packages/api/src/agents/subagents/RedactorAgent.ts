import { BaseTool } from '../tools/BaseTool';
import { AgentContext } from '../types';

/**
 * Redactor Agent
 * Masks PII from logs and traces
 * - PAN-like digits (13-19 consecutive digits) → ****REDACTED****
 * - Email addresses → masked format (u***@domain.com)
 */
export class RedactorAgent extends BaseTool {
  name = 'redactor';
  description = 'Redacts PII from logs and customer data';

  // PAN detection pattern (13-19 consecutive digits)
  private readonly panPattern = /\b\d{13,19}\b/g;

  // Email detection pattern
  private readonly emailPattern = /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

  protected async run(context: AgentContext): Promise<any> {
    const { alert, customer, customerId } = context;

    let piiFound = false;

    // Redact customer ID if it looks like PII
    const redactedCustomerId = this.redactPan(customerId);
    if (redactedCustomerId !== customerId) {
      piiFound = true;
    }

    // Redact email
    const redactedEmail = this.maskEmail(customer.email);
    if (redactedEmail !== customer.email) {
      piiFound = true;
    }

    // Check alert description for PII
    if (alert.description) {
      const redactedDescription = this.redactPan(alert.description);
      if (redactedDescription !== alert.description) {
        piiFound = true;
      }
    }

    return {
      alertId: alert.id,
      customerId: redactedCustomerId,
      customerEmail: redactedEmail,
      redactedAt: new Date().toISOString(),
      piiFound,
      patterns: {
        panDetected: this.panPattern.test(customerId) || (alert.description && this.panPattern.test(alert.description)),
        emailDetected: this.emailPattern.test(customer.email),
      },
    };
  }

  /**
   * Redact PAN-like sequences (13-19 digits)
   */
  private redactPan(text: string): string {
    if (!text) return text;
    return text.replace(this.panPattern, '****REDACTED****');
  }

  /**
   * Mask email address (keep first char and domain)
   */
  private maskEmail(email: string): string {
    if (!email) return email;

    return email.replace(this.emailPattern, (_match, localPart, domain) => {
      if (localPart.length <= 1) {
        return `${localPart}@${domain}`;
      }
      return `${localPart[0]}${'*'.repeat(Math.min(localPart.length - 1, 3))}@${domain}`;
    });
  }

  /**
   * Scrub logs and traces (can be used by other components)
   */
  public scrubText(text: string): string {
    if (!text) return text;

    let scrubbed = this.redactPan(text);
    scrubbed = scrubbed.replace(this.emailPattern, (_match, localPart, domain) => {
      return `${localPart[0]}***@${domain}`;
    });

    return scrubbed;
  }
}
