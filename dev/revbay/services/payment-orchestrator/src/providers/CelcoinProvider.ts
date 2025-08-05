import axios from 'axios';
import { BasePaymentProvider } from './BasePaymentProvider';
import { PaymentRequest, PaymentResponse, PaymentStatus } from '../types/payment';

export class CelcoinProvider extends BasePaymentProvider {
  public readonly id = 'CELCOIN' as const;
  public readonly name = 'Celcoin';
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    super();
    this.apiUrl = process.env.CELCOIN_API_URL || 'https://sandbox.celcoin.com.br';
    this.apiKey = process.env.CELCOIN_API_KEY!;
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    this.logRequest(request);

    try {
      const celcoinRequest = {
        amount: request.amount,
        currency: request.currency,
        customer_id: request.customerId,
        description: request.description,
        metadata: request.metadata
      };

      const response = await axios.post(
        `${this.apiUrl}/v1/payments`,
        celcoinRequest,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const paymentResponse: PaymentResponse = {
        success: response.data.success || false,
        transactionId: response.data.transaction_id || '',
        status: this.mapCelcoinStatus(response.data.status),
        providerId: this.id,
        amount: request.amount,
        currency: request.currency,
        message: response.data.message
      };

      this.logResponse(paymentResponse);
      return paymentResponse;
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
      const response = await axios.get(
        `${this.apiUrl}/v1/payments/${transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: response.data.success || false,
        transactionId,
        status: this.mapCelcoinStatus(response.data.status),
        providerId: this.id,
        amount: response.data.amount || 0,
        currency: response.data.currency || '',
        message: response.data.message
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

  private mapCelcoinStatus(celcoinStatus: string): PaymentStatus {
    switch (celcoinStatus?.toLowerCase()) {
      case 'success':
      case 'completed':
        return 'SUCCEEDED';
      case 'processing':
      case 'pending':
        return 'PENDING';
      default:
        return 'FAILED';
    }
  }
}