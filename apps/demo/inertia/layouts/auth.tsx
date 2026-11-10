import Logo from '~/components/logo'
import { type ReactNode } from 'react'
import { usePage } from '@inertiajs/react'
import DemoRoles from '~/components/demo_roles'
import FlashToasts from '~/components/flash_toasts'
import ThemeToggle from '~/components/theme_toggle'

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

          {props.demo ? <DemoRoles className="auth__roles" /> : null}

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
