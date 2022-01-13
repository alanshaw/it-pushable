import { FIFO } from './fifo.js'

interface BasePushable<T> {
  end: (err?: Error) => this
  push: (value: T) => this
  next: () => Promise<Next<T>>
  return: () => { done: boolean }
  throw: (err: Error) => { done: boolean }
}

export interface Pushable<T> extends AsyncIterable<T>, BasePushable<T> {}
export interface PushableV<T> extends AsyncIterable<T[]>, BasePushable<T> {}

export interface Options {
  onEnd?: (err?: Error) => void
}

interface Next<T> {
  done?: boolean
  error?: Error
  value?: T
}

type NextResult<T> = { done: false, value: T} | { done: true }

interface getNext<T, V = T> { (buffer: FIFO<Next<T>>): NextResult<V> }

export function pushable<T> (options?: Options): Pushable<T> {
  const getNext = (buffer: FIFO<Next<T>>): NextResult<T> => {
    const next: Next<T> | undefined = buffer.shift()

    if (next == null) {
      return { done: true }
    }

    if (next.error != null) {
      throw next.error
    }

    return {
      done: next.done === true,
      // @ts-expect-error
      value: next.value
    }
  }

  return _pushable<T, T, Pushable<T>>(getNext, options)
}

export function pushableV<T> (options?: Options): PushableV<T> {
  const getNext = (buffer: FIFO<Next<T>>): NextResult<T[]> => {
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
        // @ts-expect-error
        values.push(next.value)
      }
    }

    if (next == null) {
      return { done: true }
    }

    return {
      done: next.done === true,
      value: values
    }
  }

  return _pushable<T, T[], PushableV<T>>(getNext, options)
}

function _pushable<PushType, ValueType, ReturnType> (getNext: getNext<PushType, ValueType>, options?: Options): ReturnType {
  options = options ?? {}
  let onEnd = options.onEnd
  let buffer = new FIFO<Next<PushType>>()
  let pushable: any
  let onNext: ((next: Next<PushType>) => ReturnType) | null
  let ended: boolean

  const waitNext = async (): Promise<NextResult<ValueType>> => {
    if (!buffer.isEmpty()) {
      return getNext(buffer)
    }

    if (ended) {
      return { done: true }
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
