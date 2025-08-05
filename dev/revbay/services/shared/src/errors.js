"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.PaymentError = exports.ValidationError = exports.RevBayError = void 0;
class RevBayError extends Error {
    code;
    statusCode;
    details;
    constructor(message, code, statusCode = 500, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'RevBayError';
    }
}
exports.RevBayError = RevBayError;
class ValidationError extends RevBayError {
    constructor(message, details) {
        super(message, 'VALIDATION_ERROR', 400, details);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class PaymentError extends RevBayError {
    constructor(message, details) {
        super(message, 'PAYMENT_ERROR', 402, details);
        this.name = 'PaymentError';
    }
}
exports.PaymentError = PaymentError;
class AuthenticationError extends RevBayError {
    constructor(message = 'Authentication required') {
        super(message, 'AUTHENTICATION_ERROR', 401);
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends RevBayError {
    constructor(message = 'Insufficient permissions') {
        super(message, 'AUTHORIZATION_ERROR', 403);
        this.name = 'AuthorizationError';
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends RevBayError {
    constructor(message = 'Resource not found') {
        super(message, 'NOT_FOUND', 404);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends RevBayError {
    constructor(message) {
        super(message, 'CONFLICT', 409);
        this.name = 'ConflictError';
    }
}
exports.ConflictError = ConflictError;
class RateLimitError extends RevBayError {
    constructor(message = 'Rate limit exceeded') {
        super(message, 'RATE_LIMIT_EXCEEDED', 429);
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
