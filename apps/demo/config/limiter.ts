import { defineConfig, stores } from '@adonisjs/limiter'

/**
 * Rate limits for the public demo (DEMO_MODE, start/limiter.ts). The
 * demo runs as one process, so counts live in memory and start again
 * when it restarts.
 */
const limiterConfig = defineConfig({
  default: 'memory',
  stores: {
    memory: stores.memory({}),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
