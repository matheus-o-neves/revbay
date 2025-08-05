import Stripe from 'stripe';
import { BasePaymentProvider } from './BasePaymentProvider';
import { PaymentRequest, PaymentResponse, PaymentStatus } from '../types/payment';

export class StripeProvider extends BasePaymentProvider {
  public readonly id = 'STRIPE' as const;
  public readonly name = 'Stripe';
  private stripe: Stripe;

  constructor() {
    super();
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16'
    });
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    this.logRequest(request);

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(request.amount * 100),
        currency: request.currency.toLowerCase(),
        customer: request.customerId,
        description: request.description,
        metadata: request.metadata || {}
      });

      const response: PaymentResponse = {
        success: true,
        transactionId: paymentIntent.id,
        status: this.mapStripeStatus(paymentIntent.status),
        providerId: this.id,
        amount: request.amount,
        currency: request.currency
      };

      this.logResponse(response);
      return response;
    } catch (error) {
      const response: PaymentResponse = {
        success: false,
        transactionId: '',
        status: 'FAILED',
        providerId: this.id,
        amount: request.amount,
        currency: request.currency,
        error: error instanceof Error ? error.message : 'Payment processing error'
      };

      this.logResponse(response);
      return response;
    }
  }

  async getTransactionStatus(transactionId: string): Promise<PaymentResponse> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(transactionId);
      
      return {
        success: paymentIntent.status === 'succeeded',
        transactionId: paymentIntent.id,
        status: this.mapStripeStatus(paymentIntent.status),
        providerId: this.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase()
      };
    } catch (error) {
      return {
        success: false,
        transactionId,
        status: 'FAILED',
        providerId: this.id,
        amount: 0,
        currency: '',
        error: error instanceof Error ? error.message : 'Payment processing error'
      };
    }
  }

  private mapStripeStatus(stripeStatus: string): PaymentStatus {
    switch (stripeStatus) {
      case 'succeeded':
        return 'SUCCEEDED';
      case 'processing':
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return 'PENDING';
      case 'canceled':
        return 'CANCELED';
      default:
        return 'FAILED';
    }
  }
}