import { 
  PaymentMethod, 
  PaymentStatus, 
  PaymentProcessor,
  InternalPayment,
  CreatePaymentRequest 
} from '@revbay/types';

export interface PaymentRequest extends CreatePaymentRequest {
  customerId: string;
  paymentMethod: PaymentMethod;
  description?: string;
}

export interface PaymentResponse {
  success: boolean;
  transactionId: string;
  status: PaymentStatus;
  providerId: PaymentProcessor;
  amount: number;
  currency: string;
  message?: string;
  error?: string;
}

export interface PaymentProvider {
  id: PaymentProcessor;
  name: string;
  processPayment(request: PaymentRequest): Promise<PaymentResponse>;
  getTransactionStatus(transactionId: string): Promise<PaymentResponse>;
}

export type PaymentProviderType = PaymentProcessor;

export { PaymentMethod, PaymentStatus, PaymentProcessor, InternalPayment };