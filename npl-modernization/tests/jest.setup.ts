// Initialize Buffer before any imports to avoid esbuild issues
(global as any).Buffer = require('buffer').Buffer;

// Initialize Angular testing environment
import 'jest-preset-angular/setup-jest';
