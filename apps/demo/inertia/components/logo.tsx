import { Link } from '@adonisjs/inertia/react'

/**
 * Azu's mark, linking home. The same tile as public/images/logo.svg, the
 * admin panel's brand logo (config/azu.ts).
 */
export default function Logo({ size = 26 }: { size?: number }) {
  return (
    <Link route="home" aria-label="Azu home" style={{ display: 'inline-flex' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="24" height="24" rx="6" fill="#b0472a" />
        <path
          d="M7 17 12 6l5 11M9 13h6"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  )
}
