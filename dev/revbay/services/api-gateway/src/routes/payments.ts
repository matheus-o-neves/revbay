import { Router, Request, Response } from 'express';
import axios, { AxiosError } from 'axios';
import { logger } from '@revbay/shared';
import { PaymentMethod, PaymentStatus, APIResponse } from '@revbay/types';

export const paymentsRouter = Router();

// Payment Orchestrator Service Configuration
const PAYMENT_ORCHESTRATOR_URL = process.env.PAYMENT_ORCHESTRATOR_URL || 'http://localhost:3001';

interface PaymentRequest {
  amount: number;
  currency: string;
  customerId: string;
  paymentMethod: PaymentMethod;
  description?: string;
  metadata?: Record<string, any>;
}

interface PaymentResponse {
  success: boolean;
  transactionId: string;
  status: PaymentStatus;
  providerId: string;
  amount: number;
  currency: string;
  paymentId?: string;
  message?: string;
  error?: string;
}

// Helper function to make HTTP calls to payment orchestrator
async function callPaymentOrchestrator(endpoint: string, options: {
  method: 'GET' | 'POST';
  body?: any;
}): Promise<any> {
  const url = `${PAYMENT_ORCHESTRATOR_URL}${endpoint}`;
  
  logger.info(`Calling payment orchestrator: ${options.method} ${url}`);

  try {
    const response = await axios({
      method: options.method,
      url,
      data: options.body,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RevBay-API-Gateway/1.0.0'
      },
      timeout: 30000 // 30 second timeout
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('Payment orchestrator error', {
        url,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      
      // Re-throw with more specific error information
      const status = error.response?.status;
      if (status === 404) {
        throw new Error('Payment service not found');
      } else if (status && status >= 500) {
        throw new Error('Payment service unavailable');
      } else {
        throw new Error(`Payment service error: ${status || 'unknown'}`);
      }
    } else {
      logger.error('Failed to call payment orchestrator', {
        url,
        error: error instanceof Error ? error.message : error
      });
      throw new Error('Payment service connection failed');
    }
  }
}

// POST /v1/payments/process - Process a payment
paymentsRouter.post('/process', async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, currency, paymentMethod, description, metadata } = req.body;
    
    // Get customerId from request (assuming it's passed in auth middleware or body)
    const customerId = req.body.customerId || (req as any).user?.id;

    if (!customerId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required'
        }
      } satisfies APIResponse);
      return;
    }

    if (!amount || !currency || !paymentMethod) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: amount, currency, paymentMethod'
        }
      } satisfies APIResponse);
      return;
    }

    const paymentRequest: PaymentRequest = {
      amount,
      currency,
      customerId,
      paymentMethod,
      description,
      metadata
    };

    const paymentResponse: PaymentResponse = await callPaymentOrchestrator('/v1/payments/process', {
      method: 'POST',
      body: paymentRequest
    });

    // Log successful payment initiation
    logger.info('Payment initiated through API Gateway', {
      customerId,
      amount,
      currency,
      paymentMethod,
      paymentId: paymentResponse.paymentId,
      success: paymentResponse.success
    });

    res.json({
      success: true,
      data: {
        paymentId: paymentResponse.paymentId,
        transactionId: paymentResponse.transactionId,
        status: paymentResponse.status,
        amount: paymentResponse.amount,
        currency: paymentResponse.currency,
        message: paymentResponse.message
        // Note: providerId is intentionally excluded to maintain payment processor abstraction
      }
    } satisfies APIResponse);
  } catch (error) {
    logger.error('Payment processing failed in API Gateway', {
      error: error instanceof Error ? error.message : error,
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'PAYMENT_PROCESSING_ERROR',
        message: 'Failed to process payment'
      }
    } satisfies APIResponse);
  }
});

// GET /v1/payments/:paymentId - Get payment details
paymentsRouter.get('/:paymentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Payment ID is required'
        }
      } satisfies APIResponse);
      return;
    }

    const payment = await callPaymentOrchestrator(`/v1/payments/${paymentId}`, {
      method: 'GET'
    });

    if (!payment.success) {
      res.status(404).json({
        success: false,
        error: {
          code: 'PAYMENT_NOT_FOUND',
          message: 'Payment not found'
        }
      } satisfies APIResponse);
      return;
    }

    res.json({
      success: true,
      data: payment.payment
    } satisfies APIResponse);
  } catch (error) {
    logger.error('Failed to fetch payment details', {
      paymentId: req.params.paymentId,
      error: error instanceof Error ? error.message : error
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: 'Failed to fetch payment details'
      }
    } satisfies APIResponse);
  }
});

// GET /v1/payments/status/:transactionId - Check payment status
paymentsRouter.get('/status/:transactionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactionId } = req.params;

    if (!transactionId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Transaction ID is required'
        }
      } satisfies APIResponse);
      return;
    }

    // Note: Provider is determined internally by the orchestrator based on the transaction ID
    const statusResponse = await callPaymentOrchestrator(
      `/v1/payments/status/${transactionId}`, 
      { method: 'GET' }
    );

    res.json({
      success: true,
      data: {
        transactionId: statusResponse.transactionId,
        status: statusResponse.status,
        amount: statusResponse.amount,
        currency: statusResponse.currency,
        success: statusResponse.success,
        message: statusResponse.message
        // Note: Provider information is intentionally excluded to maintain payment processor abstraction
      }
    } satisfies APIResponse);
  } catch (error) {
    logger.error('Failed to check payment status', {
      transactionId: req.params.transactionId,
      error: error instanceof Error ? error.message : error
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_CHECK_ERROR',
        message: 'Failed to check payment status'
      }
    } satisfies APIResponse);
  }
});

// GET /v1/payments - Get customer payments (requires authentication)
paymentsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Get customerId from authenticated user context
    const customerId = (req as any).user?.id || req.query.customerId;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!customerId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required'
        }
      } satisfies APIResponse);
      return;
    }

    const paymentsResponse = await callPaymentOrchestrator(
      `/v1/payments/customer/${customerId}?limit=${limit}`, 
      { method: 'GET' }
    );

    res.json({
      success: true,
      data: {
        payments: paymentsResponse.payments,
        total: paymentsResponse.payments?.length || 0
      }
    } satisfies APIResponse);
  } catch (error) {
    logger.error('Failed to fetch customer payments', {
      customerId: (req as any).user?.id || req.query.customerId,
      error: error instanceof Error ? error.message : error
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: 'Failed to fetch payments'
      }
    } satisfies APIResponse);
  }
});