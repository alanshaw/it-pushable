import { FIFO } from './fifo.js'
import type { Next } from './fifo.js'

type BasePushable<PushType, ReturnType, YieldType = PushType> = AsyncGenerator<YieldType, void, unknown> & {
  push: (value: PushType) => Promise<ReturnType>
  end: (err?: Error) => Promise<ReturnType>
}

export interface Pushable<T> extends BasePushable<T, Pushable<T>> {}
export interface PushableV<T> extends BasePushable<T, PushableV<T>, T[]> {}

export interface Options {
  highWaterMark?: number
  objectMode?: boolean
  onEnd?: (err?: Error) => void | Promise<void>
}

export interface ObjectPushableOptions extends Options {
  objectMode: true
}

export interface BytePushableOptions extends Options {
  objectMode?: false
}

interface getNext<T, V = T> { (buffer: FIFO<T>): Promise<IteratorResult<V>> }

export function pushable (options?: BytePushableOptions): Pushable<Uint8Array>
export function pushable<T> (options: ObjectPushableOptions): Pushable<T>
export function pushable<T> (options: Options = {}): Pushable<T> {
  const getNext = async (buffer: FIFO<T>): Promise<IteratorResult<T>> => {
    const next: Next<T> | undefined = buffer.shift()

    if (next == null) {
      return { done: true, value: undefined }
    }

    if (next.error != null) {
      throw next.error
    }

    if (next.done === true) {
      return {
        done: true,
        value: undefined
      }
    }

    // @ts-expect-error next.value can be undefined when it should only be T - see test 'should buffer falsy input'
    return {
      done: false,
      value: next.value
    }
  }

  return _pushable<T, T, Pushable<T>>(getNext, options)
}

export function pushableV (options?: BytePushableOptions): PushableV<Uint8Array>
export function pushableV<T> (options: ObjectPushableOptions): PushableV<T>
export function pushableV<T> (options: Options = {}): PushableV<T> {
  const getNext = async (buffer: FIFO<T>): Promise<IteratorResult<T[]>> => {
    let next: Next<T> | undefined
    const values: T[] = []

    while (!buffer.isEmpty()) {
      next = buffer.shift()

      if (next == null) {
        break
      }

      if (next.error != null) {
        throw next.error
      }

      if (next.done === false) {
        // @ts-expect-error next.value can be undefined when it should only be T - see test 'should buffer falsy input'
        values.push(next.value)
      }
    }

    if (next == null || next.done === true) {
      return {
        done: true,
        value: []
      }
    }

    return {
      done: false,
      value: values
    }
  }

  return _pushable<T, T[], PushableV<T>>(getNext, options)
}

function _pushable<PushType, YieldType, ReturnType> (getNext: getNext<PushType, YieldType>, options?: Options): ReturnType {
  options = options ?? {}
  let onEnd = options.onEnd
  let buffer = new FIFO<PushType>(options)
  let pushable: any
  let onNext: ((next: Next<PushType>) => Promise<ReturnType>) | null
  let ended: boolean

  const waitNext = async (): Promise<IteratorResult<YieldType>> => {
    if (!buffer.isEmpty()) {
      return await getNext(buffer)
    }

    if (ended) {
      return { done: true, value: undefined }
    }

    return await new Promise((resolve, reject) => {
      onNext = async (next: Next<PushType>) => {
        onNext = null
        await buffer.push(next)

        try {
          resolve(getNext(buffer))
        } catch (err) {
          reject(err)
        }

        return pushable
      }
    })
  }

  const bufferNext = async (next: Next<PushType>) => {
    if (onNext != null) {
      return await onNext(next)
    }

    await buffer.push(next)
    return pushable
  }

  const bufferError = async (err: Error) => {
    buffer = new FIFO()

    if (onNext != null) {
      return await onNext({ error: err })
    }

    await buffer.push({ error: err })

    return pushable
  }

  const push = async (value: PushType): Promise<ReturnType> => {
    if (ended) {
      return pushable
    }

    await bufferNext({ done: false, value })

    return pushable
  }
  const end = async (err?: Error): Promise<ReturnType> => {
    if (ended) {
      return pushable
    }

    ended = true

    return (err != null) ? await bufferError(err) : await bufferNext({ done: true })
  }
  const _return = async (): Promise<IteratorResult<YieldType>> => {
    buffer.clear()
    await end()

    return { done: true, value: undefined }
  }
  const _throw = async (err: Error): Promise<IteratorResult<YieldType>> => {
    await end(err)

    return { done: true, value: undefined }
  }

  pushable = {
    [Symbol.asyncIterator] () { return this },
    next: waitNext,
    return: _return,
    throw: _throw,
    push,
    end
  }

  if (onEnd == null) {
    return pushable
  }

  const _pushable = pushable

  pushable = {
    [Symbol.asyncIterator] () { return this },
    next () {
      return _pushable.next()
    },
    async throw (err: Error) {
      _pushable.throw(err)

      if (onEnd != null) {
        await onEnd(err)
        onEnd = undefined
      }

      return { done: true, value: undefined }
    },
    async return () {
      _pushable.return()

      if (onEnd != null) {
        await onEnd()
        onEnd = undefined
      }

      return { done: true, value: undefined }
    },
    push,
    async end (err?: Error) {
      _pushable.end(err)

      if (onEnd != null) {
        await onEnd(err)
        onEnd = undefined
      }

      return pushable
    }
  }

  return pushable
}
