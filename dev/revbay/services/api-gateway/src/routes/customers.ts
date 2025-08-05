import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /v1/customers/test - Test endpoint without auth
router.get('/test', async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { email: 'test@revbay.com' }
  });

  res.json({
    success: true,
    data: {
      message: 'Database connection working!',
      customer: customer ? {
        id: customer.id,
        email: customer.email,
        name: customer.name
      } : null
    }
  });
});

// Simple auth middleware
async function simpleAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: { code: 'NO_AUTH', message: 'Authorization header required' }
    });
  }

  const apiKey = authHeader.replace('Bearer ', '');
  
  const customer = await prisma.customer.findUnique({
    where: { apiKey }
  });

  if (!customer) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_KEY', message: 'Invalid API key' }
    });
  }

  req.customer = customer;
  next();
}

// GET /v1/customers/me - Get authenticated customer
router.get('/me', simpleAuth, async (req: any, res) => {
  res.json({
    success: true,
    data: {
      id: req.customer.id,
      email: req.customer.email,
      name: req.customer.name,
      createdAt: req.customer.createdAt
    }
  });
});

export { router as customersRouter };