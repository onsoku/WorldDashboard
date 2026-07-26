import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['{src,server}/**/*.test.ts'],
    // Several suites chdir into a temp directory and re-import modules that
    // capture process.cwd() at load time, so they must not share a worker.
    fileParallelism: false,
  },
})
