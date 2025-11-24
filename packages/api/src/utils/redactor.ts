/**
 * PII Redaction utility
 * Redacts sensitive information from strings (PAN, emails, etc.)
 */

/**
 * Redact PAN-like sequences (13-19 digits)
 * Matches credit card numbers and replaces them with ****REDACTED****
 */
export function redactPAN(text: string): string {
  // Match 13-19 consecutive digits (with optional spaces or hyphens)
  const panPattern = /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{3,7}\b/g;
  return text.replace(panPattern, '****REDACTED****');
}

/**
 * Redact email addresses
 * Replaces emails with masked version (first char + ***@domain)
 */
export function redactEmail(text: string): string {
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  return text.replace(emailPattern, (email) => {
    const [local, domain] = email.split('@');
    return `${local[0]}***@${domain}`;
  });
}

/**
 * Redact phone numbers (various formats)
 */
export function redactPhone(text: string): string {
  const phonePatterns = [
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // US format
    /\b\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g, // International
  ];
  
  let result = text;
  for (const pattern of phonePatterns) {
    result = result.replace(pattern, '****REDACTED****');
  }
  
  return result;
}

/**
 * Redact SSN-like patterns
 */
export function redactSSN(text: string): string {
  const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g;
  return text.replace(ssnPattern, '****REDACTED****');
}

/**
 * Main PII redaction function
 * Applies all redaction rules to a given text
 */
export function redactPII(text: string): string {
  if (typeof text !== 'string') return text;
  
  let redacted = text;
  redacted = redactPAN(redacted);
  redacted = redactEmail(redacted);
  redacted = redactPhone(redacted);
  redacted = redactSSN(redacted);
  
  return redacted;
}

/**
 * Mask customer ID for logging
 * Shows only first 4 and last 4 characters
 */
export function maskCustomerId(customerId: string): string {
  if (!customerId || customerId.length <= 8) return '****';
  return `${customerId.slice(0, 4)}...${customerId.slice(-4)}`;
}

/**
 * Redact PII from objects recursively
 */
export function redactObjectPII(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return typeof obj === 'string' ? redactPII(obj) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactObjectPII(item));
  }

  const redacted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      redacted[key] = redactPII(value);
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactObjectPII(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}
