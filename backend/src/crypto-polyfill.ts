// Comprehensive crypto polyfill for Docker/Alpine environments
import { webcrypto } from 'crypto';

// Ensure crypto is available globally
if (!global.crypto) {
  // Try to use Node.js crypto first
  try {
    const crypto = require('crypto');
    
    // Create a crypto-like object with the methods that @nestjs/schedule might need
    (global as any).crypto = {
      getRandomValues: (array: any) => {
        const buffer = crypto.randomBytes(array.length);
        for (let i = 0; i < array.length; i++) {
          array[i] = buffer[i];
        }
        return array;
      },
      randomUUID: crypto.randomUUID ? crypto.randomUUID.bind(crypto) : () => {
        // Fallback UUID v4 generator
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      },
      subtle: undefined, // Skip subtle crypto for now
    };
  } catch (error) {
    console.warn('Failed to setup crypto polyfill:', error);
    
    // Minimal fallback
    (global as any).crypto = {
      getRandomValues: (array: any) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      },
      randomUUID: () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      },
    };
  }
} 