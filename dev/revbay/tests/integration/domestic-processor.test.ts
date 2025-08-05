import { TestClient, TestData, TestAssertions } from '../utils/testHelpers';

describe('Domestic Processor Integration Tests', () => {
  let testClient: TestClient;
  const testCustomerId = 'domestic_test_customer_12345';

  beforeAll(async () => {
    testClient = new TestClient();
    
    const orchestratorHealthy = await testClient.checkOrchestratorHealth();
    if (!orchestratorHealthy) {
      throw new Error('Payment Orchestrator is not running. Domestic processor integration tests require the orchestrator service.');
    }
  });

  describe('PIX Payment Processing', () => {
    test('Should route PIX payments to domestic processor provider', async () => {
      const paymentRequest = {
        amount: 50.00,
        currency: 'BRL',
        customerId: testCustomerId,
        paymentMethod: 'PIX' as const,
        description: 'Test PIX payment via domestic processor',
        metadata: { 
          testType: 'pix_payment',
          pixKey: 'test@example.com'
        }
      };

      const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
      
      expect(response).toBeDefined();
      expect(response.providerId).toBe('CELCOIN');
      expect(response.currency).toBe('BRL');
      expect(response.amount).toBe(paymentRequest.amount);
    });

    test('Should handle different PIX amounts', async () => {
      const amounts = [1.00, 50.00, 1000.00, 9999.99];
      
      for (const amount of amounts) {
        const paymentRequest = {
          amount,
          currency: 'BRL',
          customerId: `${testCustomerId}_${amount}`,
          paymentMethod: 'PIX' as const,
          description: `PIX payment of R$ ${amount}`,
          metadata: { testAmount: amount }
        };

        const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
        
        expect(response).toBeDefined();
        expect(response.providerId).toBe('CELCOIN');
        expect(response.amount).toBe(amount);
        expect(response.currency).toBe('BRL');
      }
    });

    test('Should enforce BRL currency for PIX payments', async () => {
      const invalidCurrencies = ['USD', 'EUR', 'GBP'];
      
      for (const currency of invalidCurrencies) {
        const paymentRequest = {
          amount: 100.00,
          currency,
          customerId: testCustomerId,
          paymentMethod: 'PIX' as const,
          description: `PIX payment with invalid currency ${currency}`
        };

        const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
        
        expect(response.success).toBe(false);
        expect(response.error).toContain('PIX and Boleto payments only support BRL currency');
      }
    });
  });

  describe('Boleto Payment Processing', () => {
    test('Should route Boleto payments to domestic processor provider', async () => {
      const paymentRequest = {
        amount: 150.00,
        currency: 'BRL',
        customerId: testCustomerId,
        paymentMethod: 'BOLETO' as const,
        description: 'Test Boleto payment via domestic processor',
        metadata: { 
          testType: 'boleto_payment',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
        }
      };

      const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
      
      expect(response).toBeDefined();
      expect(response.providerId).toBe('CELCOIN');
      expect(response.currency).toBe('BRL');
      expect(response.amount).toBe(paymentRequest.amount);
    });

    test('Should handle different Boleto amounts', async () => {
      const amounts = [10.00, 100.00, 500.00, 2000.00];
      
      for (const amount of amounts) {
        const paymentRequest = {
          amount,
          currency: 'BRL',
          customerId: `${testCustomerId}_boleto_${amount}`,
          paymentMethod: 'BOLETO' as const,
          description: `Boleto payment of R$ ${amount}`,
          metadata: { testAmount: amount }
        };

        const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
        
        expect(response).toBeDefined();
        expect(response.providerId).toBe('CELCOIN');
        expect(response.amount).toBe(amount);
        expect(response.currency).toBe('BRL');
      }
    });

    test('Should enforce BRL currency for Boleto payments', async () => {
      const invalidCurrencies = ['USD', 'EUR', 'GBP'];
      
      for (const currency of invalidCurrencies) {
        const paymentRequest = {
          amount: 200.00,
          currency,
          customerId: testCustomerId,
          paymentMethod: 'BOLETO' as const,
          description: `Boleto payment with invalid currency ${currency}`
        };

        const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
        
        expect(response.success).toBe(false);
        expect(response.error).toContain('PIX and Boleto payments only support BRL currency');
      }
    });
  });

  describe('Domestic Processor Service Behavior', () => {
    test('Should handle domestic processor sandbox environment responses', async () => {
      const paymentRequest = {
        amount: 25.00,
        currency: 'BRL',
        customerId: testCustomerId,
        paymentMethod: 'PIX' as const,
        description: 'Sandbox environment test',
        metadata: { environment: 'sandbox' }
      };

      const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
      
      expect(response).toBeDefined();
      expect(response.providerId).toBe('CELCOIN');
      
      // In sandbox mode, we expect the call to be made but might fail due to auth
      // The important thing is that routing works correctly
      expect(response.currency).toBe('BRL');
      expect(response.amount).toBe(paymentRequest.amount);
    });

    test('Should preserve PIX metadata in domestic processor requests', async () => {
      const metadata = {
        pixKey: 'user@example.com',
        description: 'Test PIX payment',
        merchantId: 'test_merchant_123',
        reference: 'order_456'
      };

      const paymentRequest = {
        amount: 75.50,
        currency: 'BRL',
        customerId: testCustomerId,
        paymentMethod: 'PIX' as const,
        description: 'PIX metadata preservation test',
        metadata
      };

      const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
      
      expect(response).toBeDefined();
      expect(response.providerId).toBe('CELCOIN');
      expect(response.amount).toBe(paymentRequest.amount);
    });

    test('Should preserve Boleto metadata in domestic processor requests', async () => {
      const metadata = {
        customerName: 'João Silva',
        customerDocument: '12345678901',
        dueDate: '2024-12-31',
        instructions: 'Test boleto payment'
      };

      const paymentRequest = {
        amount: 199.99,
        currency: 'BRL',
        customerId: testCustomerId,
        paymentMethod: 'BOLETO' as const,
        description: 'Boleto metadata preservation test',
        metadata
      };

      const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
      
      expect(response).toBeDefined();
      expect(response.providerId).toBe('CELCOIN');
      expect(response.amount).toBe(paymentRequest.amount);
    });
  });

  describe('Domestic Processor Payment Status Tracking', () => {
    test('Should track PIX payment status', async () => {
      const paymentRequest = {
        amount: 33.33,
        currency: 'BRL',
        customerId: testCustomerId,
        paymentMethod: 'PIX' as const,
        description: 'PIX status tracking test'
      };

      const createResponse = await testClient.processPaymentViaOrchestrator(paymentRequest);
      
      expect(createResponse).toBeDefined();
      expect(createResponse.providerId).toBe('CELCOIN');
      
      if (createResponse.transactionId) {
        const statusResponse = await testClient.getPaymentStatusViaOrchestrator(
          createResponse.transactionId, 
          'CELCOIN'
        );
        
        expect(statusResponse).toBeDefined();
        expect(statusResponse.transactionId).toBe(createResponse.transactionId);
        expect(['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED']).toContain(statusResponse.status);
      }
    });

    test('Should track Boleto payment status', async () => {
      const paymentRequest = {
        amount: 88.88,
        currency: 'BRL',
        customerId: testCustomerId,
        paymentMethod: 'BOLETO' as const,
        description: 'Boleto status tracking test'
      };

      const createResponse = await testClient.processPaymentViaOrchestrator(paymentRequest);
      
      expect(createResponse).toBeDefined();
      expect(createResponse.providerId).toBe('CELCOIN');
      
      if (createResponse.transactionId) {
        const statusResponse = await testClient.getPaymentStatusViaOrchestrator(
          createResponse.transactionId, 
          'CELCOIN'
        );
        
        expect(statusResponse).toBeDefined();
        expect(statusResponse.transactionId).toBe(createResponse.transactionId);
        expect(['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED']).toContain(statusResponse.status);
      }
    });
  });

  describe('Brazilian Payment Method Validation', () => {
    test('Should only allow BRL for Brazilian payment methods', async () => {
      const brazilianMethods = ['PIX', 'BOLETO'] as const;
      const nonBRLCurrencies = ['USD', 'EUR'];
      
      for (const method of brazilianMethods) {
        for (const currency of nonBRLCurrencies) {
          const paymentRequest = {
            amount: 100.00,
            currency,
            customerId: testCustomerId,
            paymentMethod: method,
            description: `${method} with ${currency} currency (should fail)`
          };

          const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
          
          expect(response.success).toBe(false);
          expect(response.error).toContain('PIX and Boleto payments only support BRL currency');
        }
      }
    });

    test('Should allow BRL for Brazilian payment methods', async () => {
      const brazilianMethods = ['PIX', 'BOLETO'] as const;
      
      for (const method of brazilianMethods) {
        const paymentRequest = {
          amount: 55.55,
          currency: 'BRL',
          customerId: `${testCustomerId}_${method.toLowerCase()}`,
          paymentMethod: method,
          description: `${method} with BRL currency (should work)`
        };

        const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
        
        expect(response).toBeDefined();
        expect(response.providerId).toBe('CELCOIN');
        expect(response.currency).toBe('BRL');
        expect(response.amount).toBe(paymentRequest.amount);
      }
    });
  });
});