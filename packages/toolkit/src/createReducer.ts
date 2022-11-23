import type { Draft } from 'immer'
import createNextState, { isDraft, isDraftable } from 'immer'
import type { AnyAction, Action, Reducer } from 'redux'
import type { ActionReducerMapBuilder } from './mapBuilders'
import { executeReducerBuilderCallback } from './mapBuilders'
import type { NoInfer } from './tsHelpers'
import { freezeDraftable } from './utils'

/**
 * Defines a mapping from action types to corresponding action object shapes.
 *
 * @deprecated This should not be used manually - it is only used for internal
 *             inference purposes and should not have any further value.
 *             It might be removed in the future.
 * @public
 */
export type Actions<T extends keyof any = string> = Record<T, Action>

/**
 * @deprecated use `TypeGuard` instead
 */
export interface ActionMatcher<A extends AnyAction> {
  (action: AnyAction): action is A
}

export type ActionMatcherDescription<S, A extends AnyAction> = {
  matcher: ActionMatcher<A>
  reducer: CaseReducer<S, NoInfer<A>>
}

export type ReadonlyActionMatcherDescriptionCollection<S> = ReadonlyArray<
  ActionMatcherDescription<S, any>
>

export type ActionMatcherDescriptionCollection<S> = Array<
  ActionMatcherDescription<S, any>
>

/**
 * A *case reducer* is a reducer function for a specific action type. Case
 * reducers can be composed to full reducers using `createReducer()`.
 *
 * Unlike a normal Redux reducer, a case reducer is never called with an
 * `undefined` state to determine the initial state. Instead, the initial
 * state is explicitly specified as an argument to `createReducer()`.
 *
 * In addition, a case reducer can choose to mutate the passed-in `state`
 * value directly instead of returning a new state. This does not actually
 * cause the store state to be mutated directly; instead, thanks to
 * [immer](https://github.com/mweststrate/immer), the mutations are
 * translated to copy operations that result in a new state.
 *
 * @public
 */
export type CaseReducer<S = any, A extends Action = AnyAction> = (
  state: Draft<S>,
  action: A
) => S | void | Draft<S>

/**
 * A mapping from action types to case reducers for `createReducer()`.
 *
 * @deprecated This should not be used manually - it is only used
 *             for internal inference purposes and using it manually
 *             would lead to type erasure.
 *             It might be removed in the future.
 * @public
 */
export type CaseReducers<S, AS extends Actions> = {
  [T in keyof AS]: AS[T] extends Action ? CaseReducer<S, AS[T]> : void
}

export type NotFunction<T> = T extends Function ? never : T

function isStateFunction<S>(x: unknown): x is () => S {
  return typeof x === 'function'
}

export type ReducerWithInitialState<S extends NotFunction<any>> = Reducer<S> & {
  getInitialState: () => S
}

let hasWarnedAboutObjectNotation = false

/**
 * A utility function that allows defining a reducer as a mapping from action
 * type to *case reducer* functions that handle these action types. The
 * reducer's initial state is passed as the first argument.
 *
 * @remarks
 * The body of every case reducer is implicitly wrapped with a call to
 * `produce()` from the [immer](https://github.com/mweststrate/immer) library.
 * This means that rather than returning a new state object, you can also
 * mutate the passed-in state object directly; these mutations will then be
 * automatically and efficiently translated into copies, giving you both
 * convenience and immutability.
 *
 * @overloadSummary
 * This overload accepts a callback function that receives a `builder` object as its argument.
 * That builder provides `addCase`, `addMatcher` and `addDefaultCase` functions that may be
 * called to define what actions this reducer will handle.
 *
 * @param initialState - `State | (() => State)`: The initial state that should be used when the reducer is called the first time. This may also be a "lazy initializer" function, which should return an initial state value when called. This will be used whenever the reducer is called with `undefined` as its state value, and is primarily useful for cases like reading initial state from `localStorage`.
 * @param builderCallback - `(builder: Builder) => void` A callback that receives a *builder* object to define
 *   case reducers via calls to `builder.addCase(actionCreatorOrType, reducer)`.
 * @example
```ts
import {
  createAction,
  createReducer,
  AnyAction,
  PayloadAction,
} from "@reduxjs/toolkit";

const increment = createAction<number>("increment");
const decrement = createAction<number>("decrement");

function isActionWithNumberPayload(
  action: AnyAction
): action is PayloadAction<number> {
  return typeof action.payload === "number";
}

const reducer = createReducer(
  {
    counter: 0,
    sumOfNumberPayloads: 0,
    unhandledActions: 0,
  },
  (builder) => {
    builder
      .addCase(increment, (state, action) => {
        // action is inferred correctly here
        state.counter += action.payload;
      })
      // You can chain calls, or have separate `builder.addCase()` lines each time
      .addCase(decrement, (state, action) => {
        state.counter -= action.payload;
      })
      // You can apply a "matcher function" to incoming actions
      .addMatcher(isActionWithNumberPayload, (state, action) => {})
      // and provide a default case if no other handlers matched
      .addDefaultCase((state, action) => {});
  }
);
```
 * @public
 */
export function createReducer<S extends NotFunction<any>>(
  initialState: S | (() => S),
  builderCallback: (builder: ActionReducerMapBuilder<S>) => void
): ReducerWithInitialState<S>

/**
 * A utility function that allows defining a reducer as a mapping from action
 * type to *case reducer* functions that handle these action types. The
 * reducer's initial state is passed as the first argument.
 *
 * The body of every case reducer is implicitly wrapped with a call to
 * `produce()` from the [immer](https://github.com/mweststrate/immer) library.
 * This means that rather than returning a new state object, you can also
 * mutate the passed-in state object directly; these mutations will then be
 * automatically and efficiently translated into copies, giving you both
 * convenience and immutability.
 * 
 * @overloadSummary
 * This overload accepts an object where the keys are string action types, and the values
 * are case reducer functions to handle those action types.
 *
 * @param initialState - `State | (() => State)`: The initial state that should be used when the reducer is called the first time. This may also be a "lazy initializer" function, which should return an initial state value when called. This will be used whenever the reducer is called with `undefined` as its state value, and is primarily useful for cases like reading initial state from `localStorage`.
 * @param actionsMap - An object mapping from action types to _case reducers_, each of which handles one specific action type.
 * @param actionMatchers - An array of matcher definitions in the form `{matcher, reducer}`.
 *   All matching reducers will be executed in order, independently if a case reducer matched or not.
 * @param defaultCaseReducer - A "default case" reducer that is executed if no case reducer and no matcher
 *   reducer was executed for this action.
 *
 * @example
```js
const counterReducer = createReducer(0, {
  increment: (state, action) => state + action.payload,
  decrement: (state, action) => state - action.payload
})

// Alternately, use a "lazy initializer" to provide the initial state
// (works with either form of createReducer)
const initialState = () => 0
const counterReducer = createReducer(initialState, {
  increment: (state, action) => state + action.payload,
  decrement: (state, action) => state - action.payload
})
```
 
 * Action creators that were generated using [`createAction`](./createAction) may be used directly as the keys here, using computed property syntax:

```js
const increment = createAction('increment')
const decrement = createAction('decrement')

const counterReducer = createReducer(0, {
  [increment]: (state, action) => state + action.payload,
  [decrement.type]: (state, action) => state - action.payload
})
```
 * @public
 */
export function createReducer<
  S extends NotFunction<any>,
  CR extends CaseReducers<S, any> = CaseReducers<S, any>
>(
  initialState: S | (() => S),
  actionsMap: CR,
  actionMatchers?: ActionMatcherDescriptionCollection<S>,
  defaultCaseReducer?: CaseReducer<S>
): ReducerWithInitialState<S>

export function createReducer<S extends NotFunction<any>>(
  initialState: S | (() => S),
  mapOrBuilderCallback:
    | CaseReducers<S, any>
    | ((builder: ActionReducerMapBuilder<S>) => void),
  actionMatchers: ReadonlyActionMatcherDescriptionCollection<S> = [],
  defaultCaseReducer?: CaseReducer<S>
): ReducerWithInitialState<S> {
  if (process.env.NODE_ENV !== 'production') {
    if (typeof mapOrBuilderCallback === 'object') {
      if (!hasWarnedAboutObjectNotation) {
        hasWarnedAboutObjectNotation = true
        console.warn(
          "The object notation for `createReducer` is deprecated, and will be removed in RTK 2.0. Please use the 'builder callback' notation instead: https://redux-toolkit.js.org/api/createReducer"
        )
      }
    }
  }

  // { counter/xxx: fn }, [{ matcher, reducer }], default reducer
  let [actionsMap, finalActionMatchers, finalDefaultCaseReducer] =
    typeof mapOrBuilderCallback === 'function'
      ? executeReducerBuilderCallback(mapOrBuilderCallback) // 执行reducer构建者cb // packages/toolkit/src/mapBuilders.ts
      : [mapOrBuilderCallback, actionMatchers, defaultCaseReducer]

  // 确保初始状态以任何方式冻结（如果可草拟）
  // Ensure the initial state gets frozen either way (if draftable)
  let getInitialState: () => S
  if (isStateFunction(initialState)) {
    getInitialState = () => freezeDraftable(initialState())
  } else {
    const frozenInitialState = freezeDraftable(initialState)
    getInitialState = () => frozenInitialState
  }

  // 准备reducer函数
  function reducer(state = getInitialState() /** undefined将会执行getInitialState函数得到返回的状态值 +++ */, action: any): S {
    let caseReducers = [
      actionsMap[action.type], // 取出{ counter/xxx: fn }中对应的函数

      // 过滤出[{ matcher, reducer }]中相匹配的reducer函数
      ...finalActionMatchers
        .filter(({ matcher }) => matcher(action))
        .map(({ reducer }) => reducer),
    ]

    // 若上述结果为空则采取default reducer
    if (caseReducers.filter((cr) => !!cr).length === 0) {
      caseReducers = [finalDefaultCaseReducer]
    }

    // 直接对数组进行reduce函数的执行
    // console.log([].reduce(() => {}, 223)) // 223
    // 对【空数组】进行reduce 且 【有初始值参数】则直接返回这个初始值

    /* 
    console.log([].reduce(() => {}))
    // 报错

    Uncaught TypeError: Reduce of empty array with no initial value
      at Array.reduce (<anonymous>)
      at <anonymous>:1:16
    (anonymous) @ VM202:1
    */
    return caseReducers.reduce((previousState, caseReducer): S => { // 前一个状态, reducer

      // 是否有reducer函数
      if (caseReducer) {
        if (isDraft(previousState)) {
          // 如果它已经是一个草稿，我们必须已经在createNextState调用中，可能是因为它被包装在createReducer, createSlice中，或嵌套在现有的草稿中。把草稿交给mutator就安全了。
          // If it's already a draft, we must already be inside a `createNextState` call,
          // likely because this is being wrapped in `createReducer`, `createSlice`, or nested
          // inside an existing draft. It's safe to just pass the draft to the mutator.
          const draft = previousState as Draft<S> // We can assume this is already a draft
          const result = caseReducer(draft, action) // 执行caseReducer函数

          if (result === undefined) {
            return previousState
          }

          // 返回结果
          return result as S
        } else if (!isDraftable(previousState)) {
          // 如果状态不是可起草的（例如：一个原始值，比如0），我们想要直接返回 caseReducer func 执行的结果，而不用 produce 包装它。
          // If state is not draftable (ex: a primitive, such as 0), we want to directly
          // return the caseReducer func and not wrap it with produce.
          const result = caseReducer(previousState as any, action) // 执行的结果 // +++
          // 0 -> 1 -> 2

          // x
          if (result === undefined) { // +++
            if (previousState === null) {
              return previousState
            }
            // +++
            throw Error(
              'A case reducer on a non-draftable value must not return undefined'
            )
          }

          // 返回这个结果 // +++
          return result as S // +++
        } else {
          // @ts-ignore createNextState() produces an Immutable<Draft<S>> rather
          // than an Immutable<S>, and TypeScript cannot find out how to reconcile
          // these two types.
          return createNextState(previousState, (draft: Draft<S>) => { // immer下的produce函数 // +++
            // 到这里draft其实就是一个Proxy实例对象
            return caseReducer(draft, action) // 直接使用reducer函数进行修改操作 // +++
          })
        }
      }

      // 没有reducer函数则直接返回上一个状态
      return previousState
    }, state) // 状态
  }

  // 挂载【获取初始化状态】函数
  reducer.getInitialState = getInitialState

  // 返回函数
  return reducer as ReducerWithInitialState<S>
}
