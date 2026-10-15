/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'drive.fs.serve': {
    methods: ["GET","HEAD"],
    pattern: '/uploads/*',
    tokens: [{"old":"/uploads/*","type":0,"val":"uploads","end":""},{"old":"/uploads/*","type":2,"val":"*","end":""}],
    types: placeholder as Registry['drive.fs.serve']['types'],
  },
  'azu.dashboard': {
    methods: ["GET","HEAD"],
    pattern: '/admin',
    tokens: [{"old":"/admin","type":0,"val":"admin","end":""}],
    types: placeholder as Registry['azu.dashboard']['types'],
  },
  'azu.resources.index': {
    methods: ["GET","HEAD"],
    pattern: '/admin/resources/:resource',
    tokens: [{"old":"/admin/resources/:resource","type":0,"val":"admin","end":""},{"old":"/admin/resources/:resource","type":0,"val":"resources","end":""},{"old":"/admin/resources/:resource","type":1,"val":"resource","end":""}],
    types: placeholder as Registry['azu.resources.index']['types'],
  },
  'azu.resources.create': {
    methods: ["GET","HEAD"],
    pattern: '/admin/resources/:resource/create',
    tokens: [{"old":"/admin/resources/:resource/create","type":0,"val":"admin","end":""},{"old":"/admin/resources/:resource/create","type":0,"val":"resources","end":""},{"old":"/admin/resources/:resource/create","type":1,"val":"resource","end":""},{"old":"/admin/resources/:resource/create","type":0,"val":"create","end":""}],
    types: placeholder as Registry['azu.resources.create']['types'],
  },
  'azu.resources.store': {
    methods: ["POST"],
    pattern: '/admin/resources/:resource/create',
    tokens: [{"old":"/admin/resources/:resource/create","type":0,"val":"admin","end":""},{"old":"/admin/resources/:resource/create","type":0,"val":"resources","end":""},{"old":"/admin/resources/:resource/create","type":1,"val":"resource","end":""},{"old":"/admin/resources/:resource/create","type":0,"val":"create","end":""}],
    types: placeholder as Registry['azu.resources.store']['types'],
  },
  'azu.resources.actions.run': {
    methods: ["POST"],
    pattern: '/admin/resources/:resource/actions/:kind/:action',
    tokens: [{"old":"/admin/resources/:resource/actions/:kind/:action","type":0,"val":"admin","end":""},{"old":"/admin/resources/:resource/actions/:kind/:action","type":0,"val":"resources","end":""},{"old":"/admin/resources/:resource/actions/:kind/:action","type":1,"val":"resource","end":""},{"old":"/admin/resources/:resource/actions/:kind/:action","type":0,"val":"actions","end":""},{"old":"/admin/resources/:resource/actions/:kind/:action","type":1,"val":"kind","end":""},{"old":"/admin/resources/:resource/actions/:kind/:action","type":1,"val":"action","end":""}],
    types: placeholder as Registry['azu.resources.actions.run']['types'],
  },
  'azu.resources.fields.options': {
    methods: ["GET","HEAD"],
    pattern: '/admin/resources/:resource/fields/:field/options',
    tokens: [{"old":"/admin/resources/:resource/fields/:field/options","type":0,"val":"admin","end":""},{"old":"/admin/resources/:resource/fields/:field/options","type":0,"val":"resources","end":""},{"old":"/admin/resources/:resource/fields/:field/options","type":1,"val":"resource","end":""},{"old":"/admin/resources/:resource/fields/:field/options","type":0,"val":"fields","end":""},{"old":"/admin/resources/:resource/fields/:field/options","type":1,"val":"field","end":""},{"old":"/admin/resources/:resource/fields/:field/options","type":0,"val":"options","end":""}],
    types: placeholder as Registry['azu.resources.fields.options']['types'],
  },
  'azu.resources.filters.options': {
    methods: ["GET","HEAD"],
    pattern: '/admin/resources/:resource/filters/:filter/options',
    tokens: [{"old":"/admin/resources/:resource/filters/:filter/options","type":0,"val":"admin","end":""},{"old":"/admin/resources/:resource/filters/:filter/options","type":0,"val":"resources","end":""},{"old":"/admin/resources/:resource/filters/:filter/options","type":1,"val":"resource","end":""},{"old":"/admin/resources/:resource/filters/:filter/options","type":0,"val":"filters","end":""},{"old":"/admin/resources/:resource/filters/:filter/options","type":1,"val":"filter","end":""},{"old":"/admin/resources/:resource/filters/:filter/options","type":0,"val":"options","end":""}],
    types: placeholder as Registry['azu.resources.filters.options']['types'],
  },
  'azu.resources.show': {
    methods: ["GET","HEAD"],
    pattern: '/admin/resources/:resource/:id',
    tokens: [{"old":"/admin/resources/:resource/:id","type":0,"val":"admin","end":""},{"old":"/admin/resources/:resource/:id","type":0,"val":"resources","end":""},{"old":"/admin/resources/:resource/:id","type":1,"val":"resource","end":""},{"old":"/admin/resources/:resource/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['azu.resources.show']['types'],
  },
  'azu.resources.edit': {
    methods: ["GET","HEAD"],
    pattern: '/admin/resources/:resource/:id/edit',
    tokens: [{"old":"/admin/resources/:resource/:id/edit","type":0,"val":"admin","end":""},{"old":"/admin/resources/:resource/:id/edit","type":0,"val":"resources","end":""},{"old":"/admin/resources/:resource/:id/edit","type":1,"val":"resource","end":""},{"old":"/admin/resources/:resource/:id/edit","type":1,"val":"id","end":""},{"old":"/admin/resources/:resource/:id/edit","type":0,"val":"edit","end":""}],
    types: placeholder as Registry['azu.resources.edit']['types'],
  },
  'azu.resources.update': {
    methods: ["PUT"],
    pattern: '/admin/resources/:resource/:id/edit',
    tokens: [{"old":"/admin/resources/:resource/:id/edit","type":0,"val":"admin","end":""},{"old":"/admin/resources/:resource/:id/edit","type":0,"val":"resources","end":""},{"old":"/admin/resources/:resource/:id/edit","type":1,"val":"resource","end":""},{"old":"/admin/resources/:resource/:id/edit","type":1,"val":"id","end":""},{"old":"/admin/resources/:resource/:id/edit","type":0,"val":"edit","end":""}],
    types: placeholder as Registry['azu.resources.update']['types'],
  },
  'home': {
    methods: ["GET","HEAD"],
    pattern: '/',
    tokens: [{"old":"/","type":0,"val":"/","end":""}],
    types: placeholder as Registry['home']['types'],
  },
  'new_account.create': {
    methods: ["GET","HEAD"],
    pattern: '/signup',
    tokens: [{"old":"/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['new_account.create']['types'],
  },
  'new_account.store': {
    methods: ["POST"],
    pattern: '/signup',
    tokens: [{"old":"/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['new_account.store']['types'],
  },
  'session.create': {
    methods: ["GET","HEAD"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.create']['types'],
  },
  'session.store': {
    methods: ["POST"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.store']['types'],
  },
  'dashboard': {
    methods: ["GET","HEAD"],
    pattern: '/dashboard',
    tokens: [{"old":"/dashboard","type":0,"val":"dashboard","end":""}],
    types: placeholder as Registry['dashboard']['types'],
  },
  'session.destroy': {
    methods: ["POST"],
    pattern: '/logout',
    tokens: [{"old":"/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['session.destroy']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
