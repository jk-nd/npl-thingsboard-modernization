import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

// Load all spec/test files from tests/ui directory
const context = (require as any).context('../tests/ui', true, /\.spec\.ts$|\.test\.ts$/);
context.keys().forEach(context);


