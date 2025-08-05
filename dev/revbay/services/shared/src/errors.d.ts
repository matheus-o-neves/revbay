export declare class RevBayError extends Error {
    code: string;
    statusCode: number;
    details?: any | undefined;
    constructor(message: string, code: string, statusCode?: number, details?: any | undefined);
}
export declare class ValidationError extends RevBayError {
    constructor(message: string, details?: any);
}
export declare class PaymentError extends RevBayError {
    constructor(message: string, details?: any);
}
export declare class AuthenticationError extends RevBayError {
    constructor(message?: string);
}
export declare class AuthorizationError extends RevBayError {
    constructor(message?: string);
}
export declare class NotFoundError extends RevBayError {
    constructor(message?: string);
}
export declare class ConflictError extends RevBayError {
    constructor(message: string);
}
export declare class RateLimitError extends RevBayError {
    constructor(message?: string);
}
