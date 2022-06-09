import { FIFO } from './fifo.js'
import type { Next } from './fifo.js'

type BasePushable<PushType, ReturnType, YieldType = PushType> = AsyncGenerator<YieldType, void, unknown> & {
  push: (value: PushType) => ReturnType
  end: (err?: Error) => ReturnType
}

export interface Pushable<T> extends BasePushable<T, Pushable<T>> {}
export interface PushableV<T> extends BasePushable<T, PushableV<T>, T[]> {}

export interface Options {
  onEnd?: (err?: Error) => void
}

interface getNext<T, V = T> { (buffer: FIFO<T>): Promise<IteratorResult<V>> }

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
  let buffer = new FIFO<PushType>()
  let pushable: any
  let onNext: ((next: Next<PushType>) => ReturnType) | null
  let ended: boolean

  const waitNext = async (): Promise<IteratorResult<YieldType>> => {
    if (!buffer.isEmpty()) {
      return await getNext(buffer)
    }

    if (ended) {
      return { done: true, value: undefined }
    }

    return await new Promise((resolve, reject) => {
      onNext = (next: Next<PushType>) => {
        onNext = null
        buffer.push(next)

        try {
          resolve(getNext(buffer))
        } catch (err) {
          reject(err)
        }

        return pushable
      }
    })
  }

  const bufferNext = (next: Next<PushType>) => {
    if (onNext != null) {
      return onNext(next)
    }

    buffer.push(next)
    return pushable
  }

  const bufferError = (err: Error) => {
    buffer = new FIFO()

    if (onNext != null) {
      return onNext({ error: err })
    }

    buffer.push({ error: err })
    return pushable
  }

  const push = (value: PushType) => {
    if (ended) {
      return pushable
    }

    return bufferNext({ done: false, value })
  }
  const end = (err?: Error) => {
    if (ended) return pushable
    ended = true

    return (err != null) ? bufferError(err) : bufferNext({ done: true })
  }
  const _return = () => {
    buffer = new FIFO()
    end()

    return { done: true }
  }
  const _throw = (err: Error) => {
    end(err)

    return { done: true }
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
    throw (err: Error) {
      _pushable.throw(err)

      if (onEnd != null) {
        onEnd(err)
        onEnd = undefined
      }

      return { done: true }
    },
    return () {
      _pushable.return()

      if (onEnd != null) {
        onEnd()
        onEnd = undefined
      }

      return { done: true }
    },
    push,
    end (err: Error) {
      _pushable.end(err)

      if (onEnd != null) {
        onEnd(err)
        onEnd = undefined
      }

      return pushable
    }
  }

  return pushable
}
