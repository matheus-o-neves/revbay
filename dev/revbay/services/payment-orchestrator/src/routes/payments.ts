import { Router, Request, Response } from 'express';
import { PaymentOrchestrator } from '../providers/PaymentOrchestrator';
import { PaymentRequest, PaymentProviderType } from '../types/payment';
import { AuditService } from '../services/AuditService';
import { logger } from '@revbay/shared';

export const paymentsRouter = Router();
const orchestrator = new PaymentOrchestrator();
const auditService = new AuditService();

paymentsRouter.post('/process', async (req: Request, res: Response) => {
  try {
    const { amount, currency, customerId, paymentMethod, description, metadata, provider } = req.body;

    if (!amount || !currency || !customerId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: amount, currency, customerId, paymentMethod'
        }
      });
    }

    if (!['CARD', 'PIX', 'BOLETO'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYMENT_METHOD',
          message: 'Payment method must be one of: CARD, PIX, BOLETO'
        }
      });
    }

    const paymentRequest: PaymentRequest = {
      amount,
      currency,
      customerId,
      paymentMethod,
      description,
      metadata
    };

    const result = await orchestrator.processPayment(
      paymentRequest,
      provider as PaymentProviderType
    );

    res.json(result);
  } catch (error) {
    logger.error('Payment processing error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: 'Failed to process payment'
      }
    });
  }
});

paymentsRouter.get('/status/:transactionId', async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    const { provider } = req.query;

    if (!provider) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Provider parameter is required'
        }
      });
    }

    const result = await orchestrator.getTransactionStatus(
      transactionId,
      provider as PaymentProviderType
    );

    res.json(result);
  } catch (error) {
    logger.error('Transaction status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_ERROR',
        message: 'Failed to get transaction status'
      }
    });
  }
});

paymentsRouter.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // Log data access attempt
    auditService.logSecurityEvent('customer_payment_access', customerId, {
      requestedLimit: limit,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    const payments = await orchestrator.getCustomerPayments(customerId, limit);
    
    // Return only public payment data, not internal processor details
    const publicPayments = payments.map(payment => ({
      id: payment.id,
      customerId: payment.customerId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      metadata: payment.metadata,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    }));

    res.json({
      success: true,
      payments: publicPayments
    });
  } catch (error) {
    logger.error('Get customer payments error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: 'Failed to fetch customer payments'
      }
    });
  }
});

paymentsRouter.get('/:paymentId', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;

    // Log individual payment access
    auditService.logSecurityEvent('payment_access', 'unknown', {
      paymentId,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    const payment = await orchestrator.getPaymentById(paymentId);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PAYMENT_NOT_FOUND',
          message: 'Payment not found'
        }
      });
    }

    // Return only public payment data
    const publicPayment = {
      id: payment.id,
      customerId: payment.customerId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      metadata: payment.metadata,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    };

    res.json({
      success: true,
      payment: publicPayment
    });
  } catch (error) {
    logger.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: 'Failed to fetch payment'
      }
    });
  }
});

