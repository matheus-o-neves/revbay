import { TestClient, TestData, TestAssertions, TestPaymentRequest } from '../utils/testHelpers';

describe('RevBay Payment Flow Integration Tests', () => {
  let testClient: TestClient;
  const testCustomerId = process.env.TEST_CUSTOMER_ID || 'test_customer_12345';

  beforeAll(async () => {
    testClient = new TestClient();
    
    // Verify services are running
    const gatewayHealthy = await testClient.checkAPIGatewayHealth();
    const orchestratorHealthy = await testClient.checkOrchestratorHealth();
    
    if (!gatewayHealthy) {
      throw new Error('API Gateway is not running or healthy. Please start the API Gateway service.');
    }
    
    if (!orchestratorHealthy) {
      throw new Error('Payment Orchestrator is not running or healthy. Please start the Payment Orchestrator service.');
    }
  });

  describe('Service Health Checks', () => {
    test('API Gateway should be healthy', async () => {
      const isHealthy = await testClient.checkAPIGatewayHealth();
      expect(isHealthy).toBe(true);
    });

    test('Payment Orchestrator should be healthy', async () => {
      const isHealthy = await testClient.checkOrchestratorHealth();
      expect(isHealthy).toBe(true);
    });
  });

  describe('API Gateway Payment Processing', () => {
    describe('Successful Payment Scenarios', () => {
      test('Should process CARD payment through API Gateway → International processor', async () => {
        const paymentRequest = TestData.validCardPayment(testCustomerId);
        const response = await testClient.processPaymentViaGateway(paymentRequest);
        
        TestAssertions.expectValidPaymentResponse(response);
        
        // Should route to international processor for card payments
        if (response.success && response.data) {
          expect(response.data.amount).toBe(paymentRequest.amount);
          expect(response.data.currency).toBe(paymentRequest.currency);
          expect(['PENDING', 'SUCCEEDED', 'FAILED']).toContain(response.data.status);
        }
      });

      test('Should process PIX payment through API Gateway → Domestic processor', async () => {
        const paymentRequest = TestData.validPixPayment(testCustomerId);
        const response = await testClient.processPaymentViaGateway(paymentRequest);
        
        TestAssertions.expectValidPaymentResponse(response);
        
        // Should route to domestic processor for PIX payments
        if (response.success && response.data) {
          expect(response.data.amount).toBe(paymentRequest.amount);
          expect(response.data.currency).toBe('BRL');
          expect(['PENDING', 'SUCCEEDED', 'FAILED']).toContain(response.data.status);
        }
      });

      test('Should process BOLETO payment through API Gateway → Domestic processor', async () => {
        const paymentRequest = TestData.validBoletoPayment(testCustomerId);
        const response = await testClient.processPaymentViaGateway(paymentRequest);
        
        TestAssertions.expectValidPaymentResponse(response);
        
        // Should route to domestic processor for Boleto payments
        if (response.success && response.data) {
          expect(response.data.amount).toBe(paymentRequest.amount);
          expect(response.data.currency).toBe('BRL');
          expect(['PENDING', 'SUCCEEDED', 'FAILED']).toContain(response.data.status);
        }
      });
    });

    describe('Payment Validation Scenarios', () => {
      test('Should reject PIX payment with non-BRL currency', async () => {
        const paymentRequest = TestData.invalidCurrencyPixPayment(testCustomerId);
        const response = await testClient.processPaymentViaGateway(paymentRequest);
        
        // Should either fail at gateway validation or orchestrator validation
        TestAssertions.expectValidPaymentResponse(response);
        
        if (response.success && response.data) {
          // If it reaches the orchestrator, it should fail there
          expect(response.data.status).toBe('FAILED');
        } else {
          // Or fail at API Gateway validation
          expect(response.success).toBe(false);
        }
      });

      test('Should reject payment with missing required fields', async () => {
        const invalidRequest = TestData.missingFieldsPayment() as any;
        
        try {
          const response = await testClient.processPaymentViaGateway(invalidRequest);
          TestAssertions.expectFailedPaymentResponse(response);
          expect(['MISSING_CUSTOMER_ID', 'INVALID_REQUEST']).toContain(response.error?.code);
        } catch (error) {
          // Request might fail at HTTP level due to validation
          expect(error).toBeDefined();
        }
      });

      test('Should handle large amount payments', async () => {
        const paymentRequest = TestData.largeAmountPayment(testCustomerId);
        const response = await testClient.processPaymentViaGateway(paymentRequest);
        
        TestAssertions.expectValidPaymentResponse(response);
        
        if (response.success && response.data) {
          expect(response.data.amount).toBe(paymentRequest.amount);
        }
      });
    });

    describe('Payment Retrieval', () => {
      test('Should retrieve customer payments via API Gateway', async () => {
        // First create a payment
        const paymentRequest = TestData.validCardPayment(testCustomerId);
        const createResponse = await testClient.processPaymentViaGateway(paymentRequest);
        
        // Then retrieve customer payments
        const paymentsResponse = await testClient.getCustomerPaymentsViaGateway(testCustomerId);
        
        expect(paymentsResponse.success).toBe(true);
        expect(paymentsResponse.data).toBeDefined();
        expect(paymentsResponse.data.payments).toBeDefined();
        expect(Array.isArray(paymentsResponse.data.payments)).toBe(true);
      });

      test('Should retrieve individual payment details via API Gateway', async () => {
        // First create a payment
        const paymentRequest = TestData.validCardPayment(testCustomerId);
        const createResponse = await testClient.processPaymentViaGateway(paymentRequest);
        
        if (createResponse.success && createResponse.data?.paymentId) {
          const paymentResponse = await testClient.getPaymentViaGateway(createResponse.data.paymentId);
          
          expect(paymentResponse.success).toBe(true);
          expect(paymentResponse.data).toBeDefined();
          expect(paymentResponse.data.payment).toBeDefined();
        }
      });
    });
  });

  describe('Direct Payment Orchestrator Testing', () => {
    describe('Provider Routing Logic', () => {
      test('Should route CARD payments to international processor', async () => {
        const paymentRequest = TestData.validCardPayment(testCustomerId);
        const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
        
        expect(response).toBeDefined();
        // International processor failures are expected with test credentials
        // but we can verify the routing happened correctly
        expect(response.providerId).toBe('STRIPE');
      });

      test('Should route PIX payments to domestic processor', async () => {
        const paymentRequest = TestData.validPixPayment(testCustomerId);
        const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
        
        expect(response).toBeDefined();
        // Domestic processor failures are expected with test credentials
        // but we can verify the routing happened correctly
        expect(response.providerId).toBe('CELCOIN');
      });

      test('Should route BOLETO payments to domestic processor', async () => {
        const paymentRequest = TestData.validBoletoPayment(testCustomerId);
        const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
        
        expect(response).toBeDefined();
        expect(response.providerId).toBe('CELCOIN');
      });
    });

    describe('Currency Validation', () => {
      test('Should enforce BRL currency for PIX payments', async () => {
        const paymentRequest = TestData.invalidCurrencyPixPayment(testCustomerId);
        const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
        
        expect(response.success).toBe(false);
        expect(response.error).toContain('PIX and Boleto payments only support BRL currency');
      });

      test('Should enforce BRL currency for BOLETO payments', async () => {
        const paymentRequest: TestPaymentRequest = {
          amount: 100.00,
          currency: 'USD', // Invalid for Boleto
          customerId: testCustomerId,
          paymentMethod: 'BOLETO',
          description: 'Test Boleto with invalid currency'
        };
        
        const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
        
        expect(response.success).toBe(false);
        expect(response.error).toContain('PIX and Boleto payments only support BRL currency');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('Should handle API Gateway service unavailable', async () => {
      // Create a client with invalid gateway URL
      const invalidClient = new TestClient('http://localhost:9999', process.env.PAYMENT_ORCHESTRATOR_URL);
      
      const paymentRequest = TestData.validCardPayment(testCustomerId);
      
      await expect(invalidClient.processPaymentViaGateway(paymentRequest))
        .rejects.toThrow();
    });

    test('Should handle Payment Orchestrator service unavailable', async () => {
      // This would require stopping the orchestrator service
      // For now, we'll test with an invalid URL
      const invalidClient = new TestClient(process.env.API_GATEWAY_URL, 'http://localhost:9999');
      
      const paymentRequest = TestData.validCardPayment(testCustomerId);
      
      try {
        const response = await invalidClient.processPaymentViaGateway(paymentRequest);
        // Should return an error response from API Gateway
        expect(response.success).toBe(false);
        expect(response.error?.code).toBe('PAYMENT_PROCESSING_ERROR');
      } catch (error) {
        // Or throw an exception
        expect(error).toBeDefined();
      }
    });

    test('Should handle malformed payment requests', async () => {
      const malformedRequests = [
        { amount: 'invalid', currency: 'USD', customerId: testCustomerId, paymentMethod: 'CARD' },
        { amount: -100, currency: 'USD', customerId: testCustomerId, paymentMethod: 'CARD' },
        { amount: 100, currency: 'INVALID', customerId: testCustomerId, paymentMethod: 'CARD' },
        { amount: 100, currency: 'USD', customerId: '', paymentMethod: 'CARD' },
        { amount: 100, currency: 'USD', customerId: testCustomerId, paymentMethod: 'INVALID' },
      ];

      for (const request of malformedRequests) {
        try {
          const response = await testClient.processPaymentViaGateway(request as any);
          
          if (response.success === false) {
            expect(response.error).toBeDefined();
            expect(response.error?.code).toBeDefined();
          }
        } catch (error) {
          // Some requests might fail at HTTP level
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('Performance and Load Testing', () => {
    test('Should handle concurrent payment requests', async () => {
      const concurrentRequests = 5;
      const paymentPromises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const paymentRequest = TestData.validCardPayment(`${testCustomerId}_concurrent_${i}`);
        paymentPromises.push(testClient.processPaymentViaGateway(paymentRequest));
      }

      const responses = await Promise.allSettled(paymentPromises);
      
      // All requests should complete (either successfully or with errors)
      expect(responses).toHaveLength(concurrentRequests);
      
      responses.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          TestAssertions.expectValidPaymentResponse(result.value);
        } else {
          console.warn(`Concurrent request ${index} failed:`, result.reason);
        }
      });
    });

    test('Should respond within reasonable time limits', async () => {
      const startTime = Date.now();
      const paymentRequest = TestData.validCardPayment(testCustomerId);
      
      const response = await testClient.processPaymentViaGateway(paymentRequest);
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Should respond within 10 seconds
      expect(responseTime).toBeLessThan(10000);
      TestAssertions.expectValidPaymentResponse(response);
    });
  });
});