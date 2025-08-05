import { Request, Response, NextFunction } from 'express';
import { logger } from '@revbay/shared';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error('Payment Orchestrator Error:', error.message);

  res.status(500).json({
    success: false,
    error: {
      code: 'PAYMENT_ERROR',
      message: 'An unexpected payment processing error occurred'
    }
  });
}