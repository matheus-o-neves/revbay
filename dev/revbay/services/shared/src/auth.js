"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateApiKey = generateApiKey;
// Auth utilities placeholder
function generateApiKey() {
    return `sk_revbay_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
}
