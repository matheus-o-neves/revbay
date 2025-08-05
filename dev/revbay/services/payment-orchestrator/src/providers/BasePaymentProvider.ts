import { PaymentProvider, PaymentRequest, PaymentResponse, PaymentProcessor } from '../types/payment';
import { logger } from '@revbay/shared';

export abstract class BasePaymentProvider implements PaymentProvider {
  abstract id: PaymentProcessor;
  abstract name: string;

  protected logRequest(request: PaymentRequest): void {
    logger.info(`Processing payment with payment processor`, {
      providerId: this.id,
      amount: request.amount,
      currency: request.currency,
      customerId: request.customerId
    });
  }

  protected logResponse(response: PaymentResponse): void {
    logger.info(`Payment response from payment processor`, {
      providerId: this.id,
      success: response.success,
      status: response.status,
      transactionId: response.transactionId
    });
  }

  abstract processPayment(request: PaymentRequest): Promise<PaymentResponse>;
  abstract getTransactionStatus(transactionId: string): Promise<PaymentResponse>;
}