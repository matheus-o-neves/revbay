import dotenv from 'dotenv';
import path from 'path';

// Load environment variables for testing
dotenv.config({ path: path.join(__dirname, '..', '.env.test') });

// Global test configuration
global.console = {
  ...console,
  // Suppress console.log during tests unless explicitly needed
  log: process.env.TEST_VERBOSE === 'true' ? console.log : jest.fn(),
  debug: process.env.TEST_VERBOSE === 'true' ? console.debug : jest.fn(),
  info: process.env.TEST_VERBOSE === 'true' ? console.info : jest.fn(),
  warn: console.warn,
  error: console.error,
};

// Test timeouts
jest.setTimeout(30000);