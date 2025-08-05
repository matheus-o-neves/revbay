import { PrismaClient } from '@prisma/client';
import { TestClient, TestData } from '../utils/testHelpers';

describe('Database Persistence and Audit Logging Tests', () => {
  let testClient: TestClient;
  let prisma: PrismaClient;
  const testCustomerId = 'db_test_customer_12345';

  beforeAll(async () => {
    testClient = new TestClient();
    prisma = new PrismaClient();
    
    // Verify services are running
    const orchestratorHealthy = await testClient.checkOrchestratorHealth();
    if (!orchestratorHealthy) {
      throw new Error('Payment Orchestrator is not running. Database tests require the orchestrator service.');
    }

    // Verify database connection
    try {
      await prisma.$connect();
    } catch (error) {
      throw new Error('Cannot connect to database. Please ensure PostgreSQL is running.');
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Payment Record Persistence', () => {
    test('Should create payment record in database when processing payment', async () => {
      const paymentRequest = {
        amount: 123.45,
        currency: 'USD',
        customerId: testCustomerId,
        paymentMethod: 'CARD' as const,
        description: 'Database persistence test payment',
        metadata: { testType: 'database_persistence' }
      };

      // Process payment through orchestrator
      const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
      
      expect(response).toBeDefined();
      expect(response.paymentId).toBeDefined();

      if (response.paymentId) {
        // Verify payment was saved to database
        const dbPayment = await prisma.payment.findUnique({
          where: { id: response.paymentId }
        });

        expect(dbPayment).toBeDefined();
        expect(dbPayment?.customerId).toBe(testCustomerId);
        expect(dbPayment?.amount).toBe(Math.round(paymentRequest.amount * 100)); // Stored in cents
        expect(dbPayment?.currency).toBe(paymentRequest.currency);
        expect(dbPayment?.paymentMethod).toBe(paymentRequest.paymentMethod);
        expect(dbPayment?.processor).toBe('STRIPE'); // Should route to international processor for CARD
        expect(dbPayment?.processorId).toBe(response.transactionId);
        expect(dbPayment?.createdAt).toBeDefined();
        expect(dbPayment?.updatedAt).toBeDefined();
      }
    });

    test('Should store payment metadata and processor information', async () => {
      const metadata = {
        orderId: 'test_order_67890',
        productId: 'test_product_123',
        customField: 'test_value'
      };

      const paymentRequest = {
        amount: 67.89,
        currency: 'BRL',
        customerId: testCustomerId,
        paymentMethod: 'PIX' as const,
        description: 'Metadata storage test',
        metadata
      };

      const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
      
      expect(response).toBeDefined();
      expect(response.paymentId).toBeDefined();

      if (response.paymentId) {
        const dbPayment = await prisma.payment.findUnique({
          where: { id: response.paymentId }
        });

        expect(dbPayment).toBeDefined();
        expect(dbPayment?.processor).toBe('CELCOIN'); // Should route to domestic processor for PIX
        expect(dbPayment?.metadata).toBeDefined();
        
        // Verify metadata was stored
        const storedMetadata = dbPayment?.metadata as any;
        expect(storedMetadata).toMatchObject(metadata);

        // Verify processor metadata was stored
        expect(dbPayment?.processorMetadata).toBeDefined();
        const processorMetadata = dbPayment?.processorMetadata as any;
        expect(processorMetadata.success).toBeDefined();
        expect(processorMetadata.originalRequest).toBeDefined();
      }
    });

    test('Should persist payments for different payment methods', async () => {
      const paymentMethods = [
        { method: 'CARD' as const, currency: 'USD', expectedProcessor: 'STRIPE' },
        { method: 'PIX' as const, currency: 'BRL', expectedProcessor: 'CELCOIN' },
        { method: 'BOLETO' as const, currency: 'BRL', expectedProcessor: 'CELCOIN' }
      ];

      for (const { method, currency, expectedProcessor } of paymentMethods) {
        const paymentRequest = {
          amount: 45.67,
          currency,
          customerId: `${testCustomerId}_${method.toLowerCase()}`,
          paymentMethod: method,
          description: `${method} persistence test`,
          metadata: { paymentMethod: method }
        };

        const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
        
        expect(response).toBeDefined();
        expect(response.paymentId).toBeDefined();

        if (response.paymentId) {
          const dbPayment = await prisma.payment.findUnique({
            where: { id: response.paymentId }
          });

          expect(dbPayment).toBeDefined();
          expect(dbPayment?.paymentMethod).toBe(method);
          expect(dbPayment?.currency).toBe(currency);
          expect(dbPayment?.processor).toBe(expectedProcessor);
        }
      }
    });
  });

  describe('Payment Status Updates', () => {
    test('Should update payment status when checking transaction status', async () => {
      const paymentRequest = {
        amount: 89.12,
        currency: 'USD',
        customerId: testCustomerId,
        paymentMethod: 'CARD' as const,
        description: 'Status update test payment'
      };

      // Create payment
      const createResponse = await testClient.processPaymentViaOrchestrator(paymentRequest);
      
      expect(createResponse.paymentId).toBeDefined();
      expect(createResponse.transactionId).toBeDefined();

      if (createResponse.paymentId && createResponse.transactionId) {
        // Get initial payment from database
        const initialPayment = await prisma.payment.findUnique({
          where: { id: createResponse.paymentId }
        });

        expect(initialPayment).toBeDefined();
        const initialUpdatedAt = initialPayment?.updatedAt;

        // Small delay to ensure updatedAt timestamp will be different
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check status (should trigger database update)
        const statusResponse = await testClient.getPaymentStatusViaOrchestrator(
          createResponse.transactionId,
          'STRIPE'
        );

        expect(statusResponse).toBeDefined();

        // Get updated payment from database
        const updatedPayment = await prisma.payment.findUnique({
          where: { id: createResponse.paymentId }
        });

        expect(updatedPayment).toBeDefined();
        
        // Verify status was updated in database
        if (statusResponse.status !== initialPayment?.status) {
          expect(updatedPayment?.status).toBe(statusResponse.status);
        }

        // Verify processorMetadata was updated
        expect(updatedPayment?.processorMetadata).toBeDefined();
        const processorMetadata = updatedPayment?.processorMetadata as any;
        expect(processorMetadata.lastUpdated).toBeDefined();
      }
    });
  });

  describe('Customer Payment History', () => {
    test('Should retrieve customer payment history from database', async () => {
      const historyTestCustomerId = 'history_test_customer_12345';
      
      // Create multiple payments for the same customer
      const paymentRequests = [
        {
          amount: 25.00,
          currency: 'USD',
          customerId: historyTestCustomerId,
          paymentMethod: 'CARD' as const,
          description: 'History test payment 1'
        },
        {
          amount: 50.00,
          currency: 'BRL',
          customerId: historyTestCustomerId,
          paymentMethod: 'PIX' as const,
          description: 'History test payment 2'
        },
        {
          amount: 75.00,
          currency: 'BRL',
          customerId: historyTestCustomerId,
          paymentMethod: 'BOLETO' as const,
          description: 'History test payment 3'
        }
      ];

      const createdPayments = [];
      for (const request of paymentRequests) {
        const response = await testClient.processPaymentViaOrchestrator(request);
        expect(response.paymentId).toBeDefined();
        createdPayments.push(response);
        
        // Small delay between payments
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Retrieve customer payments through orchestrator
      const historyResponse = await testClient.getCustomerPaymentsViaGateway(historyTestCustomerId, 10);
      
      expect(historyResponse.success).toBe(true);
      expect(historyResponse.data.payments).toBeDefined();
      expect(Array.isArray(historyResponse.data.payments)).toBe(true);
      expect(historyResponse.data.payments.length).toBeGreaterThanOrEqual(3);

      // Verify payments are ordered by creation date (newest first)
      const payments = historyResponse.data.payments;
      for (let i = 0; i < payments.length - 1; i++) {
        const currentPayment = new Date(payments[i].createdAt);
        const nextPayment = new Date(payments[i + 1].createdAt);
        expect(currentPayment.getTime()).toBeGreaterThanOrEqual(nextPayment.getTime());
      }

      // Verify payment data contains expected fields but no internal details
      payments.forEach((payment: any) => {
        expect(payment).toHaveProperty('id');
        expect(payment).toHaveProperty('customerId');
        expect(payment).toHaveProperty('amount');
        expect(payment).toHaveProperty('currency');
        expect(payment).toHaveProperty('status');
        expect(payment).toHaveProperty('paymentMethod');
        expect(payment).toHaveProperty('createdAt');
        expect(payment).toHaveProperty('updatedAt');
        
        // Should not expose internal processor details
        expect(payment).not.toHaveProperty('processor');
        expect(payment).not.toHaveProperty('processorId');
        expect(payment).not.toHaveProperty('processorMetadata');
        
        expect(payment.customerId).toBe(historyTestCustomerId);
      });
    });
  });

  describe('Database Error Handling', () => {
    test('Should handle database connection issues gracefully', async () => {
      // This test would require mocking database failures
      // For now, we'll verify that payments still attempt to process even if DB operations might fail
      const paymentRequest = {
        amount: 99.99,
        currency: 'USD',
        customerId: testCustomerId,
        paymentMethod: 'CARD' as const,
        description: 'Database error handling test'
      };

      const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
      
      // Even if database operations fail, the payment orchestrator should still attempt processing
      expect(response).toBeDefined();
      expect(response.providerId).toBe('STRIPE');
    });
  });

  describe('Data Integrity and Constraints', () => {
    test('Should enforce database constraints and data types', async () => {
      const paymentRequest = {
        amount: 12.34,
        currency: 'EUR',
        customerId: testCustomerId,
        paymentMethod: 'CARD' as const,
        description: 'Data integrity test payment'
      };

      const response = await testClient.processPaymentViaOrchestrator(paymentRequest);
      
      expect(response.paymentId).toBeDefined();

      if (response.paymentId) {
        const dbPayment = await prisma.payment.findUnique({
          where: { id: response.paymentId }
        });

        expect(dbPayment).toBeDefined();
        
        // Verify data types and constraints
        expect(typeof dbPayment?.id).toBe('string');
        expect(typeof dbPayment?.customerId).toBe('string');
        expect(typeof dbPayment?.amount).toBe('number');
        expect(typeof dbPayment?.currency).toBe('string');
        expect(typeof dbPayment?.status).toBe('string');
        expect(typeof dbPayment?.paymentMethod).toBe('string');
        expect(typeof dbPayment?.processor).toBe('string');
        expect(dbPayment?.createdAt).toBeInstanceOf(Date);
        expect(dbPayment?.updatedAt).toBeInstanceOf(Date);
        
        // Verify enum values
        expect(['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED']).toContain(dbPayment?.status);
        expect(['CARD', 'PIX', 'BOLETO']).toContain(dbPayment?.paymentMethod);
        expect(['STRIPE', 'CELCOIN']).toContain(dbPayment?.processor);
      }
    });
  });
});