import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'azu.dashboard': { paramsTuple?: []; params?: {} }
    'azu.resources.index': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'azu.resources.create': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'azu.resources.store': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'azu.resources.actions.run': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'resource': ParamValue,'kind': ParamValue,'action': ParamValue} }
    'azu.resources.fields.options': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'field': ParamValue} }
    'azu.resources.filters.options': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'filter': ParamValue} }
    'azu.resources.show': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'azu.resources.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'azu.resources.update': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'azu.logout': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'azu.dashboard': { paramsTuple?: []; params?: {} }
    'azu.resources.index': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'azu.resources.create': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'azu.resources.fields.options': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'field': ParamValue} }
    'azu.resources.filters.options': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'filter': ParamValue} }
    'azu.resources.show': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'azu.resources.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'azu.dashboard': { paramsTuple?: []; params?: {} }
    'azu.resources.index': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'azu.resources.create': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'azu.resources.fields.options': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'field': ParamValue} }
    'azu.resources.filters.options': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'filter': ParamValue} }
    'azu.resources.show': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'azu.resources.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'azu.resources.store': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'azu.resources.actions.run': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'resource': ParamValue,'kind': ParamValue,'action': ParamValue} }
    'azu.logout': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
  }
  PUT: {
    'azu.resources.update': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}