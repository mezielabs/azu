import type { ComponentType } from 'react'

/**
 * An icon component: an SVG that takes a class name and hides itself
 * from screen readers when told to.
 */
export type IconComponent = ComponentType<{ 'className'?: string; 'aria-hidden'?: boolean }>

/**
 * Navigation icons by name (FR-16). This module is empty on purpose: the
 * `azu()` Vite plugin replaces it with the icons the app's resources
 * name (`icon: 'package'`), and only those, from `lucide-react` when the
 * app has it installed. Without it, the navigation shows no icons.
 */
const icons: Record<string, IconComponent> = {}

export default icons
