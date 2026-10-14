/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  azu: {
    dashboard: typeof routes['azu.dashboard']
    resources: {
      index: typeof routes['azu.resources.index']
      create: typeof routes['azu.resources.create']
      store: typeof routes['azu.resources.store']
      fields: {
        options: typeof routes['azu.resources.fields.options']
      }
      show: typeof routes['azu.resources.show']
      edit: typeof routes['azu.resources.edit']
      update: typeof routes['azu.resources.update']
    }
  }
  home: typeof routes['home']
  newAccount: {
    create: typeof routes['new_account.create']
    store: typeof routes['new_account.store']
  }
  session: {
    create: typeof routes['session.create']
    store: typeof routes['session.store']
    destroy: typeof routes['session.destroy']
  }
  dashboard: typeof routes['dashboard']
}
