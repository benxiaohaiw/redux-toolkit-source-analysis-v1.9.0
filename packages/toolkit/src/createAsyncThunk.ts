import type { Dispatch, AnyAction } from 'redux'
import type {
  PayloadAction,
  ActionCreatorWithPreparedPayload,
} from './createAction'
import { createAction } from './createAction'
import type { ThunkDispatch } from 'redux-thunk'
import type { FallbackIfUnknown, Id, IsAny, IsUnknown } from './tsHelpers'
import { nanoid } from './nanoid'

// @ts-ignore we need the import of these types due to a bundling issue.
type _Keep = PayloadAction | ActionCreatorWithPreparedPayload<any, unknown>

export type BaseThunkAPI<
  S,
  E,
  D extends Dispatch = Dispatch,
  RejectedValue = undefined,
  RejectedMeta = unknown,
  FulfilledMeta = unknown
> = {
  dispatch: D
  getState: () => S
  extra: E
  requestId: string
  signal: AbortSignal
  abort: (reason?: string) => void
  rejectWithValue: IsUnknown<
    RejectedMeta,
    (value: RejectedValue) => RejectWithValue<RejectedValue, RejectedMeta>,
    (
      value: RejectedValue,
      meta: RejectedMeta
    ) => RejectWithValue<RejectedValue, RejectedMeta>
  >
  fulfillWithValue: IsUnknown<
    FulfilledMeta,
    <FulfilledValue>(
      value: FulfilledValue
    ) => FulfillWithMeta<FulfilledValue, FulfilledMeta>,
    <FulfilledValue>(
      value: FulfilledValue,
      meta: FulfilledMeta
    ) => FulfillWithMeta<FulfilledValue, FulfilledMeta>
  >
}

/**
 * @public
 */
export interface SerializedError {
  name?: string
  message?: string
  stack?: string
  code?: string
}

const commonProperties: Array<keyof SerializedError> = [
  'name',
  'message',
  'stack',
  'code',
]

class RejectWithValue<Payload, RejectedMeta> {
  /*
  type-only property to distinguish between RejectWithValue and FulfillWithMeta
  does not exist at runtime
  */
  private readonly _type!: 'RejectWithValue'
  constructor(
    public readonly payload: Payload,
    public readonly meta: RejectedMeta
  ) {}
}

class FulfillWithMeta<Payload, FulfilledMeta> {
  /*
  type-only property to distinguish between RejectWithValue and FulfillWithMeta
  does not exist at runtime
  */
  private readonly _type!: 'FulfillWithMeta'
  constructor(
    public readonly payload: Payload,
    public readonly meta: FulfilledMeta
  ) {}
}

/**
 * Serializes an error into a plain object.
 * Reworked from https://github.com/sindresorhus/serialize-error
 *
 * @public
 */
export const miniSerializeError = (value: any): SerializedError => {
  if (typeof value === 'object' && value !== null) {
    const simpleError: SerializedError = {}
    for (const property of commonProperties) {
      if (typeof value[property] === 'string') {
        simpleError[property] = value[property]
      }
    }

    return simpleError
  }

  return { message: String(value) }
}

type AsyncThunkConfig = {
  state?: unknown
  dispatch?: Dispatch
  extra?: unknown
  rejectValue?: unknown
  serializedErrorType?: unknown
  pendingMeta?: unknown
  fulfilledMeta?: unknown
  rejectedMeta?: unknown
}

type GetState<ThunkApiConfig> = ThunkApiConfig extends {
  state: infer State
}
  ? State
  : unknown
type GetExtra<ThunkApiConfig> = ThunkApiConfig extends { extra: infer Extra }
  ? Extra
  : unknown
type GetDispatch<ThunkApiConfig> = ThunkApiConfig extends {
  dispatch: infer Dispatch
}
  ? FallbackIfUnknown<
      Dispatch,
      ThunkDispatch<
        GetState<ThunkApiConfig>,
        GetExtra<ThunkApiConfig>,
        AnyAction
      >
    >
  : ThunkDispatch<GetState<ThunkApiConfig>, GetExtra<ThunkApiConfig>, AnyAction>

type GetThunkAPI<ThunkApiConfig> = BaseThunkAPI<
  GetState<ThunkApiConfig>,
  GetExtra<ThunkApiConfig>,
  GetDispatch<ThunkApiConfig>,
  GetRejectValue<ThunkApiConfig>,
  GetRejectedMeta<ThunkApiConfig>,
  GetFulfilledMeta<ThunkApiConfig>
>

type GetRejectValue<ThunkApiConfig> = ThunkApiConfig extends {
  rejectValue: infer RejectValue
}
  ? RejectValue
  : unknown

type GetPendingMeta<ThunkApiConfig> = ThunkApiConfig extends {
  pendingMeta: infer PendingMeta
}
  ? PendingMeta
  : unknown

type GetFulfilledMeta<ThunkApiConfig> = ThunkApiConfig extends {
  fulfilledMeta: infer FulfilledMeta
}
  ? FulfilledMeta
  : unknown

type GetRejectedMeta<ThunkApiConfig> = ThunkApiConfig extends {
  rejectedMeta: infer RejectedMeta
}
  ? RejectedMeta
  : unknown

type GetSerializedErrorType<ThunkApiConfig> = ThunkApiConfig extends {
  serializedErrorType: infer GetSerializedErrorType
}
  ? GetSerializedErrorType
  : SerializedError

type MaybePromise<T> = T | Promise<T> | (T extends any ? Promise<T> : never)

/**
 * A type describing the return value of the `payloadCreator` argument to `createAsyncThunk`.
 * Might be useful for wrapping `createAsyncThunk` in custom abstractions.
 *
 * @public
 */
export type AsyncThunkPayloadCreatorReturnValue<
  Returned,
  ThunkApiConfig extends AsyncThunkConfig
> = MaybePromise<
  | IsUnknown<
      GetFulfilledMeta<ThunkApiConfig>,
      Returned,
      FulfillWithMeta<Returned, GetFulfilledMeta<ThunkApiConfig>>
    >
  | RejectWithValue<
      GetRejectValue<ThunkApiConfig>,
      GetRejectedMeta<ThunkApiConfig>
    >
>
/**
 * A type describing the `payloadCreator` argument to `createAsyncThunk`.
 * Might be useful for wrapping `createAsyncThunk` in custom abstractions.
 *
 * @public
 */
export type AsyncThunkPayloadCreator<
  Returned,
  ThunkArg = void,
  ThunkApiConfig extends AsyncThunkConfig = {}
> = (
  arg: ThunkArg,
  thunkAPI: GetThunkAPI<ThunkApiConfig>
) => AsyncThunkPayloadCreatorReturnValue<Returned, ThunkApiConfig>

/**
 * A ThunkAction created by `createAsyncThunk`.
 * Dispatching it returns a Promise for either a
 * fulfilled or rejected action.
 * Also, the returned value contains an `abort()` method
 * that allows the asyncAction to be cancelled from the outside.
 *
 * @public
 */
export type AsyncThunkAction<
  Returned,
  ThunkArg,
  ThunkApiConfig extends AsyncThunkConfig
> = (
  dispatch: GetDispatch<ThunkApiConfig>,
  getState: () => GetState<ThunkApiConfig>,
  extra: GetExtra<ThunkApiConfig>
) => Promise<
  | ReturnType<AsyncThunkFulfilledActionCreator<Returned, ThunkArg>>
  | ReturnType<AsyncThunkRejectedActionCreator<ThunkArg, ThunkApiConfig>>
> & {
  abort: (reason?: string) => void
  requestId: string
  arg: ThunkArg
  unwrap: () => Promise<Returned>
}

type AsyncThunkActionCreator<
  Returned,
  ThunkArg,
  ThunkApiConfig extends AsyncThunkConfig
> = IsAny<
  ThunkArg,
  // any handling
  (arg: ThunkArg) => AsyncThunkAction<Returned, ThunkArg, ThunkApiConfig>,
  // unknown handling
  unknown extends ThunkArg
    ? (arg: ThunkArg) => AsyncThunkAction<Returned, ThunkArg, ThunkApiConfig> // argument not specified or specified as void or undefined
    : [ThunkArg] extends [void] | [undefined]
    ? () => AsyncThunkAction<Returned, ThunkArg, ThunkApiConfig> // argument contains void
    : [void] extends [ThunkArg] // make optional
    ? (arg?: ThunkArg) => AsyncThunkAction<Returned, ThunkArg, ThunkApiConfig> // argument contains undefined
    : [undefined] extends [ThunkArg]
    ? WithStrictNullChecks<
        // with strict nullChecks: make optional
        (
          arg?: ThunkArg
        ) => AsyncThunkAction<Returned, ThunkArg, ThunkApiConfig>,
        // without strict null checks this will match everything, so don't make it optional
        (arg: ThunkArg) => AsyncThunkAction<Returned, ThunkArg, ThunkApiConfig>
      > // default case: normal argument
    : (arg: ThunkArg) => AsyncThunkAction<Returned, ThunkArg, ThunkApiConfig>
>

/**
 * Options object for `createAsyncThunk`.
 *
 * @public
 */
export type AsyncThunkOptions<
  ThunkArg = void,
  ThunkApiConfig extends AsyncThunkConfig = {}
> = {
  /**
   * A method to control whether the asyncThunk should be executed. Has access to the
   * `arg`, `api.getState()` and `api.extra` arguments.
   *
   * @returns `false` if it should be skipped
   */
  condition?(
    arg: ThunkArg,
    api: Pick<GetThunkAPI<ThunkApiConfig>, 'getState' | 'extra'>
  ): MaybePromise<boolean | undefined>
  /**
   * If `condition` returns `false`, the asyncThunk will be skipped.
   * This option allows you to control whether a `rejected` action with `meta.condition == false`
   * will be dispatched or not.
   *
   * @default `false`
   */
  dispatchConditionRejection?: boolean

  serializeError?: (x: unknown) => GetSerializedErrorType<ThunkApiConfig>

  /**
   * A function to use when generating the `requestId` for the request sequence.
   *
   * @default `nanoid`
   */
  idGenerator?: (arg: ThunkArg) => string
} & IsUnknown<
  GetPendingMeta<ThunkApiConfig>,
  {
    /**
     * A method to generate additional properties to be added to `meta` of the pending action.
     *
     * Using this optional overload will not modify the types correctly, this overload is only in place to support JavaScript users.
     * Please use the `ThunkApiConfig` parameter `pendingMeta` to get access to a correctly typed overload
     */
    getPendingMeta?(
      base: {
        arg: ThunkArg
        requestId: string
      },
      api: Pick<GetThunkAPI<ThunkApiConfig>, 'getState' | 'extra'>
    ): GetPendingMeta<ThunkApiConfig>
  },
  {
    /**
     * A method to generate additional properties to be added to `meta` of the pending action.
     */
    getPendingMeta(
      base: {
        arg: ThunkArg
        requestId: string
      },
      api: Pick<GetThunkAPI<ThunkApiConfig>, 'getState' | 'extra'>
    ): GetPendingMeta<ThunkApiConfig>
  }
>

export type AsyncThunkPendingActionCreator<
  ThunkArg,
  ThunkApiConfig = {}
> = ActionCreatorWithPreparedPayload<
  [string, ThunkArg, GetPendingMeta<ThunkApiConfig>?],
  undefined,
  string,
  never,
  {
    arg: ThunkArg
    requestId: string
    requestStatus: 'pending'
  } & GetPendingMeta<ThunkApiConfig>
>

export type AsyncThunkRejectedActionCreator<
  ThunkArg,
  ThunkApiConfig = {}
> = ActionCreatorWithPreparedPayload<
  [
    Error | null,
    string,
    ThunkArg,
    GetRejectValue<ThunkApiConfig>?,
    GetRejectedMeta<ThunkApiConfig>?
  ],
  GetRejectValue<ThunkApiConfig> | undefined,
  string,
  GetSerializedErrorType<ThunkApiConfig>,
  {
    arg: ThunkArg
    requestId: string
    requestStatus: 'rejected'
    aborted: boolean
    condition: boolean
  } & (
    | ({ rejectedWithValue: false } & {
        [K in keyof GetRejectedMeta<ThunkApiConfig>]?: undefined
      })
    | ({ rejectedWithValue: true } & GetRejectedMeta<ThunkApiConfig>)
  )
>

export type AsyncThunkFulfilledActionCreator<
  Returned,
  ThunkArg,
  ThunkApiConfig = {}
> = ActionCreatorWithPreparedPayload<
  [Returned, string, ThunkArg, GetFulfilledMeta<ThunkApiConfig>?],
  Returned,
  string,
  never,
  {
    arg: ThunkArg
    requestId: string
    requestStatus: 'fulfilled'
  } & GetFulfilledMeta<ThunkApiConfig>
>

/**
 * A type describing the return value of `createAsyncThunk`.
 * Might be useful for wrapping `createAsyncThunk` in custom abstractions.
 *
 * @public
 */
export type AsyncThunk<
  Returned,
  ThunkArg,
  ThunkApiConfig extends AsyncThunkConfig
> = AsyncThunkActionCreator<Returned, ThunkArg, ThunkApiConfig> & {
  pending: AsyncThunkPendingActionCreator<ThunkArg, ThunkApiConfig>
  rejected: AsyncThunkRejectedActionCreator<ThunkArg, ThunkApiConfig>
  fulfilled: AsyncThunkFulfilledActionCreator<
    Returned,
    ThunkArg,
    ThunkApiConfig
  >
  typePrefix: string
}

type OverrideThunkApiConfigs<OldConfig, NewConfig> = Id<
  NewConfig & Omit<OldConfig, keyof NewConfig>
>

type CreateAsyncThunk<CurriedThunkApiConfig extends AsyncThunkConfig> = {
  /**
   *
   * @param typePrefix
   * @param payloadCreator
   * @param options
   *
   * @public
   */
  // separate signature without `AsyncThunkConfig` for better inference
  <Returned, ThunkArg = void>(
    typePrefix: string,
    payloadCreator: AsyncThunkPayloadCreator<
      Returned,
      ThunkArg,
      CurriedThunkApiConfig
    >,
    options?: AsyncThunkOptions<ThunkArg, CurriedThunkApiConfig>
  ): AsyncThunk<Returned, ThunkArg, CurriedThunkApiConfig>

  /**
   *
   * @param typePrefix
   * @param payloadCreator
   * @param options
   *
   * @public
   */
  <Returned, ThunkArg, ThunkApiConfig extends AsyncThunkConfig>(
    typePrefix: string,
    payloadCreator: AsyncThunkPayloadCreator<
      Returned,
      ThunkArg,
      OverrideThunkApiConfigs<CurriedThunkApiConfig, ThunkApiConfig>
    >,
    options?: AsyncThunkOptions<
      ThunkArg,
      OverrideThunkApiConfigs<CurriedThunkApiConfig, ThunkApiConfig>
    >
  ): AsyncThunk<
    Returned,
    ThunkArg,
    OverrideThunkApiConfigs<CurriedThunkApiConfig, ThunkApiConfig>
  >

  withTypes<ThunkApiConfig extends AsyncThunkConfig>(): CreateAsyncThunk<
    OverrideThunkApiConfigs<CurriedThunkApiConfig, ThunkApiConfig>
  >
}

// 当前是一个自执行函数的结果 - 其实就是自执行函数中的createAsyncThunk函数 // +++
// 创建异步的thunk
export const createAsyncThunk = (() => {

  // 创建异步thunk函数 // +++
  function createAsyncThunk<
    Returned,
    ThunkArg,
    ThunkApiConfig extends AsyncThunkConfig
  >(
    typePrefix: string,
    payloadCreator: AsyncThunkPayloadCreator<
      Returned,
      ThunkArg,
      ThunkApiConfig
    >,
    options?: AsyncThunkOptions<ThunkArg, ThunkApiConfig>
  ): AsyncThunk<Returned, ThunkArg, ThunkApiConfig> {
    type RejectedValue = GetRejectValue<ThunkApiConfig>
    type PendingMeta = GetPendingMeta<ThunkApiConfig>
    type FulfilledMeta = GetFulfilledMeta<ThunkApiConfig>
    type RejectedMeta = GetRejectedMeta<ThunkApiConfig>

    // 类型前缀
    // payload创建者
    // options

    // 返回actionCreator函数
    const fulfilled: AsyncThunkFulfilledActionCreator<
      Returned,
      ThunkArg,
      ThunkApiConfig
    > = createAction(
      // type
      typePrefix + '/fulfilled',
      // prepareAction
      (
        payload: Returned,
        requestId: string,
        arg: ThunkArg,
        meta?: FulfilledMeta
      ) => ({
        payload, // 这个payload作为最终action对象的payload属性
        // 这个meta对象作为最终action对象的meta属性
        meta: {
          ...((meta as any) || {}),
          arg,
          requestId,
          requestStatus: 'fulfilled' as const,
        },
      })
    )

    // 返回actionCreator函数
    const pending: AsyncThunkPendingActionCreator<ThunkArg, ThunkApiConfig> =
      createAction(
        typePrefix + '/pending',
        (requestId: string, arg: ThunkArg, meta?: PendingMeta) => ({
          payload: undefined,
          meta: {
            ...((meta as any) || {}),
            arg,
            requestId,
            requestStatus: 'pending' as const,
          },
        })
      )

    // 返回actionCreator函数
    const rejected: AsyncThunkRejectedActionCreator<ThunkArg, ThunkApiConfig> =
      createAction(
        typePrefix + '/rejected',
        (
          error: Error | null,
          requestId: string,
          arg: ThunkArg,
          payload?: RejectedValue,
          meta?: RejectedMeta
        ) => ({
          payload,
          error: ((options && options.serializeError) || miniSerializeError)(
            error || 'Rejected'
          ) as GetSerializedErrorType<ThunkApiConfig>,
          meta: {
            ...((meta as any) || {}),
            arg,
            requestId,
            rejectedWithValue: !!payload,
            requestStatus: 'rejected' as const,
            aborted: error?.name === 'AbortError',
            condition: error?.name === 'ConditionError',
          },
        })
      )

    // 是否展示警告 // +++
    let displayedWarning = false

    // AbortController类
    const AC =
      typeof AbortController !== 'undefined'
        ? AbortController
        : class implements AbortController {
            signal = {
              aborted: false,
              addEventListener() {},
              dispatchEvent() {
                return false
              },
              onabort() {},
              removeEventListener() {},
              reason: undefined,
              throwIfAborted() {},
            }
            abort() {
              if (process.env.NODE_ENV !== 'production') {
                if (!displayedWarning) {
                  displayedWarning = true
                  console.info(
                    `This platform does not implement AbortController. 
If you want to use the AbortController to react to \`abort\` events, please consider importing a polyfill like 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only'.`
                  )
                }
              }
            }
          }

    // 准备action创建者函数 // +++
    function actionCreator(
      arg: ThunkArg // 一个参数
    ): AsyncThunkAction<Returned, ThunkArg, ThunkApiConfig> {

      // 直接就返回一个函数 // +++
      return (dispatch, getState, extra) => { // 在thunk middleware中的action参数函数中判断类型是一个函数，那么将直接执行这个函数并传入它所在的dispatch, getState, extra（额外的）参数 // +++

        // 是否有id生成器
        const requestId = options?.idGenerator
          ? options.idGenerator(arg)
          : nanoid() // 没有则直接使用nanoid进行生成 // +++

        // 创建一个AbortController类实例对象 // +++
        const abortController = new AC()

        // 准备abort原因
        let abortReason: string | undefined

        // 准备aborted promise
        const abortedPromise = new Promise<never>((_, reject) =>
          abortController.signal.addEventListener('abort', () =>
            reject({ name: 'AbortError', message: abortReason || 'Aborted' })
          )
        )

        // 是否已开始
        let started = false

        // abort函数
        function abort(reason?: string) {
          // 已开始则添加原因然后执行AbortController类实例的abort函数 // +++
          if (started) {
            abortReason = reason
            abortController.abort()
          }
        }

        
        // 这是一个自执行函数所返回的结果 - 一个promise // +++
        const promise = (async function () {
          // 准备最终action对象 // +++
          let finalAction: ReturnType<typeof fulfilled | typeof rejected>
          try {
            // 首先对condition函数进行执行
            let conditionResult = options?.condition?.(arg, { getState, extra })

            // 执行的结果是否可then
            if (isThenable(conditionResult)) {
              // 说明它是一个promise那么直接await它
              conditionResult = await conditionResult
            }
            // 当前结果值是否为false - 那么直接【throw】 // +++
            if (conditionResult === false) {
              // eslint-disable-next-line no-throw-literal
              throw {
                name: 'ConditionError',
                message: 'Aborted due to condition callback returning false.',
              }
            }

            // 标记已开始 // +++
            started = true

            // 派发
            dispatch(
              // 执行关于pending的actionCreator函数 - 返回一个关于pending的action对象 // +++
              pending(
                requestId,
                arg,
                // 执行获取pending元数据 // +++
                options?.getPendingMeta?.(
                  { requestId, arg },
                  { getState, extra }
                )
              )
            )

            // 竞速 且 await返回的这个promise得到最终action对象 // +++
            finalAction = await Promise.race([
              abortedPromise, // 上方准备好的abortedPromise

              // 使用Promise.resolve函数等待payload创建者函数所返回的值 - 可能应该是一个promise // +++
              Promise.resolve(
                // 执行payload创建者函数 - 返回值交给Promise.resolve函数的参数 // +++
                payloadCreator(arg, {
                  dispatch,
                  getState,
                  extra,
                  requestId,
                  signal: abortController.signal,
                  abort,
                  rejectWithValue: ((
                    value: RejectedValue,
                    meta?: RejectedMeta
                  ) => {
                    return new RejectWithValue(value, meta)
                  }) as any,
                  fulfillWithValue: ((value: unknown, meta?: FulfilledMeta) => {
                    return new FulfillWithMeta(value, meta)
                  }) as any,
                })
              ) /** 再对这个promise进行then */ .then((result) => {
                if (result instanceof RejectWithValue) {
                  throw result
                }
                if (result instanceof FulfillWithMeta) {
                  return fulfilled(result.payload, requestId, arg, result.meta)
                }

                // 执行关于fulfilled的actionCreator函数产生一个关于fulfilled的action对象 - 交出去 // +++
                return fulfilled(result as any, requestId, arg)
                // action对象的payload属性就是这个result值 // +++
              }),
            ])
            // 得到最终action对象 // +++

            // +++
          } catch (err) {
            finalAction =
              err instanceof RejectWithValue
                ? rejected(null, requestId, arg, err.payload, err.meta)
                : rejected(err as any, requestId, arg)
          }
          // We dispatch the result action _after_ the catch, to avoid having any errors
          // here get swallowed by the try/catch block,
          // per https://twitter.com/dan_abramov/status/770914221638942720
          // and https://github.com/reduxjs/redux-toolkit/blob/e85eb17b39a2118d859f7b7746e0f3fee523e089/docs/tutorials/advanced-tutorial.md#async-error-handling-logic-in-thunks

          // 是否跳过接下来的dispatch
          const skipDispatch =
            options &&
            !options.dispatchConditionRejection &&
            rejected.match(finalAction) &&
            (finalAction as any).meta.condition

          // 不跳过则直接派发这个最终action对象 // +++
          if (!skipDispatch) {
            dispatch(finalAction)
          }

          /// 返回最终action对象
          return finalAction // +++
        })()


        // 返回这个promise - 且在这个promise上添加abort、requestId、arg、unwrap属性 // +++
        return Object.assign(promise as Promise<any>, {
          abort,
          requestId,
          arg,
          // 展开函数
          unwrap() {
            return promise.then<any>(unwrapResult) // 使用展开结果函数
          },
        })
      }
    }


    // 返回actionCreator函数 - 且在这个函数上添加pending、rejected、fulfilled、typePrefix属性
    return Object.assign(
      actionCreator as AsyncThunkActionCreator<
        Returned,
        ThunkArg,
        ThunkApiConfig
      >,
      {
        pending,
        rejected,
        fulfilled,
        typePrefix,
      }
    )
  }

  // 添加withTypes属性值为这个箭头函数，而这个函数执行的返回值依然是这个createAsyncThunk函数 // +++
  createAsyncThunk.withTypes = () => createAsyncThunk

  // 返回这个函数
  return createAsyncThunk as CreateAsyncThunk<AsyncThunkConfig>
})()

/* 
createAsyncThunk函数执行返回actionCreator函数，而这个函数执行返回(dispatch, getState, extra)参数函数
再然后这个函数直接是在thunk middleware中的action参数函数中判断类型为函数直接return 这个函数(...)这样的
实际上返回的就是上面的那个promise

随后你可以dispatch(...).unwarp().then(val => {...})这种形式的操作
可以这样
也可以不这样 - 因为其内部会dispatch(fulfilled(...))
那么你可以在extraReducers: builder => builder.addCase(xxx.fulfilled, (state, action) => {...})这样做 // +++
*/

interface UnwrappableAction {
  payload: any
  meta?: any
  error?: any
}

type UnwrappedActionPayload<T extends UnwrappableAction> = Exclude<
  T,
  { error: any }
>['payload']

/**
 * @public
 */
export function unwrapResult<R extends UnwrappableAction>( // 展开结果 // +++
  action: R
): UnwrappedActionPayload<R> {
  // 最终action对象上的元数据
  if (action.meta && action.meta.rejectedWithValue) {
    throw action.payload // 抛出
  }
  if (action.error) {
    throw action.error // 抛出
  }
  return action.payload // 直接取出action对象的payload属性值然后进行返回 // +++
}

type WithStrictNullChecks<True, False> = undefined extends boolean
  ? False
  : True

function isThenable(value: any): value is PromiseLike<any> { // 是否为可then的 // +++
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.then === 'function'
  )
}
