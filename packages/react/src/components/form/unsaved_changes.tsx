import { router } from '@inertiajs/react'
import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'

type Visit = Parameters<Parameters<typeof router.on<'before'>>[1]>[0]['detail']['visit']

/**
 * Warns before leaving a form with unsaved changes: a "Leave without
 * saving?" dialog for Inertia visits (the sidebar, a breadcrumb, Cancel,
 * Sign out), and the browser's own prompt for reloads, closing the tab
 * and leaving the app. The form's own submit (`submit`: its method and
 * URL) passes, and so does what follows a successful one.
 *
 * Inertia can't intercept the browser's back button between pages of
 * the same app, so that one leaves without asking.
 */
export function UnsavedChanges(props: {
  when: boolean
  /** The form's own submit, which never asks */
  submit: { method: string; url: string }
}) {
  const { when } = props
  const [pending, setPending] = useState<Visit | null>(null)
  const leaving = useRef(false)
  const submit = useRef(props.submit)
  submit.current = props.submit

  useEffect(() => {
    if (!when) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    const removeListener = router.on('before', (event) => {
      const visit = event.detail.visit
      if (leaving.current || visit.prefetch) return
      const own = new URL(submit.current.url, window.location.href)
      if (visit.method === submit.current.method && visit.url.pathname === own.pathname) return
      event.preventDefault()
      setPending(visit)
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
    // The same visit: a link's GET, or Sign out's POST
    router.visit(pending.url.href, {
      method: pending.method,
      data: pending.data,
      replace: pending.replace,
      preserveScroll: pending.preserveScroll,
      preserveState: pending.preserveState,
      only: pending.only,
      except: pending.except,
      headers: pending.headers,
      onFinish: () => {
        leaving.current = false
      },
    })
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
            Leave without saving?
          </Heading>
          <p className="azu-dialog-body">Your changes on this form haven&apos;t been saved.</p>
          <div className="azu-dialog-actions">
            <Button className="azu-button" onPress={() => setPending(null)} autoFocus>
              Stay
            </Button>
            <Button className="azu-button azu-button-danger" onPress={leave}>
              Leave
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
