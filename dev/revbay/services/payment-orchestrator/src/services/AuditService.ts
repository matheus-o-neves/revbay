import { logger } from '@revbay/shared';
import { PaymentRequest, PaymentResponse, PaymentProcessor, PaymentMethod } from '../types/payment';

export interface AuditEvent {
  eventType: 'payment.initiated' | 'payment.completed' | 'payment.failed' | 'payment.status_checked' | 'validation.failed' | 'provider.selected';
  customerId: string;
  paymentId?: string;
  processorId?: string;
  processor?: PaymentProcessor;
  amount?: number;
  currency?: string;
  paymentMethod?: PaymentMethod;
  details?: Record<string, any>;
  error?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class AuditService {
  private serviceName = 'payment-orchestrator';

  logPaymentInitiated(request: PaymentRequest, selectedProvider: PaymentProcessor): void {
    const event: AuditEvent = {
      eventType: 'payment.initiated',
      customerId: request.customerId,
      processor: selectedProvider,
      amount: request.amount,
      currency: request.currency,
      paymentMethod: request.paymentMethod,
      timestamp: new Date(),
      details: {
        description: request.description,
        hasMetadata: !!request.metadata
      },
      metadata: this.sanitizeMetadata(request.metadata)
    };

    logger.info('Payment initiated', {
      service: this.serviceName,
      audit: event
    });
  }

  logPaymentCompleted(request: PaymentRequest, response: PaymentResponse, paymentId: string): void {
    const event: AuditEvent = {
      eventType: 'payment.completed',
      customerId: request.customerId,
      paymentId,
      processorId: response.transactionId,
      processor: response.providerId,
      amount: response.amount,
      currency: response.currency,
      paymentMethod: request.paymentMethod,
      timestamp: new Date(),
      details: {
        success: response.success,
        status: response.status,
        message: response.message
      }
    };

    logger.info('Payment completed', {
      service: this.serviceName,
      audit: event
    });
  }

  logPaymentFailed(request: PaymentRequest, response: PaymentResponse, error?: string): void {
    const event: AuditEvent = {
      eventType: 'payment.failed',
      customerId: request.customerId,
      processorId: response.transactionId,
      processor: response.providerId,
      amount: response.amount,
      currency: response.currency,
      paymentMethod: request.paymentMethod,
      error: error || response.error,
      timestamp: new Date(),
      details: {
        success: response.success,
        status: response.status,
        message: response.message,
        errorCode: this.extractErrorCode(response.error)
      }
    };

    logger.warn('Payment failed', {
      service: this.serviceName,
      audit: event
    });
  }

  logStatusCheck(transactionId: string, processor: PaymentProcessor, response: PaymentResponse): void {
    const event: AuditEvent = {
      eventType: 'payment.status_checked',
      customerId: '', // Not available in status check context
      processorId: transactionId,
      processor,
      amount: response.amount,
      currency: response.currency,
      timestamp: new Date(),
      details: {
        success: response.success,
        status: response.status,
        message: response.message
      }
    };

    logger.info('Payment status checked', {
      service: this.serviceName,
      audit: event
    });
  }

  logValidationFailed(request: Partial<PaymentRequest>, error: string): void {
    const event: AuditEvent = {
      eventType: 'validation.failed',
      customerId: request.customerId || 'unknown',
      amount: request.amount,
      currency: request.currency,
      paymentMethod: request.paymentMethod,
      error,
      timestamp: new Date(),
      details: {
        validationError: error,
        requestFields: Object.keys(request)
      }
    };

    logger.warn('Payment validation failed', {
      service: this.serviceName,
      audit: event
    });
  }

  logProviderSelection(request: PaymentRequest, selectedProvider: PaymentProcessor, reason: string): void {
    const event: AuditEvent = {
      eventType: 'provider.selected',
      customerId: request.customerId,
      processor: selectedProvider,
      amount: request.amount,
      currency: request.currency,
      paymentMethod: request.paymentMethod,
      timestamp: new Date(),
      details: {
        selectionReason: reason,
        paymentMethod: request.paymentMethod,
        currency: request.currency
      }
    };

    logger.info('Payment processor selected', {
      service: this.serviceName,
      audit: event
    });
  }

  logDatabaseOperation(operation: string, success: boolean, details?: Record<string, any>, error?: string): void {
    const logLevel = success ? 'info' : 'error';
    const message = `Database operation: ${operation}`;

    logger[logLevel](message, {
      service: this.serviceName,
      operation,
      success,
      details: details || {},
      error,
      timestamp: new Date()
    });
  }

  logSecurityEvent(eventType: string, customerId: string, details: Record<string, any>): void {
    logger.warn('Security event', {
      service: this.serviceName,
      eventType,
      customerId,
      details,
      timestamp: new Date()
    });
  }

  private sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) return undefined;

    const sanitized = { ...metadata };
    
    // Remove sensitive data
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'apiKey', 'authorization'];
    sensitiveKeys.forEach(key => {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private extractErrorCode(error?: string): string | undefined {
    if (!error) return undefined;
    
    // Extract error codes from common payment processor error messages
    const patterns = [
      /code:\s*(\w+)/i,
      /error_code:\s*(\w+)/i,
      /\[(\w+)\]/,
      /^(\w+):/
    ];

    for (const pattern of patterns) {
      const match = error.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return 'UNKNOWN_ERROR';
  }
}