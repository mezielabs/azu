/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  drive: {
    fs: {
      serve: typeof routes['drive.fs.serve']
    }
  }
  azu: {
    dashboard: typeof routes['azu.dashboard']
    resources: {
      index: typeof routes['azu.resources.index']
      create: typeof routes['azu.resources.create']
      store: typeof routes['azu.resources.store']
      actions: {
        run: typeof routes['azu.resources.actions.run']
      }
      fields: {
        options: typeof routes['azu.resources.fields.options']
      }
      filters: {
        options: typeof routes['azu.resources.filters.options']
      }
      show: typeof routes['azu.resources.show']
      edit: typeof routes['azu.resources.edit']
      update: typeof routes['azu.resources.update']
    }
    logout: typeof routes['azu.logout']
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
