import Logo from '~/components/logo'
import { type ReactNode } from 'react'
import { usePage } from '@inertiajs/react'
import FlashToasts from '~/components/flash_toasts'
import ThemeToggle from '~/components/theme_toggle'

/**
 * What each role sees in the public demo (DEMO_MODE), beside the
 * "Sign in as …" buttons
 */
const DEMO_ROLES = [
  {
    name: 'Admin',
    text: (
      <>
        Everything, including <b>Delete</b>, <b>Publish</b>, and user roles.
      </>
    ),
  },
  {
    name: 'Editor',
    text: (
      <>
        Edits products, with no <b>Delete</b> or <b>Publish</b>. Some resources are hidden.
      </>
    ),
  },
  { name: 'Viewer', text: "Looks around, and can't change anything." },
]

export default function AuthLayout({ children }: { children: ReactNode }) {
  // The login page's `demo` prop is only there in DEMO_MODE
  const { props } = usePage<{ demo?: unknown }>()

  return (
    <>
      <div className="auth">
        <div className="auth__form-col">
          <Logo size={28} />
          <div className="auth__form-wrap">{children}</div>
          <div style={{ height: 20 }} />
        </div>

        <aside className="auth__aside">
          <div className="auth__aside-top">
            <ThemeToggle />
          </div>

          {props.demo ? (
            <dl className="auth__roles" aria-label="What each role sees">
              {DEMO_ROLES.map((role) => (
                <div key={role.name} className="auth__role">
                  <dt>{role.name}</dt>
                  <dd>{role.text}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <p className="auth__links">
            <a className="il" href="https://azuadmin.com/docs/">
              Azu docs
            </a>
            <a className="il" href="https://github.com/mezielabs/azu">
              GitHub
            </a>
          </p>
        </aside>
      </div>
      <FlashToasts />
    </>
  )
}
