import createNextState, { isDraftable } from 'immer'
import type { Middleware } from 'redux'

export function getTimeMeasureUtils(maxDelay: number, fnName: string) {
  let elapsed = 0
  return {
    measureTime<T>(fn: () => T): T {
      const started = Date.now()
      try {
        return fn()
      } finally {
        const finished = Date.now()
        elapsed += finished - started
      }
    },
    warnIfExceeded() {
      if (elapsed > maxDelay) {
        console.warn(`${fnName} took ${elapsed}ms, which is more than the warning threshold of ${maxDelay}ms. 
If your state or actions are very large, you may want to disable the middleware as it might cause too much of a slowdown in development mode. See https://redux-toolkit.js.org/api/getDefaultMiddleware for instructions.
It is disabled in production builds, so you don't need to worry about that.`)
      }
    },
  }
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * @public
 */
export class MiddlewareArray<
  Middlewares extends Middleware<any, any>[]
> extends Array<Middlewares[number]> {
  constructor(...items: Middlewares)
  constructor(...args: any[]) {
    super(...args)
    Object.setPrototypeOf(this, MiddlewareArray.prototype)
  }

  static get [Symbol.species]() {
    return MiddlewareArray as any
  }

  concat<AdditionalMiddlewares extends ReadonlyArray<Middleware<any, any>>>(
    items: AdditionalMiddlewares
  ): MiddlewareArray<[...Middlewares, ...AdditionalMiddlewares]>

  concat<AdditionalMiddlewares extends ReadonlyArray<Middleware<any, any>>>(
    ...items: AdditionalMiddlewares
  ): MiddlewareArray<[...Middlewares, ...AdditionalMiddlewares]>
  concat(...arr: any[]) {
    return super.concat.apply(this, arr)
  }

  prepend<AdditionalMiddlewares extends ReadonlyArray<Middleware<any, any>>>(
    items: AdditionalMiddlewares
  ): MiddlewareArray<[...AdditionalMiddlewares, ...Middlewares]>

  prepend<AdditionalMiddlewares extends ReadonlyArray<Middleware<any, any>>>(
    ...items: AdditionalMiddlewares
  ): MiddlewareArray<[...AdditionalMiddlewares, ...Middlewares]>

  prepend(...arr: any[]) {
    if (arr.length === 1 && Array.isArray(arr[0])) {
      return new MiddlewareArray(...arr[0].concat(this))
    }
    return new MiddlewareArray(...arr.concat(this))
  }
}

// 可起草的（打草稿）冻结
export function freezeDraftable<T>(val: T) {
  // 是否为可起草的
  return isDraftable(val) ? createNextState(val, () => {}) : val
  // createNextState -> immer下的produce函数

  // produce第二个参数函数是一个空函数代表不会进行修改，那么produce函数执行返回的结果依然是这个val但是它内部将对val进行深度freeze（冻结）
  // https://github.com/immerjs/immer/blob/v9.0.16/src/utils/common.ts
  // /**
  //  * Freezes draftable objects. Returns the original object.
  //  * By default freezes shallowly, but if the second argument is `true` it will freeze recursively.
  //  *
  //  * @param obj
  //  * @param deep
  //  */
  // export function freeze<T>(obj: T, deep?: boolean): T
  // export function freeze<T>(obj: any, deep: boolean = false): T {
  //   if (isFrozen(obj) || isDraft(obj) || !isDraftable(obj)) return obj
  //   if (getArchtype(obj) > 1 /* Map or Set */) {
  //     obj.set = obj.add = obj.clear = obj.delete = dontMutateFrozenCollections as any
  //   }
  //   Object.freeze(obj)
  //   if (deep) each(obj, (key, value) => freeze(value, true), true)
  //   return obj
  // }
  
  // function dontMutateFrozenCollections() {
  //   die(2)
  // }
  
  // export function isFrozen(obj: any): boolean {
  //   if (obj == null || typeof obj !== "object") return true
  //   // See #600, IE dies on non-objects in Object.isFrozen
  //   return Object.isFrozen(obj)
  // }
}

// 可以想到react中dispatchSetState函数中使用Object.is算法所带来的问题
// 比如对一个对象属性进行修改之后再返回这个对象，你会发现react并没有进行更新
// 原因就是is算法在判断新旧引用时是一样的，那么代表没有变化则不会进行更新

// 解决方式就是使用下面的方法 // +++

/* 
https://immerjs.github.io/immer/#a-quick-example-for-comparison

const baseState = [
  {
    title: "Learn TypeScript",
    done: true
  },
  {
    title: "Try Immer",
    done: false
  }
]

Without Immer

const nextState = baseState.slice() // shallow clone the array
nextState[1] = {
  // replace element 1...
  ...nextState[1], // with a shallow clone of element 1
  done: true // ...combined with the desired update
}
// since nextState was freshly cloned, using push is safe here,
// but doing the same thing at any arbitrary time in the future would
// violate the immutability principles and introduce a bug!
nextState.push({title: "Tweet about it"})

With Immer

import produce from "immer"

const nextState = produce(baseState, draft => { // draft是一个Proxy实例
  draft[1].done = true
  draft.push({title: "Tweet about it"})
})

*/

// https://immerjs.github.io/immer/
// https://github.com/immerjs/immer/blob/v9.0.16/src/utils/common.ts

// /** Returns true if the given value is an Immer draft */
// /*#__PURE__*/
// export function isDraft(value: any): boolean {
// 	return !!value && !!value[DRAFT_STATE]
// }

// /** Returns true if the given value can be drafted by Immer */
// /*#__PURE__*/
// export function isDraftable(value: any): boolean {
// 	if (!value) return false
// 	return (
// 		isPlainObject(value) ||
// 		Array.isArray(value) ||
// 		!!value[DRAFTABLE] ||
// 		!!value.constructor?.[DRAFTABLE] ||
// 		isMap(value) ||
// 		isSet(value)
// 	)
// }

// https://github.com/immerjs/immer/blob/v9.0.16/src/utils/env.ts

// // Should be no imports here!

// // Some things that should be evaluated before all else...

// // We only want to know if non-polyfilled symbols are available
// const hasSymbol =
// 	typeof Symbol !== "undefined" && typeof Symbol("x") === "symbol"
// export const hasMap = typeof Map !== "undefined"
// export const hasSet = typeof Set !== "undefined"
// export const hasProxies =
// 	typeof Proxy !== "undefined" &&
// 	typeof Proxy.revocable !== "undefined" &&
// 	typeof Reflect !== "undefined"

// /**
//  * To let Immer treat your class instances as plain immutable objects
//  * (albeit with a custom prototype), you must define either an instance property
//  * or a static property on each of your custom classes.
//  *
//  * Otherwise, your class instance will never be drafted, which means it won't be
//  * safe to mutate in a produce callback.
//  */
//  export const DRAFTABLE: unique symbol = hasSymbol
//  ? Symbol.for("immer-draftable")
//  : ("__$immer_draftable" as any)

// export const DRAFT_STATE: unique symbol = hasSymbol
//  ? Symbol.for("immer-state")
//  : ("__$immer_state" as any)

