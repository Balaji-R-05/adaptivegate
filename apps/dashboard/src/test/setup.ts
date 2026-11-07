import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// @testing-library/react's auto-cleanup relies on detecting a global
// `afterEach` (Jest-style globals). This project's vitest.config.ts doesn't
// enable `test.globals`, so auto-detection doesn't kick in — without this,
// each test's rendered DOM stays mounted into the next test, causing
// "found multiple elements" failures once more than one test in a file
// renders the same component.
afterEach(() => {
  cleanup();
});
