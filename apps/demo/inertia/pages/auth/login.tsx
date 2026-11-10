import AuthLayout from '~/layouts/auth'
import DemoBanner from '~/components/demo_banner'
import { usePage } from '@inertiajs/react'
import { Form, Link } from '@adonisjs/inertia/react'

type DemoRole = 'admin' | 'editor' | 'viewer'

/**
 * The public demo (DEMO_MODE): the roles to sign in as, and when the
 * demo last reset. Absent otherwise.
 */
type DemoProps = {
  roles: DemoRole[]
  resetEveryMinutes: number
  lastResetAt: string | null
}

const ROLE_LABELS: Record<DemoRole, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
}

export default function Login({ demo }: { demo?: DemoProps }) {
  const { signupOpen } = usePage().props
  return (
    <>
      {demo && <DemoBanner everyMinutes={demo.resetEveryMinutes} lastResetAt={demo.lastResetAt} />}

      <h1 className="auth__title">Welcome back</h1>
      <p className="auth__sub">Sign in to continue building.</p>

      {demo && (
        <div className="demo-sign-in" aria-label="Try the demo" role="group">
          {/* A POST each, with the XSRF-TOKEN cookie as the CSRF token */}
          {demo.roles.map((role) => (
            <Form key={role} action={`/demo/sign-in/${role}`} method="post">
              {({ processing }) => (
                <button
                  type="submit"
                  className="btn btn--secondary btn--block"
                  disabled={processing}
                >
                  Sign in as {ROLE_LABELS[role]}
                </button>
              )}
            </Form>
          ))}
          <p className="demo-sign-in__or">or with an email and password</p>
        </div>
      )}

      <Form route="session.store">
        {({ errors, processing }) => (
          <div className="auth__form">
            <div className="field">
              <label className="field__label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="field__input"
                autoComplete="username"
                placeholder="you@example.com"
                aria-invalid={errors.email ? 'true' : 'false'}
              />
              {errors.email && <span className="field__error">{errors.email}</span>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="field__input"
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={errors.password ? 'true' : 'false'}
              />
              {errors.password && <span className="field__error">{errors.password}</span>}
            </div>

            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={processing}
              style={{ marginTop: 4 }}
            >
              {processing ? 'One moment…' : 'Sign in'}
            </button>
          </div>
        )}
      </Form>

      {signupOpen && (
        <p className="auth__foot">
          New here?{' '}
          <Link route="new_account.create" className="il">
            Create an account
          </Link>
        </p>
      )}
    </>
  )
}

Login.layout = [AuthLayout]
