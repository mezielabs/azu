import { Dialog, Modal, ModalOverlay } from 'react-aria-components'
import type { AzuSharedProps } from '@mezielabs/azu/types'
import { CloseIcon } from './shell_icons.tsx'
import { Brand, SidebarContent } from './sidebar.tsx'

/**
 * The phone menu: the sidebar as a modal drawer. React Aria's modal
 * traps focus, closes on Escape or a press outside, and returns focus to
 * the menu button. Loaded on first open, so wide screens never load it.
 */
export function MenuDrawer(props: {
  azu: AzuSharedProps['azu']
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <ModalOverlay
      isOpen={props.isOpen}
      onOpenChange={props.onOpenChange}
      isDismissable
      className="azu-drawer-overlay"
    >
      <Modal className="azu-drawer">
        <Dialog aria-label="Menu" className="azu-drawer-dialog">
          <div className="azu-drawer-header">
            <Brand azu={props.azu} />
            <button
              type="button"
              className="azu-icon-button azu-touch"
              aria-label="Close menu"
              onClick={() => props.onOpenChange(false)}
            >
              <CloseIcon />
            </button>
          </div>
          <SidebarContent azu={props.azu} variant="drawer" />
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
