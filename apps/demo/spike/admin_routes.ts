/**
 * SPIKE (Phase 0, risk check 3). Throwaway.
 *
 * Mounts two package-rendered pages under /admin with no auth, so the
 * package-pages pipeline can be checked in a browser. Phase 1 replaces
 * this with the real route registration and the accessAdmin gate.
 */
import router from '@adonisjs/core/services/router'
import { registerSpikeRoutes } from '@mezielabs/azu/spike'
import { productResource } from './type_inference_check.js'

registerSpikeRoutes(router, [productResource])
