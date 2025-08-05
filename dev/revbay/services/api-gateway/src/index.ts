import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { logger } from '@revbay/shared';
import { errorHandler } from './middleware/errorHandler';
import { customersRouter } from './routes/customers';
import { paymentsRouter } from './routes/payments';

// Load environment variables
dotenv.config();

// Initialize Prisma client
const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'revbay-api-gateway'
  });
});

// API routes
app.use('/v1/customers', customersRouter);
app.use('/v1/payments', paymentsRouter);

// Error handling middleware (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`🚀 RevBay API Gateway listening on port ${PORT}`);
  logger.info(`📖 Health check available at http://localhost:${PORT}/health`);
});

export { prisma };