/**
 * What each role sees in the public demo (DEMO_MODE). The login page's
 * right panel shows it, and on narrow screens, where that panel is
 * hidden, the login page shows it below the "Sign in as …" buttons.
 */
export const DEMO_ROLES = [
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

export default function DemoRoles({ className }: { className: string }) {
  return (
    <dl className={className} aria-label="What each role sees">
      {DEMO_ROLES.map((role) => (
        <div key={role.name} className="demo-role">
          <dt>{role.name}</dt>
          <dd>{role.text}</dd>
        </div>
      ))}
    </dl>
  )
}
