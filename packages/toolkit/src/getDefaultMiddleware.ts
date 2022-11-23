import type { Middleware, AnyAction } from 'redux'
import type { ThunkMiddleware } from 'redux-thunk'
import thunkMiddleware from 'redux-thunk'
import type { ImmutableStateInvariantMiddlewareOptions } from './immutableStateInvariantMiddleware'
/* PROD_START_REMOVE_UMD */
import { createImmutableStateInvariantMiddleware } from './immutableStateInvariantMiddleware'
/* PROD_STOP_REMOVE_UMD */

import type { SerializableStateInvariantMiddlewareOptions } from './serializableStateInvariantMiddleware'
import { createSerializableStateInvariantMiddleware } from './serializableStateInvariantMiddleware'
import type { ExcludeFromTuple } from './tsHelpers'
import { MiddlewareArray } from './utils'

function isBoolean(x: any): x is boolean {
  return typeof x === 'boolean'
}

interface ThunkOptions<E = any> {
  extraArgument: E
}

interface GetDefaultMiddlewareOptions {
  thunk?: boolean | ThunkOptions
  immutableCheck?: boolean | ImmutableStateInvariantMiddlewareOptions
  serializableCheck?: boolean | SerializableStateInvariantMiddlewareOptions
}

export type ThunkMiddlewareFor<
  S,
  O extends GetDefaultMiddlewareOptions = {}
> = O extends {
  thunk: false
}
  ? never
  : O extends { thunk: { extraArgument: infer E } }
  ? ThunkMiddleware<S, AnyAction, E>
  : ThunkMiddleware<S, AnyAction>

export type CurriedGetDefaultMiddleware<S = any> = <
  O extends Partial<GetDefaultMiddlewareOptions> = {
    thunk: true
    immutableCheck: true
    serializableCheck: true
  }
>(
  options?: O
) => MiddlewareArray<ExcludeFromTuple<[ThunkMiddlewareFor<S, O>], never>>

export function curryGetDefaultMiddleware<
  S = any
>(): CurriedGetDefaultMiddleware<S> {
  // 返回函数
  return function curriedGetDefaultMiddleware(options) {
    // 直接执行getDefaultMiddleware函数并返回 // +++
    return getDefaultMiddleware(options)
  }
}

/**
 * Returns any array containing the default middleware installed by
 * `configureStore()`. Useful if you want to configure your store with a custom
 * `middleware` array but still keep the default set.
 *
 * @return The default middleware used by `configureStore()`.
 *
 * @public
 *
 * @deprecated Prefer to use the callback notation for the `middleware` option in `configureStore`
 * to access a pre-typed `getDefaultMiddleware` instead.
 */
export function getDefaultMiddleware<
  S = any,
  O extends Partial<GetDefaultMiddlewareOptions> = {
    thunk: true
    immutableCheck: true
    serializableCheck: true
  }
>(
  options: O = {} as O
): MiddlewareArray<ExcludeFromTuple<[ThunkMiddlewareFor<S, O>], never>> {

  // 参数默认全部是true // +++
  const {
    thunk = true,
    immutableCheck = true,
    serializableCheck = true,
  } = options

  // 创建一个MiddlewareArray实例对象
  let middlewareArray = new MiddlewareArray<Middleware[]>() // 它是继承Array的实际上就是一个数组 // +++

  // 如果开启了thunk
  if (thunk) {
    if (isBoolean(thunk)) { // 是true则直接推入thunkMiddleware函数 // +++
      middlewareArray.push(thunkMiddleware)
    } else {
      // 不是布尔值的话需要通过thunkMiddleware.withExtraArgument处理一下 // +++
      middlewareArray.push(
        thunkMiddleware.withExtraArgument(thunk.extraArgument) // +++
      )
    }
  }

  // +++
  // 开发模式下默认中间件的顺序是immutableCheck thunkMiddleware serializableCheck
  // 而生产模式下默认中间的顺序是thunkMiddleware
  // +++
  if (process.env.NODE_ENV !== 'production') {
    if (immutableCheck) {
      /* PROD_START_REMOVE_UMD */
      let immutableOptions: ImmutableStateInvariantMiddlewareOptions = {}

      if (!isBoolean(immutableCheck)) {
        immutableOptions = immutableCheck
      }

      middlewareArray.unshift(
        createImmutableStateInvariantMiddleware(immutableOptions)
      )
      /* PROD_STOP_REMOVE_UMD */
    }

    if (serializableCheck) {
      let serializableOptions: SerializableStateInvariantMiddlewareOptions = {}

      if (!isBoolean(serializableCheck)) {
        serializableOptions = serializableCheck
      }

      middlewareArray.push(
        createSerializableStateInvariantMiddleware(serializableOptions)
      )
    }
  }

  // 返回 // +++
  return middlewareArray as any
}
