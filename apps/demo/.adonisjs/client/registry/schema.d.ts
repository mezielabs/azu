/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'drive.fs.serve': {
    methods: ["GET","HEAD"]
    pattern: '/uploads/*'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { '*': ParamValue[] }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'azu.dashboard': {
    methods: ["GET","HEAD"]
    pattern: '/admin'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'azu.resources.index': {
    methods: ["GET","HEAD"]
    pattern: '/admin/resources/:resource'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { resource: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'azu.resources.create': {
    methods: ["GET","HEAD"]
    pattern: '/admin/resources/:resource/create'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { resource: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'azu.resources.store': {
    methods: ["POST"]
    pattern: '/admin/resources/:resource/create'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { resource: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'azu.resources.actions.run': {
    methods: ["POST"]
    pattern: '/admin/resources/:resource/actions/:kind/:action'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue, ParamValue]
      params: { resource: ParamValue; kind: ParamValue; action: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'azu.resources.fields.options': {
    methods: ["GET","HEAD"]
    pattern: '/admin/resources/:resource/fields/:field/options'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { resource: ParamValue; field: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'azu.resources.filters.options': {
    methods: ["GET","HEAD"]
    pattern: '/admin/resources/:resource/filters/:filter/options'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { resource: ParamValue; filter: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'azu.resources.show': {
    methods: ["GET","HEAD"]
    pattern: '/admin/resources/:resource/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { resource: ParamValue; id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'azu.resources.edit': {
    methods: ["GET","HEAD"]
    pattern: '/admin/resources/:resource/:id/edit'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { resource: ParamValue; id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'azu.resources.update': {
    methods: ["PUT"]
    pattern: '/admin/resources/:resource/:id/edit'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { resource: ParamValue; id: ParamValue }
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'home': {
    methods: ["GET","HEAD"]
    pattern: '/'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'new_account.create': {
    methods: ["GET","HEAD"]
    pattern: '/signup'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['create']>>>
    }
  }
  'new_account.store': {
    methods: ["POST"]
    pattern: '/signup'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').signupValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').signupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'session.create': {
    methods: ["GET","HEAD"]
    pattern: '/login'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
    }
  }
  'session.store': {
    methods: ["POST"]
    pattern: '/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'dashboard': {
    methods: ["GET","HEAD"]
    pattern: '/dashboard'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: unknown
      errorResponse: unknown
    }
  }
  'session.destroy': {
    methods: ["POST"]
    pattern: '/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
    }
  }
}
