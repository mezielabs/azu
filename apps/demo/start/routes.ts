/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'
import demo from '#config/demo'

router.on('/').renderInertia('home', {}).as('home')

router
  .group(() => {
    router.get('signup', [controllers.NewAccount, 'create'])
    router.post('signup', [controllers.NewAccount, 'store'])

    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])
  })
  .use(middleware.guest())

router
  .group(() => {
    router.on('/dashboard').renderInertia('dashboard', {}).as('dashboard')
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())

/**
 * The public demo (DEMO_MODE): "Sign in as …" on the login page, and the
 * host's health check. These routes don't exist otherwise.
 */
if (demo.enabled) {
  router.get('health', [controllers.HealthChecks]).as('demo.health')

  router
    .post('demo/sign-in/:role', [controllers.DemoSession, 'store'])
    .where('role', /^(admin|editor|viewer)$/)
    .as('demo.sign_in')
}
