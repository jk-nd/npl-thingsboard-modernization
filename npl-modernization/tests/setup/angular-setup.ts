// Initialize Buffer for esbuild compatibility
(global as any).Buffer = require('buffer').Buffer;

// Initialize Angular testing environment (jest-preset-angular handles TestBed setup)
import 'jest-preset-angular/setup-jest';
