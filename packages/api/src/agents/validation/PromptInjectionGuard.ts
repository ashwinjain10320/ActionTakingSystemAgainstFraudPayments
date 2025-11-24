import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';

/**
 * Prompt Injection Guard
 * Prevents malicious user inputs from triggering unintended tool executions
 */
export class PromptInjectionGuard {
  // Dangerous patterns that might indicate prompt injection
  private static dangerousPatterns = [
    /ignore\s+(previous|above|all)\s+(instructions?|prompts?|rules?)/i,
    /forget\s+(everything|all|previous)/i,
    /new\s+(instructions?|task|role)/i,
    /you\s+are\s+(now|a)\s+(different|new)/i,
    /system\s*:/i,
    /assistant\s*:/i,
    /\[SYSTEM\]/i,
    /\[INST\]/i,
    /<\|im_start\|>/i,
    /<\|im_end\|>/i,
    /execute\s+(sql|query|command)/i,
    /drop\s+table/i,
    /delete\s+from/i,
    // More specific patterns for privilege escalation (not just words)
    /sudo\s+(-[a-z]+\s+)?[a-z\/]/i,  // sudo with actual commands
    /\bsu\s+-/i,  // su command with flags
    /chmod\s+[0-7]{3,4}/i,  // chmod with numeric permissions
  ];

  // SQL injection patterns
  private static sqlPatterns = [
    /(\bOR\b|\bAND\b)\s+[\d\w]+\s*=\s*[\d\w]+/i,
    /\bUNION\b\s+\bSELECT\b/i,
    /\bDROP\b\s+\bTABLE\b/i,
    /\bINSERT\b\s+\bINTO\b/i,
    /--/,
    /;.*(\bDROP\b|\bDELETE\b|\bUPDATE\b)/i,
  ];

  // XSS patterns
  private static xssPatterns = [
    /<script[^>]*>.*?<\/script>/is,
    /javascript:/i,
    /on\w+\s*=\s*["'][^"']*["']/i,
    /<iframe/i,
    /<embed/i,
    /<object/i,
  ];

  /**
   * Sanitize and validate user input
   * @param input - User-provided text
   * @param allowedChars - Regex pattern for allowed characters
   * @returns Sanitized input
   * @throws Error if input contains dangerous patterns
   */
  static sanitize(input: string, allowedChars?: RegExp): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Trim and normalize whitespace
    let sanitized = input.trim().replace(/\s+/g, ' ');

    // Check for dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(sanitized)) {
        logger.warn('Potential prompt injection detected', {
          input: sanitized.substring(0, 100),
          pattern: pattern.source,
        });
        
        metrics.actionBlockedTotal.inc({ policy: 'prompt_injection' });
        
        throw new Error('Input contains potentially malicious content');
      }
    }

    // Check for SQL injection
    for (const pattern of this.sqlPatterns) {
      if (pattern.test(sanitized)) {
        logger.warn('Potential SQL injection detected', {
          input: sanitized.substring(0, 100),
        });
        
        metrics.actionBlockedTotal.inc({ policy: 'sql_injection' });
        
        throw new Error('Input contains potentially malicious SQL patterns');
      }
    }

    // Check for XSS
    for (const pattern of this.xssPatterns) {
      if (pattern.test(sanitized)) {
        logger.warn('Potential XSS detected', {
          input: sanitized.substring(0, 100),
        });
        
        metrics.actionBlockedTotal.inc({ policy: 'xss_injection' });
        
        throw new Error('Input contains potentially malicious scripts');
      }
    }

    // Apply allowed characters filter if provided
    if (allowedChars) {
      sanitized = sanitized.replace(allowedChars, '');
    }

    // Remove null bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    // Limit length
    if (sanitized.length > 5000) {
      sanitized = sanitized.substring(0, 5000);
    }

    return sanitized;
  }

  /**
   * Validate input against policy rules
   * @param input - User input
   * @param context - Context for policy check
   * @returns true if valid, false otherwise
   */
  static async validateAgainstPolicy(
    input: string,
    context: { userId?: string; action?: string }
  ): Promise<boolean> {
    // Sanitize first
    try {
      this.sanitize(input);
    } catch (error) {
      return false;
    }

    // Additional policy checks can be added here
    // For example, checking if user has permission for certain actions

    logger.info('Input validated against policy', {
      userId: context.userId,
      action: context.action,
      inputLength: input.length,
    });

    return true;
  }

  /**
   * Safe check - returns boolean without throwing
   */
  static isSafe(input: string): boolean {
    try {
      this.sanitize(input);
      return true;
    } catch {
      return false;
    }
  }
}
