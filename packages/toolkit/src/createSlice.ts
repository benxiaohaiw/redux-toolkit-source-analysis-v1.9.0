import type { AnyAction, Reducer } from 'redux'
import { createNextState } from '.'
import type {
  ActionCreatorWithoutPayload,
  PayloadAction,
  PayloadActionCreator,
  PrepareAction,
  _ActionCreatorWithPreparedPayload,
} from './createAction'
import { createAction } from './createAction'
import type {
  CaseReducer,
  CaseReducers,
  ReducerWithInitialState,
} from './createReducer'
import { createReducer, NotFunction } from './createReducer'
import type { ActionReducerMapBuilder } from './mapBuilders'
import { executeReducerBuilderCallback } from './mapBuilders'
import type { NoInfer } from './tsHelpers'
import { freezeDraftable } from './utils'

let hasWarnedAboutObjectNotation = false

/**
 * An action creator attached to a slice.
 *
 * @deprecated please use PayloadActionCreator directly
 *
 * @public
 */
export type SliceActionCreator<P> = PayloadActionCreator<P>

/**
 * The return value of `createSlice`
 *
 * @public
 */
export interface Slice<
  State = any,
  CaseReducers extends SliceCaseReducers<State> = SliceCaseReducers<State>,
  Name extends string = string
> {
  /**
   * The slice name.
   */
  name: Name

  /**
   * The slice's reducer.
   */
  reducer: Reducer<State>

  /**
   * Action creators for the types of actions that are handled by the slice
   * reducer.
   */
  actions: CaseReducerActions<CaseReducers, Name>

  /**
   * The individual case reducer functions that were passed in the `reducers` parameter.
   * This enables reuse and testing if they were defined inline when calling `createSlice`.
   */
  caseReducers: SliceDefinedCaseReducers<CaseReducers>

  /**
   * Provides access to the initial state value given to the slice.
   * If a lazy state initializer was provided, it will be called and a fresh value returned.
   */
  getInitialState: () => State
}

/**
 * Options for `createSlice()`.
 *
 * @public
 */
export interface CreateSliceOptions<
  State = any,
  CR extends SliceCaseReducers<State> = SliceCaseReducers<State>,
  Name extends string = string
> {
  /**
   * The slice's name. Used to namespace the generated action types.
   */
  name: Name

  /**
   * The initial state that should be used when the reducer is called the first time. This may also be a "lazy initializer" function, which should return an initial state value when called. This will be used whenever the reducer is called with `undefined` as its state value, and is primarily useful for cases like reading initial state from `localStorage`.
   */
  initialState: State | (() => State)

  /**
   * A mapping from action types to action-type-specific *case reducer*
   * functions. For every action type, a matching action creator will be
   * generated using `createAction()`.
   */
  reducers: ValidateSliceCaseReducers<State, CR>

  /**
   * A callback that receives a *builder* object to define
   * case reducers via calls to `builder.addCase(actionCreatorOrType, reducer)`.
   * 
   * Alternatively, a mapping from action types to action-type-specific *case reducer*
   * functions. These reducers should have existing action types used
   * as the keys, and action creators will _not_ be generated.
   * 
   * @example
```ts
import { createAction, createSlice, Action, AnyAction } from '@reduxjs/toolkit'
const incrementBy = createAction<number>('incrementBy')
const decrement = createAction('decrement')

interface RejectedAction extends Action {
  error: Error
}

function isRejectedAction(action: AnyAction): action is RejectedAction {
  return action.type.endsWith('rejected')
}

createSlice({
  name: 'counter',
  initialState: 0,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(incrementBy, (state, action) => {
        // action is inferred correctly here if using TS
      })
      // You can chain calls, or have separate `builder.addCase()` lines each time
      .addCase(decrement, (state, action) => {})
      // You can match a range of action types
      .addMatcher(
        isRejectedAction,
        // `action` will be inferred as a RejectedAction due to isRejectedAction being defined as a type guard
        (state, action) => {}
      )
      // and provide a default case if no other handlers matched
      .addDefaultCase((state, action) => {})
    }
})
```
   */
  extraReducers?:
    | CaseReducers<NoInfer<State>, any>
    | ((builder: ActionReducerMapBuilder<NoInfer<State>>) => void)
}

/**
 * A CaseReducer with a `prepare` method.
 *
 * @public
 */
export type CaseReducerWithPrepare<State, Action extends PayloadAction> = {
  reducer: CaseReducer<State, Action>
  prepare: PrepareAction<Action['payload']>
}

/**
 * The type describing a slice's `reducers` option.
 *
 * @public
 */
export type SliceCaseReducers<State> = {
  [K: string]:
    | CaseReducer<State, PayloadAction<any>>
    | CaseReducerWithPrepare<State, PayloadAction<any, string, any, any>>
}

type SliceActionType<
  SliceName extends string,
  ActionName extends keyof any
> = ActionName extends string | number ? `${SliceName}/${ActionName}` : string

/**
 * Derives the slice's `actions` property from the `reducers` options
 *
 * @public
 */
export type CaseReducerActions<
  CaseReducers extends SliceCaseReducers<any>,
  SliceName extends string
> = {
  [Type in keyof CaseReducers]: CaseReducers[Type] extends { prepare: any }
    ? ActionCreatorForCaseReducerWithPrepare<
        CaseReducers[Type],
        SliceActionType<SliceName, Type>
      >
    : ActionCreatorForCaseReducer<
        CaseReducers[Type],
        SliceActionType<SliceName, Type>
      >
}

/**
 * Get a `PayloadActionCreator` type for a passed `CaseReducerWithPrepare`
 *
 * @internal
 */
type ActionCreatorForCaseReducerWithPrepare<
  CR extends { prepare: any },
  Type extends string
> = _ActionCreatorWithPreparedPayload<CR['prepare'], Type>

/**
 * Get a `PayloadActionCreator` type for a passed `CaseReducer`
 *
 * @internal
 */
type ActionCreatorForCaseReducer<CR, Type extends string> = CR extends (
  state: any,
  action: infer Action
) => any
  ? Action extends { payload: infer P }
    ? PayloadActionCreator<P, Type>
    : ActionCreatorWithoutPayload<Type>
  : ActionCreatorWithoutPayload<Type>

/**
 * Extracts the CaseReducers out of a `reducers` object, even if they are
 * tested into a `CaseReducerWithPrepare`.
 *
 * @internal
 */
type SliceDefinedCaseReducers<CaseReducers extends SliceCaseReducers<any>> = {
  [Type in keyof CaseReducers]: CaseReducers[Type] extends {
    reducer: infer Reducer
  }
    ? Reducer
    : CaseReducers[Type]
}

/**
 * Used on a SliceCaseReducers object.
 * Ensures that if a CaseReducer is a `CaseReducerWithPrepare`, that
 * the `reducer` and the `prepare` function use the same type of `payload`.
 *
 * Might do additional such checks in the future.
 *
 * This type is only ever useful if you want to write your own wrapper around
 * `createSlice`. Please don't use it otherwise!
 *
 * @public
 */
export type ValidateSliceCaseReducers<
  S,
  ACR extends SliceCaseReducers<S>
> = ACR &
  {
    [T in keyof ACR]: ACR[T] extends {
      reducer(s: S, action?: infer A): any
    }
      ? {
          prepare(...a: never[]): Omit<A, 'type'>
        }
      : {}
  }

// 获取类型
function getType(slice: string, actionKey: string): string {
  return `${slice}/${actionKey}` // 返回这种格式的字符串
}

/**
 * A function that accepts an initial state, an object full of reducer
 * functions, and a "slice name", and automatically generates
 * action creators and action types that correspond to the
 * reducers and state.
 *
 * The `reducer` argument is passed to `createReducer()`.
 *
 * @public
 */
export function createSlice<
  State,
  CaseReducers extends SliceCaseReducers<State>,
  Name extends string = string
>(
  options: CreateSliceOptions<State, CaseReducers, Name>
): Slice<State, CaseReducers, Name> {
  const { name } = options
  if (!name) {
    throw new Error('`name` is a required option for createSlice')
  }

  if (
    typeof process !== 'undefined' &&
    process.env.NODE_ENV === 'development'
  ) {
    if (options.initialState === undefined) {
      console.error(
        'You must provide an `initialState` value that is not `undefined`. You may have misspelled `initialState`'
      )
    }
  }

  /* 
  options
  {
    name
    initialState
    reducers
    extraReducers
  }
  */

  // initialState参数支持函数
  const initialState =
    typeof options.initialState == 'function'
      ? options.initialState
      : freezeDraftable(options.initialState) // 可起草的（打草稿）冻结
  /* 
  ./utils.ts下的freezeDraftable函数主要就是使用immer下的produce函数对数组、对象进行深度冻结（Object.freeze）
  */

  const reducers = options.reducers || {}

  // 取出reducers对象的所有key
  const reducerNames = Object.keys(reducers)

  /* 
  options: {
    name: 'counter'
    reducers: {
      decrement() {
        // ...
      }
    }
  }
  */

  // { decrement=>fn }
  const sliceCaseReducersByName: Record<string, CaseReducer> = {}

  // { counter/decrement=>fn }
  const sliceCaseReducersByType: Record<string, CaseReducer> = {}

  // { decrement=>actionCreator函数（在createAction函数中形成闭包） }
  const actionCreators: Record<string, Function> = {}

  reducerNames.forEach((reducerName) => {
    // 可能是带有prepare的reducer
    const maybeReducerWithPrepare = reducers[reducerName]

    // 获取类型 -> counter/decrement
    const type = getType(name, reducerName)

    let caseReducer: CaseReducer<State, any>
    let prepareCallback: PrepareAction<any> | undefined

    // { reducer, prepare }
    if ('reducer' in maybeReducerWithPrepare) {
      caseReducer = maybeReducerWithPrepare.reducer
      prepareCallback = maybeReducerWithPrepare.prepare
    } else {
      // 直接就是一个函数
      caseReducer = maybeReducerWithPrepare
    }

    sliceCaseReducersByName[reducerName] = caseReducer
    sliceCaseReducersByType[type] = caseReducer
    actionCreators[reducerName] = prepareCallback
      ? createAction(type, prepareCallback)
      : createAction(type)
  })

  // 准备构建reducer函数
  function buildReducer() {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof options.extraReducers === 'object') {
        if (!hasWarnedAboutObjectNotation) {
          hasWarnedAboutObjectNotation = true
          console.warn(
            "The object notation for `createSlice.extraReducers` is deprecated, and will be removed in RTK 2.0. Please use the 'builder callback' notation instead: https://redux-toolkit.js.org/api/createSlice"
          )
        }
      }
    }

    // options中是否有extraReducers函数

    // extra: 额外的 // +++
    
    const [
      extraReducers = {}, // 我想它应该也是{ counter/xxx: fn } - 见下一个行代码所理解
      actionMatchers = [], // [{ matcher, reducer }]
      defaultCaseReducer = undefined, // default reducer
    ] =
      typeof options.extraReducers === 'function'
        ? executeReducerBuilderCallback(options.extraReducers) // 执行reducer构建者cb // packages/toolkit/src/mapBuilders.ts
        : [options.extraReducers]

    // 最终
    const finalCaseReducers = { ...extraReducers, ...sliceCaseReducersByType }

    // 创建reducer // +++
    return createReducer(initialState, (builder) => { // 返回一个reducer函数
      // 遍历最终{ counter/xxx: fn }
      for (let key in finalCaseReducers) {
        builder.addCase(key, finalCaseReducers[key] as CaseReducer<any>)
      }
      // 遍历[{ matcher, reducer }]
      for (let m of actionMatchers) {
        builder.addMatcher(m.matcher, m.reducer)
      }
      // default reducer
      if (defaultCaseReducer) {
        builder.addDefaultCase(defaultCaseReducer)
      }
    })
  }

  // 准备标记
  let _reducer: ReducerWithInitialState<State>

  // 返回一个对象 // +++
  return {
    name,

    // reducer函数
    reducer(state, action) {
      if (!_reducer) _reducer = buildReducer() // 执行buildReducer函数

      return _reducer(state, action) // 执行_reducer函数
    },

    actions: actionCreators as any, // { decrement=>actionCreator函数（在createAction函数中形成闭包） }
    
    caseReducers: sliceCaseReducersByName as any, // { decrement=>fn }

    // 获取初始化状态
    getInitialState() {
      if (!_reducer) _reducer = buildReducer() // 执行buildReducer函数

      return _reducer.getInitialState() // 通过它获取 // +++
    },
  }
}
