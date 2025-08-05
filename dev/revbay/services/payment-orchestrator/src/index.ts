import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { logger } from '@revbay/shared';
import { errorHandler } from './middleware/errorHandler';
import { paymentsRouter } from './routes/payments';

dotenv.config();

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many payment requests from this IP'
});

app.use(helmet());
app.use(cors());
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'revbay-payment-orchestrator'
  });
});

app.use('/v1/payments', paymentsRouter);

app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info(`💳 RevBay Payment Orchestrator listening on port ${PORT}`);
  logger.info(`📖 Health check available at http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

export { prisma };