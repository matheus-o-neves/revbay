import axios, { AxiosResponse } from 'axios';
import { PaymentMethod, PaymentStatus } from '../../packages/types/src/index';

export interface TestPaymentRequest {
  amount: number;
  currency: string;
  customerId: string;
  paymentMethod: PaymentMethod;
  description?: string;
  metadata?: Record<string, any>;
}

export interface TestPaymentResponse {
  success: boolean;
  data?: {
    paymentId?: string;
    transactionId: string;
    status: PaymentStatus;
    amount: number;
    currency: string;
    message?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export class TestClient {
  constructor(
    private apiGatewayUrl: string = process.env.API_GATEWAY_URL || 'http://localhost:3000',
    private orchestratorUrl: string = process.env.PAYMENT_ORCHESTRATOR_URL || 'http://localhost:3001'
  ) {}

  // API Gateway requests
  async processPaymentViaGateway(request: TestPaymentRequest): Promise<TestPaymentResponse> {
    try {
      const response: AxiosResponse<TestPaymentResponse> = await axios.post(
        `${this.apiGatewayUrl}/v1/payments/process`,
        request,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data;
      }
      throw error;
    }
  }

  async getPaymentViaGateway(paymentId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.apiGatewayUrl}/v1/payments/${paymentId}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data;
      }
      throw error;
    }
  }

  async getCustomerPaymentsViaGateway(customerId: string, limit: number = 50): Promise<any> {
    try {
      const response = await axios.get(
        `${this.apiGatewayUrl}/v1/payments?customerId=${customerId}&limit=${limit}`
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data;
      }
      throw error;
    }
  }

  // Direct Payment Orchestrator requests (for comparison)
  async processPaymentViaOrchestrator(request: TestPaymentRequest): Promise<any> {
    try {
      const response = await axios.post(
        `${this.orchestratorUrl}/v1/payments/process`,
        request,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data;
      }
      throw error;
    }
  }

  async getPaymentStatusViaOrchestrator(transactionId: string, provider: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.orchestratorUrl}/v1/payments/status/${transactionId}?provider=${provider}`
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data;
      }
      throw error;
    }
  }

  // Health checks
  async checkAPIGatewayHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.apiGatewayUrl}/health`, { timeout: 5000 });
      return response.data.status === 'healthy';
    } catch {
      return false;
    }
  }

  async checkOrchestratorHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.orchestratorUrl}/health`, { timeout: 5000 });
      return response.data.status === 'healthy';
    } catch {
      return false;
    }
  }
}

// Test data generators
export const TestData = {
  validCardPayment: (customerId: string = 'test_customer_12345'): TestPaymentRequest => ({
    amount: 100.50,
    currency: 'USD',
    customerId,
    paymentMethod: 'CARD' as PaymentMethod,
    description: 'Test card payment',
    metadata: { testId: Date.now().toString() }
  }),

  validPixPayment: (customerId: string = 'test_customer_12345'): TestPaymentRequest => ({
    amount: 50.00,
    currency: 'BRL',
    customerId,
    paymentMethod: 'PIX' as PaymentMethod,
    description: 'Test PIX payment',
    metadata: { testId: Date.now().toString() }
  }),

  validBoletoPayment: (customerId: string = 'test_customer_12345'): TestPaymentRequest => ({
    amount: 150.00,
    currency: 'BRL',
    customerId,
    paymentMethod: 'BOLETO' as PaymentMethod,
    description: 'Test Boleto payment',
    metadata: { testId: Date.now().toString() }
  }),

  invalidCurrencyPixPayment: (customerId: string = 'test_customer_12345'): TestPaymentRequest => ({
    amount: 50.00,
    currency: 'USD', // Invalid for PIX
    customerId,
    paymentMethod: 'PIX' as PaymentMethod,
    description: 'Test PIX with invalid currency'
  }),

  missingFieldsPayment: () => ({
    amount: 100.50,
    // Missing currency, customerId, paymentMethod
  }),

  largeAmountPayment: (customerId: string = 'test_customer_12345'): TestPaymentRequest => ({
    amount: 10000.00,
    currency: 'USD',
    customerId,
    paymentMethod: 'CARD' as PaymentMethod,
    description: 'Large amount test payment'
  })
};

// Assertion helpers
export const TestAssertions = {
  expectValidPaymentResponse: (response: TestPaymentResponse) => {
    expect(response).toBeDefined();
    expect(typeof response.success).toBe('boolean');
    
    if (response.success && response.data) {
      expect(response.data).toHaveProperty('transactionId');
      expect(response.data).toHaveProperty('status');
      expect(response.data).toHaveProperty('amount');
      expect(response.data).toHaveProperty('currency');
      expect(['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED']).toContain(response.data.status);
    }
    
    if (!response.success && response.error) {
      expect(response.error).toHaveProperty('code');
      expect(response.error).toHaveProperty('message');
    }
  },

  expectFailedPaymentResponse: (response: TestPaymentResponse, expectedCode?: string) => {
    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBeDefined();
    expect(response.error?.message).toBeDefined();
    
    if (expectedCode) {
      expect(response.error?.code).toBe(expectedCode);
    }
  },

  expectSuccessfulPaymentResponse: (response: TestPaymentResponse) => {
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data?.transactionId).toBeDefined();
    expect(response.data?.status).toBeDefined();
  }
};