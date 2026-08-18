import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom, not node: the EPUB writer validates its own output with DOMParser, and the
    // XHTML well-formedness check is the single most valuable test in the suite.
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
