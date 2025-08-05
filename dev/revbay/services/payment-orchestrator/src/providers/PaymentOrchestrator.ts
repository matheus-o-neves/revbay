import { PaymentProvider, PaymentRequest, PaymentResponse, PaymentProviderType, PaymentMethod, InternalPayment } from '../types/payment';
import { StripeProvider } from './StripeProvider';
import { CelcoinProvider } from './CelcoinProvider';
import { PaymentService } from '../services/PaymentService';
import { AuditService } from '../services/AuditService';
import { logger } from '@revbay/shared';

export class PaymentOrchestrator {
  private providers: Map<PaymentProviderType, PaymentProvider>;
  private paymentService: PaymentService;
  private auditService: AuditService;

  constructor() {
    this.providers = new Map();
    this.paymentService = new PaymentService();
    this.auditService = new AuditService();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    try {
      this.providers.set('STRIPE', new StripeProvider());
      this.providers.set('CELCOIN', new CelcoinProvider());
      logger.info('Payment processors initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize payment processors:', error);
      throw new Error('Payment orchestrator initialization failed');
    }
  }

  async processPayment(
    request: PaymentRequest,
    preferredProvider?: PaymentProviderType
  ): Promise<PaymentResponse & { paymentId?: string }> {
    const validationError = this.validatePaymentRequest(request);
    if (validationError) {
      this.auditService.logValidationFailed(request, validationError);
      return {
        success: false,
        transactionId: '',
        status: 'FAILED',
        providerId: 'STRIPE',
        amount: request.amount,
        currency: request.currency,
        error: validationError
      };
    }

    const provider = this.selectProvider(preferredProvider, request);
    
    if (!provider) {
      this.auditService.logValidationFailed(request, 'No suitable payment provider available');
      return {
        success: false,
        transactionId: '',
        status: 'FAILED',
        providerId: 'STRIPE',
        amount: request.amount,
        currency: request.currency,
        error: 'No suitable payment provider available'
      };
    }

    // Log provider selection
    const selectionReason = this.getProviderSelectionReason(request, preferredProvider);
    this.auditService.logProviderSelection(request, provider.id, selectionReason);

    // Log payment initiation
    this.auditService.logPaymentInitiated(request, provider.id);

    logger.info(`Processing payment with payment processor`, {
      amount: request.amount,
      currency: request.currency,
      paymentMethod: request.paymentMethod,
      customerId: request.customerId,
      processorType: request.paymentMethod === 'PIX' || request.paymentMethod === 'BOLETO' ? 'domestic' : 'international'
    });

    try {
      const response = await provider.processPayment(request);
      
      // Save payment to database
      const dbPayment = await this.paymentService.createPayment(request, response);
      this.auditService.logDatabaseOperation('create_payment', true, { paymentId: dbPayment.id });

      if (response.success) {
        this.auditService.logPaymentCompleted(request, response, dbPayment.id);
      } else {
        this.auditService.logPaymentFailed(request, response);
      }
      
      return {
        ...response,
        paymentId: dbPayment.id
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment processing failed';
      logger.error('Payment processing failed', error);
      
      this.auditService.logDatabaseOperation('create_payment', false, undefined, errorMessage);
      
      const failureResponse = {
        success: false,
        transactionId: '',
        status: 'FAILED' as const,
        providerId: provider.id,
        amount: request.amount,
        currency: request.currency,
        error: 'Payment processing failed'
      };
      
      this.auditService.logPaymentFailed(request, failureResponse, errorMessage);
      
      return failureResponse;
    }
  }

  async getTransactionStatus(
    transactionId: string,
    providerId: PaymentProviderType
  ): Promise<PaymentResponse> {
    const provider = this.providers.get(providerId);
    
    if (!provider) {
      return {
        success: false,
        transactionId,
        status: 'FAILED',
        providerId,
        amount: 0,
        currency: '',
        error: 'Provider not found'
      };
    }

    try {
      const response = await provider.getTransactionStatus(transactionId);
      
      // Log status check
      this.auditService.logStatusCheck(transactionId, providerId, response);
      
      // Update database record if payment exists
      const dbPayment = await this.paymentService.getPaymentByProcessorId(transactionId, providerId);
      if (dbPayment) {
        await this.paymentService.updatePaymentStatus(dbPayment.id, response);
        this.auditService.logDatabaseOperation('update_payment_status', true, { 
          paymentId: dbPayment.id, 
          newStatus: response.status 
        });
      } else {
        this.auditService.logDatabaseOperation('find_payment_by_processor_id', false, { 
          transactionId, 
          providerId 
        }, 'Payment not found in database');
      }
      
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get transaction status';
      logger.error('Failed to get transaction status', error);
      
      this.auditService.logDatabaseOperation('get_transaction_status', false, { 
        transactionId, 
        providerId 
      }, errorMessage);
      
      return {
        success: false,
        transactionId,
        status: 'FAILED',
        providerId,
        amount: 0,
        currency: '',
        error: 'Failed to get transaction status'
      };
    }
  }

  private selectProvider(
    preferredProvider?: PaymentProviderType,
    request?: PaymentRequest
  ): PaymentProvider | null {
    if (preferredProvider && this.providers.has(preferredProvider)) {
      return this.providers.get(preferredProvider)!;
    }

    if (request?.paymentMethod === 'PIX' || request?.paymentMethod === 'BOLETO') {
      return this.providers.get('CELCOIN') || null;
    }

    return this.providers.get('STRIPE') || null;
  }

  private validatePaymentRequest(request: PaymentRequest): string | null {
    if ((request.paymentMethod === 'PIX' || request.paymentMethod === 'BOLETO') && request.currency !== 'BRL') {
      return 'PIX and Boleto payments only support BRL currency';
    }
    return null;
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  async getPaymentById(paymentId: string): Promise<InternalPayment | null> {
    return await this.paymentService.getPaymentById(paymentId);
  }

  async getCustomerPayments(customerId: string, limit: number = 50): Promise<InternalPayment[]> {
    return await this.paymentService.getCustomerPayments(customerId, limit);
  }

  async disconnect(): Promise<void> {
    await this.paymentService.disconnect();
  }

  private getProviderSelectionReason(request: PaymentRequest, preferredProvider?: PaymentProviderType): string {
    if (preferredProvider) {
      return `Preferred processor specified`;
    }
    
    if (request.paymentMethod === 'PIX' || request.paymentMethod === 'BOLETO') {
      return `Brazilian payment method (${request.paymentMethod}) routed to domestic processor`;
    }
    
    return `Card payment routed to international processor`;
  }
}