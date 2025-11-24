/**
 * Input sanitization to prevent prompt injection attacks
 * Sanitizes user input before processing by AI agents or tools
 */

/**
 * Sanitize user text input to prevent prompt injection
 * - Removes control characters
 * - Limits length
 * - Escapes potential injection patterns
 */
export function sanitizeUserInput(input: string, maxLength = 1000): string {
  if (!input) return '';

  // Trim and limit length
  let sanitized = input.trim().slice(0, maxLength);

  // Remove control characters (except newline, tab, carriage return)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Remove potential prompt injection patterns
  const dangerousPatterns = [
    /ignore (previous|all) instructions?/gi,
    /forget (everything|all|previous)/gi,
    /you are now/gi,
    /new instructions?:/gi,
    /system prompt/gi,
    /\[SYSTEM\]/gi,
    /\[INST\]/gi,
    /<\|.*?\|>/gi, // Special tokens
  ];

  dangerousPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  return sanitized;
}

/**
 * Validate that user input doesn't contain tool invocation attempts
 */
export function validateNoToolInvocation(input: string): boolean {
  const toolPatterns = [
    /execute\s*\(/gi,
    /run\s*\(/gi,
    /\.execute\(/gi,
    /tool\s*:\s*['"]/gi,
    /function\s*[a-zA-Z]+\s*\(/gi,
  ];

  return !toolPatterns.some(pattern => pattern.test(input));
}

/**
 * Sanitize and validate user input
 * @throws Error if input contains dangerous patterns
 */
export function sanitizeAndValidate(input: string, maxLength = 1000): string {
  const sanitized = sanitizeUserInput(input, maxLength);
  
  if (!validateNoToolInvocation(sanitized)) {
    throw new Error('Input contains potentially dangerous patterns');
  }

  return sanitized;
}
