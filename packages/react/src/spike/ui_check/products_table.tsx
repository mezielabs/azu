/**
 * SPIKE (Phase 1 UI check). List table: React Aria's Table with
 * server-side sorting (Inertia partial reload), keyboard row selection,
 * resizable columns, and a confirmed bulk action.
 */
import { useState } from 'react'
import { router } from '@inertiajs/react'
import {
  Button,
  Cell,
  Checkbox,
  Column,
  ColumnResizer,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ResizableTableContainer,
  Row,
  Table,
  TableBody,
  TableHeader,
  type Selection,
  type SortDescriptor,
} from 'react-aria-components'
import { cx } from './utils.ts'

/**
 * React Aria's Checkbox renders nothing visible on its own
 */
function SelectionCheckbox() {
  return (
    <Checkbox slot="selection" className="azu-checkbox">
      {({ isSelected, isIndeterminate }) => (
        <span
          className={cx('azu-checkbox-box', (isSelected || isIndeterminate) && 'azu-is-selected')}
          aria-hidden
        >
          {isIndeterminate ? '–' : isSelected ? '✓' : ''}
        </span>
      )}
    </Checkbox>
  )
}

export type ProductRow = {
  id: number
  name: string
  sku: string
  price: string
  status: string
  category: string
}

const COLUMNS = [
  { id: 'name', label: 'Name', sortable: true, rowHeader: true },
  { id: 'sku', label: 'SKU', sortable: true },
  { id: 'price', label: 'Price', sortable: true },
  { id: 'status', label: 'Status', sortable: true },
  { id: 'category', label: 'Category', sortable: false },
] as const

export function ProductsTable(props: {
  path: string
  products: ProductRow[]
  sort: SortDescriptor
}) {
  const [selection, setSelection] = useState<Selection>(new Set())
  const [resizable, setResizable] = useState(true)
  const ids = selection === 'all' ? props.products.map((p) => p.id) : [...selection].map(Number)

  function sortBy(descriptor: SortDescriptor) {
    router.get(
      `${props.path}/ui-check`,
      { sort: String(descriptor.column), direction: descriptor.direction },
      { preserveState: true, preserveScroll: true, only: ['products', 'sort'] }
    )
  }

  function publish(close: () => void) {
    router.post(
      `${props.path}/ui-check/publish`,
      { ids },
      {
        preserveScroll: true,
        onSuccess: () => {
          setSelection(new Set())
          close()
        },
      }
    )
  }

  return (
    <div className="azu-check" data-azu-check="table">
      <div className="azu-toolbar">
        <label>
          <input
            type="checkbox"
            checked={resizable}
            onChange={(e) => setResizable(e.target.checked)}
          />{' '}
          Resizable columns
        </label>
        <span data-azu-check-result="selection">
          {selection === 'all' ? 'all' : ids.length} selected (ids: {ids.join(',') || 'none'})
        </span>
        <DialogTrigger>
          <Button className="azu-button" isDisabled={ids.length === 0}>
            Publish selected
          </Button>
          <Modal className="azu-modal" isDismissable>
            <Dialog className="azu-dialog" role="alertdialog">
              {({ close }) => (
                <>
                  <Heading slot="title">Publish {ids.length} products?</Heading>
                  <div className="azu-toolbar">
                    <Button className="azu-button" onPress={close}>
                      Cancel
                    </Button>
                    <Button
                      className="azu-button azu-is-primary"
                      autoFocus
                      onPress={() => publish(close)}
                    >
                      Publish
                    </Button>
                  </div>
                </>
              )}
            </Dialog>
          </Modal>
        </DialogTrigger>
      </div>
      <ResizableTableContainer className="azu-table-container">
        <Table
          aria-label="Products"
          className="azu-table"
          selectionMode="multiple"
          selectedKeys={selection}
          onSelectionChange={setSelection}
          sortDescriptor={props.sort}
          onSortChange={sortBy}
        >
          <TableHeader>
            <Column width={44} minWidth={44} className="azu-th">
              <SelectionCheckbox />
            </Column>
            {COLUMNS.map((column) => (
              <Column
                key={column.id}
                id={column.id}
                isRowHeader={'rowHeader' in column}
                allowsSorting={column.sortable}
                className="azu-th"
                minWidth={80}
              >
                {({ sortDirection }) => (
                  <div className="azu-th-inner">
                    <span>
                      {column.label}
                      {sortDirection && (sortDirection === 'ascending' ? ' ▲' : ' ▼')}
                    </span>
                    {resizable && <ColumnResizer className="azu-column-resizer" />}
                  </div>
                )}
              </Column>
            ))}
          </TableHeader>
          <TableBody items={props.products}>
            {(product) => (
              <Row
                id={product.id}
                className={({ isSelected, isFocusVisible }) =>
                  cx('azu-row', isSelected && 'azu-is-selected', isFocusVisible && 'azu-is-focused')
                }
              >
                <Cell className="azu-td">
                  <SelectionCheckbox />
                </Cell>
                <Cell className="azu-td">{product.name}</Cell>
                <Cell className="azu-td">{product.sku}</Cell>
                <Cell className="azu-td">{product.price}</Cell>
                <Cell className="azu-td" data-azu-status={product.status}>
                  {product.status}
                </Cell>
                <Cell className="azu-td">{product.category}</Cell>
              </Row>
            )}
          </TableBody>
        </Table>
      </ResizableTableContainer>
    </div>
  )
}
