import { PrismaClient } from '@prisma/client';
import { PaymentRequest, PaymentResponse, InternalPayment, PaymentProcessor } from '../types/payment';
import { logger } from '@revbay/shared';

export class PaymentService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async createPayment(request: PaymentRequest, response: PaymentResponse): Promise<InternalPayment> {
    try {
      const payment = await this.prisma.payment.create({
        data: {
          customerId: request.customerId,
          amount: Math.round(request.amount * 100), // Convert to cents
          currency: request.currency,
          status: response.status,
          paymentMethod: request.paymentMethod,
          processor: response.providerId,
          processorId: response.transactionId,
          processorMetadata: {
            success: response.success,
            message: response.message,
            error: response.error,
            originalRequest: {
              description: request.description,
              metadata: request.metadata
            }
          },
          metadata: request.metadata || {}
        }
      });

      logger.info('Payment record created in database', {
        paymentId: payment.id,
        customerId: payment.customerId,
        amount: payment.amount,
        status: payment.status,
        processor: payment.processor
      });

      return {
        id: payment.id,
        customerId: payment.customerId,
        amount: payment.amount / 100, // Convert back from cents
        currency: payment.currency,
        status: payment.status as any,
        paymentMethod: payment.paymentMethod as any,
        processor: payment.processor as PaymentProcessor,
        processorId: payment.processorId || undefined,
        processorMetadata: payment.processorMetadata as Record<string, any>,
        metadata: payment.metadata as Record<string, any>,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
      };
    } catch (error) {
      logger.error('Failed to create payment record', error);
      throw new Error('Database operation failed');
    }
  }

  async updatePaymentStatus(paymentId: string, status: PaymentResponse): Promise<InternalPayment | null> {
    try {
      const payment = await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: status.status,
          processorMetadata: {
            ...(typeof status === 'object' ? status : {}),
            lastUpdated: new Date().toISOString()
          }
        }
      });

      logger.info('Payment status updated', {
        paymentId: payment.id,
        oldStatus: payment.status,
        newStatus: status.status
      });

      return {
        id: payment.id,
        customerId: payment.customerId,
        amount: payment.amount / 100,
        currency: payment.currency,
        status: payment.status as any,
        paymentMethod: payment.paymentMethod as any,
        processor: payment.processor as PaymentProcessor,
        processorId: payment.processorId || undefined,
        processorMetadata: payment.processorMetadata as Record<string, any>,
        metadata: payment.metadata as Record<string, any>,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
      };
    } catch (error) {
      logger.error('Failed to update payment status', error);
      return null;
    }
  }

  async getPaymentByProcessorId(processorId: string, processor: PaymentProcessor): Promise<InternalPayment | null> {
    try {
      const payment = await this.prisma.payment.findFirst({
        where: {
          processorId,
          processor
        }
      });

      if (!payment) {
        return null;
      }

      return {
        id: payment.id,
        customerId: payment.customerId,
        amount: payment.amount / 100,
        currency: payment.currency,
        status: payment.status as any,
        paymentMethod: payment.paymentMethod as any,
        processor: payment.processor as PaymentProcessor,
        processorId: payment.processorId || undefined,
        processorMetadata: payment.processorMetadata as Record<string, any>,
        metadata: payment.metadata as Record<string, any>,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
      };
    } catch (error) {
      logger.error('Failed to get payment by processor ID', error);
      return null;
    }
  }

  async getPaymentById(paymentId: string): Promise<InternalPayment | null> {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId }
      });

      if (!payment) {
        return null;
      }

      return {
        id: payment.id,
        customerId: payment.customerId,
        amount: payment.amount / 100,
        currency: payment.currency,
        status: payment.status as any,
        paymentMethod: payment.paymentMethod as any,
        processor: payment.processor as PaymentProcessor,
        processorId: payment.processorId || undefined,
        processorMetadata: payment.processorMetadata as Record<string, any>,
        metadata: payment.metadata as Record<string, any>,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
      };
    } catch (error) {
      logger.error('Failed to get payment by ID', error);
      return null;
    }
  }

  async getCustomerPayments(customerId: string, limit: number = 50): Promise<InternalPayment[]> {
    try {
      const payments = await this.prisma.payment.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return payments.map(payment => ({
        id: payment.id,
        customerId: payment.customerId,
        amount: payment.amount / 100,
        currency: payment.currency,
        status: payment.status as any,
        paymentMethod: payment.paymentMethod as any,
        processor: payment.processor as PaymentProcessor,
        processorId: payment.processorId || undefined,
        processorMetadata: payment.processorMetadata as Record<string, any>,
        metadata: payment.metadata as Record<string, any>,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
      }));
    } catch (error) {
      logger.error('Failed to get customer payments', error);
      return [];
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}