import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      exclude: ['./demos/*', '**/*.spec.js', 'vitest.config.js']
    }
  }
});
