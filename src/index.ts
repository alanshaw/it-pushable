/**
 * @packageDocumentation
 *
 * An iterable that you can push values into.
 *
 * @example
 *
 * ```js
 * import { pushable } from 'it-pushable'
 *
 * const source = pushable()
 *
 * setTimeout(() => source.push('hello'), 100)
 * setTimeout(() => source.push('world'), 200)
 * setTimeout(() => source.end(), 300)
 *
 * const start = Date.now()
 *
 * for await (const value of source) {
 *   console.log(`got "${value}" after ${Date.now() - start}ms`)
 * }
 * console.log(`done after ${Date.now() - start}ms`)
 *
 * // Output:
 * // got "hello" after 105ms
 * // got "world" after 207ms
 * // done after 309ms
 * ```
 *
 * @example
 *
 * ```js
 * import { pushableV } from 'it-pushable'
 * import all from 'it-all'
 *
 * const source = pushableV()
 *
 * source.push(1)
 * source.push(2)
 * source.push(3)
 * source.end()
 *
 * console.info(await all(source))
 *
 * // Output:
 * // [ [1, 2, 3] ]
 * ```
 */

import { FIFO } from './fifo.js'

export interface Next<T> {
  done?: boolean
  error?: Error
  value?: T
}

interface BasePushable<T> {
  /**
   * End the iterable after all values in the buffer (if any) have been yielded. If an
   * error is passed the buffer is cleared immediately and the next iteration will
   * throw the passed error
   */
  end: (err?: Error) => this

  /**
   * Push a value into the iterable. Values are yielded from the iterable in the order
   * they are pushed. Values not yet consumed from the iterable are buffered.
   */
  push: (value: T) => this
  next: () => Promise<Next<T>>
  return: () => { done: boolean }
  throw: (err: Error) => { done: boolean }

  /**
   * This property contains the number of bytes (or objects) in the queue ready to be read.
   *
   * If `objectMode` is true, this is the number of objects in the queue, if false it's the
   * total number of bytes in the queue.
   */
  readableLength: number
}

/**
 * An iterable that you can push values into.
 */
export interface Pushable<T> extends AsyncIterable<T>, BasePushable<T> {}

/**
 * Similar to `pushable`, except it yields multiple buffered chunks at a time. All values yielded from the iterable will be arrays.
 */
export interface PushableV<T> extends AsyncIterable<T[]>, BasePushable<T> {}

export interface Options {
  /**
   * A boolean value that means non-`Uint8Array`s will be passed to `.push`, default: `false`
   */
  objectMode?: boolean

  /**
   * A function called after *all* values have been yielded from the iterator (including
   * buffered values). In the case when the iterator is ended with an error it will be
   * passed the error as a parameter.
   */
  onEnd?: (err?: Error) => void
}

type NextResult<T> = { done: false, value: T} | { done: true }

interface getNext<T, V = T> { (buffer: FIFO<T>): NextResult<V> }

export interface ObjectPushableOptions extends Options {
  objectMode: true
}

export interface BytePushableOptions extends Options {
  objectMode?: false
}

/**
 * Create a new async iterable. The values yielded from calls to `.next()`
 * or when used in a `for await of`loop are "pushed" into the iterable.
 * Returns an async iterable object with additional methods.
 */
export function pushable<T extends { byteLength: number } = Uint8Array> (options?: BytePushableOptions): Pushable<T>
export function pushable<T> (options: ObjectPushableOptions): Pushable<T>
export function pushable<T> (options: Options = {}): Pushable<T> {
  const getNext = (buffer: FIFO<T>): NextResult<T> => {
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

export function pushableV<T extends { byteLength: number } = Uint8Array> (options?: BytePushableOptions): PushableV<T>
export function pushableV<T> (options: ObjectPushableOptions): PushableV<T>
export function pushableV<T> (options: Options = {}): PushableV<T> {
  const getNext = (buffer: FIFO<T>): NextResult<T[]> => {
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
  let buffer = new FIFO<PushType>()
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

    // @ts-expect-error `byteLength` is not declared on PushType
    if (options?.objectMode !== true && value?.byteLength == null) {
      throw new Error('objectMode was not true but tried to push non-Uint8Array value')
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
    end,
    get readableLength () {
      return buffer.size
    }
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
    },
    get readableLength () {
      return _pushable.readableLength
    }
  }

  return pushable
}
