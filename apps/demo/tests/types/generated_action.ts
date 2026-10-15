import { action } from '@mezielabs/azu'

/**
 * Mark as paid: a row action. Add it to a resource's `actions`;
 * tsc checks that the resource's policy has a `markAsPaid` method,
 * which Azu calls with the user and each record.
 */
export default action
  .row('markAsPaid')
  .confirm('Mark as paid?')
  .ability('markAsPaid')
  .handle(async (record, { trx }) => {
    // Change the record here. The handler runs in a transaction: run
    // every query through `trx` (`Model.query({ client: trx })`), so a
    // thrown error rolls back everything the action did.
    await record.useTransaction(trx).save()
    return { message: 'Mark as paid: done' }
  })
