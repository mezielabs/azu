import type { ReactNode, SVGProps } from 'react'

/**
 * The shell's own icons, inline: they don't depend on `lucide-react`,
 * which is optional. Decorative; the control around each one is named.
 */
function Icon(props: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="azu-icon"
      {...props}
    />
  )
}

export const MenuIcon = () => (
  <Icon width="20" height="20" strokeWidth="2">
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Icon>
)

export const CloseIcon = () => (
  <Icon width="20" height="20" strokeWidth="2">
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)

export const DashboardIcon = () => (
  <Icon>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </Icon>
)

export const ExternalIcon = () => (
  <Icon>
    <path d="M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
  </Icon>
)

export const SignOutIcon = () => (
  <Icon>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </Icon>
)

export const MoonIcon = () => (
  <Icon>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </Icon>
)

export const SunIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
)

export const SearchIcon = () => (
  <Icon>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
)

export const ChevronDownIcon = () => (
  <Icon width="14" height="14" strokeWidth="2">
    <path d="m6 9 6 6 6-6" />
  </Icon>
)

export const FiltersIcon = () => (
  <Icon strokeWidth="2">
    <path d="M4 6h16M7 12h10M10 18h4" />
  </Icon>
)

export const PlusIcon = () => (
  <Icon strokeWidth="2.2">
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const ImageIcon = () => (
  <Icon>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
  </Icon>
)

export const MoreIcon = () => (
  <Icon fill="currentColor" stroke="none">
    <circle cx="5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="19" cy="12" r="1.6" />
  </Icon>
)

/** A sortable column's hint, or its current direction */
export const SortIcon = ({ direction }: { direction: 'ascending' | 'descending' | null }) => (
  <Icon width="14" height="14" strokeWidth="2">
    {direction !== 'descending' && <path d="m8 9 4-4 4 4" opacity={direction ? 1 : 0.55} />}
    {direction !== 'ascending' && <path d="m16 15-4 4-4-4" opacity={direction ? 1 : 0.55} />}
  </Icon>
)

export const ChevronsUpDownIcon = () => (
  <Icon>
    <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
  </Icon>
)

export const MonitorIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </Icon>
)

export const CheckIcon = () => (
  <Icon strokeWidth="2.2">
    <path d="m5 12 5 5 9-10" />
  </Icon>
)
