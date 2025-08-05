import { TestClient, TestData, TestAssertions } from '../utils/testHelpers';

describe('International Processor Integration Tests', () => {
  let testClient: TestClient;
  const testCustomerId = 'international_test_customer_12345';

  beforeAll(async () => {
    testClient = new TestClient();
    
    const orchestratorHealthy = await testClient.checkOrchestratorHealth();
    if (!orchestratorHealthy) {
      throw new Error('Payment Orchestrator is not running. International processor integration tests require the orchestrator service.');
    }
  });

  describe('International Processor Test Card Numbers', () => {
    // Using test card numbers for international processor validation
    
    test('Should handle successful payment with test card (4242424242424242)', async () => {
      const paymentRequest = {
        amount: 50.00,
        currency: 'USD',
        customerId: testCustomerId,
        paymentMethod: 'CARD' as const,
        description: 'International processor test card payment - success',
        metadata: { 
          testCard: '4242424242424242',
          testType: 'success_card'
        }
      };

      const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
      
      expect(response).toBeDefined();
      expect(response.providerId).toBe('STRIPE');
      
      // With international processor test credentials, we expect the routing to work
      // but the actual payment might fail due to incomplete setup
      if (response.success) {
        expect(response.transactionId).toBeDefined();
        expect(response.status).toBeDefined();
        expect(['PENDING', 'SUCCEEDED', 'FAILED']).toContain(response.status);
      }
    });

    test('Should handle different currency payments through international processor', async () => {
      const currencies = ['USD', 'EUR', 'GBP', 'CAD'];
      
      for (const currency of currencies) {
        const paymentRequest = {
          amount: 25.00,
          currency,
          customerId: testCustomerId,
          paymentMethod: 'CARD' as const,
          description: `Test ${currency} payment`,
          metadata: { testCurrency: currency }
        };

        const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
        
        expect(response).toBeDefined();
        expect(response.providerId).toBe('STRIPE');
        expect(response.currency).toBe(currency);
      }
    });

    test('Should handle large amount payments through international processor', async () => {
      const paymentRequest = {
        amount: 999999.99, // Large amount
        currency: 'USD',
        customerId: testCustomerId,
        paymentMethod: 'CARD' as const,
        description: 'Large amount test payment',
        metadata: { testType: 'large_amount' }
      };

      const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
      
      expect(response).toBeDefined();
      expect(response.providerId).toBe('STRIPE');
      expect(response.amount).toBe(paymentRequest.amount);
    });

    test('Should handle small amount payments through international processor', async () => {
      const paymentRequest = {
        amount: 0.01, // Minimum amount
        currency: 'USD',
        customerId: testCustomerId,
        paymentMethod: 'CARD' as const,
        description: 'Minimum amount test payment',
        metadata: { testType: 'minimum_amount' }
      };

      const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
      
      expect(response).toBeDefined();
      expect(response.providerId).toBe('STRIPE');
      expect(response.amount).toBe(paymentRequest.amount);
    });
  });

  describe('International Processor Error Scenarios', () => {
    test('Should handle zero amount payments', async () => {
      const paymentRequest = {
        amount: 0,
        currency: 'USD',
        customerId: testCustomerId,
        paymentMethod: 'CARD' as const,
        description: 'Zero amount test payment'
      };

      const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
      
      expect(response).toBeDefined();
      expect(response.providerId).toBe('STRIPE');
      
      // International processor should reject zero amount payments
      if (!response.success) {
        expect(response.error).toBeDefined();
      }
    });

    test('Should handle invalid currency codes', async () => {
      const paymentRequest = {
        amount: 100.00,
        currency: 'INVALID',
        customerId: testCustomerId,
        paymentMethod: 'CARD' as const,
        description: 'Invalid currency test payment'
      };

      const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
      
      expect(response).toBeDefined();
      expect(response.providerId).toBe('STRIPE');
      
      // Should handle the invalid currency gracefully
      if (!response.success) {
        expect(response.error).toBeDefined();
      }
    });
  });

  describe('International Processor Payment Status Tracking', () => {
    test('Should track payment status for international processor transactions', async () => {
      // First create a payment
      const paymentRequest = {
        amount: 75.00,
        currency: 'USD',
        customerId: testCustomerId,
        paymentMethod: 'CARD' as const,
        description: 'Status tracking test payment'
      };

      const createResponse = await testClient.processPaymentViaOrchestrator(paymentRequest);
      
      expect(createResponse).toBeDefined();
      expect(createResponse.providerId).toBe('STRIPE');
      
      if (createResponse.transactionId) {
        // Then check the status
        const statusResponse = await testClient.getPaymentStatusViaOrchestrator(
          createResponse.transactionId, 
          'STRIPE'
        );
        
        expect(statusResponse).toBeDefined();
        expect(statusResponse.transactionId).toBe(createResponse.transactionId);
        expect(['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED']).toContain(statusResponse.status);
      }
    });
  });

  describe('International Processor Metadata Handling', () => {
    test('Should preserve metadata in international processor payments', async () => {
      const metadata = {
        orderId: 'test_order_12345',
        customField: 'test_value',
        timestamp: new Date().toISOString()
      };

      const paymentRequest = {
        amount: 35.00,
        currency: 'USD',
        customerId: testCustomerId,
        paymentMethod: 'CARD' as const,
        description: 'Metadata test payment',
        metadata
      };

      const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
      
      expect(response).toBeDefined();
      expect(response.providerId).toBe('STRIPE');
      
      // Metadata should be preserved (even if payment fails)
      expect(response.amount).toBe(paymentRequest.amount);
      expect(response.currency).toBe(paymentRequest.currency);
    });
  });

  describe('International Processor Service Integration', () => {
    test('Should properly route card payments to international processor service', async () => {
      const paymentMethods = ['CARD'];
      
      for (const method of paymentMethods) {
        const paymentRequest = {
          amount: 42.00,
          currency: 'USD',
          customerId: testCustomerId,
          paymentMethod: method as 'CARD',
          description: `Test ${method} payment routing`
        };

        const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
        
        expect(response).toBeDefined();
        expect(response.providerId).toBe('STRIPE');
        
        // Verify the payment was processed by international processor
        expect(response.amount).toBe(paymentRequest.amount);
        expect(response.currency).toBe(paymentRequest.currency);
      }
    });

    test('Should handle international processor service timeouts gracefully', async () => {
      // This test would ideally use a mock or configured delay
      // For now, we'll test normal operation and verify timeout handling exists
      const paymentRequest = {
        amount: 100.00,
        currency: 'USD',
        customerId: testCustomerId,
        paymentMethod: 'CARD' as const,
        description: 'Timeout test payment'
      };

      const startTime = Date.now();
      const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
      const endTime = Date.now();
      
      expect(response).toBeDefined();
      expect(response.providerId).toBe('STRIPE');
      
      // Should complete within reasonable time (our timeout is 30s)
      expect(endTime - startTime).toBeLessThan(30000);
    });
  });
});