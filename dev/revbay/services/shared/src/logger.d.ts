import winston from 'winston';
export declare const logger: winston.Logger;
export declare function createContextualLogger(context: {
    requestId?: string;
    customerId?: string;
}): winston.Logger;
