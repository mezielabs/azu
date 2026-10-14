import { router } from '@inertiajs/react'
import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'

/**
 * Warns before leaving a form with unsaved changes: a dialog for Inertia
 * visits (links, navigation), the browser's own prompt for reloads,
 * closing the tab and leaving the app. The form's own submit isn't a
 * GET, so it passes.
 *
 * Inertia can't intercept the browser's back button between pages of
 * the same app, so that one leaves without asking.
 */
export function UnsavedChanges({ when }: { when: boolean }) {
  const [pending, setPending] = useState<string | null>(null)
  const leaving = useRef(false)

  useEffect(() => {
    if (!when) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    const removeListener = router.on('before', (event) => {
      const visit = event.detail.visit
      if (leaving.current || visit.method !== 'get') return
      event.preventDefault()
      setPending(visit.url.href)
    })

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      removeListener()
    }
  }, [when])

  function leave() {
    if (!pending) return
    leaving.current = true
    setPending(null)
    router.visit(pending)
  }

  return (
    <ModalOverlay
      className="azu-modal-overlay"
      isOpen={pending !== null}
      onOpenChange={(open) => !open && setPending(null)}
      isDismissable
    >
      <Modal className="azu-modal">
        <Dialog role="alertdialog" className="azu-dialog">
          <Heading slot="title" className="azu-dialog-title">
            Discard unsaved changes?
          </Heading>
          <p className="azu-dialog-body">Your changes on this form haven&apos;t been saved.</p>
          <div className="azu-dialog-actions">
            <Button className="azu-button" onPress={() => setPending(null)} autoFocus>
              Keep editing
            </Button>
            <Button className="azu-button azu-button-danger" onPress={leave}>
              Discard changes
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
