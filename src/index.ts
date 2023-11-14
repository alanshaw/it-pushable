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
 *
 * ### Backpressure
 * This module supports backpressure by returning a promise to any `push` or `end` call.
 * These promises will resolve when the `push`ed value has been consumed (in the case of `.push`) or when the consumer has iterated over all values in the pushable (in the case of `.end`).
 *
 * If you do not wish to wait and instead buffer as much data as possible, do not await the result of `.push`
 *
 * @example
 *
 * ```js
 * import { pushable } from 'it-pushable'
 *
 * const source = pushable()
 *
 * // wait for the value to be consumed
 * await source.push(5)
 *
 * // do not wait for the value to be consumed
 * void source.push(5)
 *
 * // only wait 10ms for the value to be consumed
 * await source.push(5, {
 *   signal: AbortSignal.timeout(10)
 * })
```
 */

import defer, { type DeferredPromise } from 'p-defer'
import { raceSignal, type RaceSignalOptions } from 'race-signal'
import { PFIFO } from './p-fifo.js'

export interface AbortOptions {
  signal?: AbortSignal
}

export interface PushableOptions {
  /**
   * A function called after *all* values have been yielded from the iterator
   * (including buffered values). In the case when the iterator is ended with an
   * error it will be passed the error as a parameter.
   */
  onEnd?(err?: Error): void
}

export interface Pushable<T> extends AsyncGenerator<T, void, unknown> {
  /**
   * End the iterable after all values in the buffer (if any) have been yielded.
   * If an error is passed the buffer is cleared immediately and the next
   * iteration will throw the passed error
   *
   * If `.next` has not been called on this iterable, `.end` will return
   * immediately. Otherwise it will wait for the final value to be consumed
   * before resolving, unless the passed signal emits an `abort` event before
   * then.
   */
  end(err?: Error, options?: AbortOptions & RaceSignalOptions): Promise<void>

  /**
   * Push a value into the iterable. Values are yielded from the iterable in the
   * order they are pushed. Values not yet consumed from the iterable are
   * buffered.
   *
   * When the returned promise resolves, the pushed value will have been
   * consumed.
   */
  push(value: T, options?: AbortOptions & RaceSignalOptions): Promise<void>

  /**
   * This property contains the number of bytes (or objects) in the queue ready
   * to be read.
   *
   * If objects pushed into this queue have a `.byteLength` property, this is
   * ths total number of bytes in the queue, otherwise it is the number of
   * objects in the queue
   */
  readableLength: number
}

export interface PushableV<T> extends AsyncGenerator<T[], void, unknown> {
  /**
   * End the iterable after all values in the buffer (if any) have been yielded.
   * If an error is passed the buffer is cleared immediately and the next
   * iteration will throw the passed error
   *
   * If `.next` has not been called on this iterable, `.end` will return
   * immediately. Otherwise it will wait for the final value to be consumed
   * before resolving, unless the passed signal emits an `abort` event before
   * then.
   */
  end(err?: Error, options?: AbortOptions & RaceSignalOptions): Promise<void>

  /**
   * Push a value into the iterable. Values are yielded from the iterable in the
   * order they are pushed. Values not yet consumed from the iterable are
   * buffered.
   *
   * When the returned promise resolves, the pushed value will have been
   * consumed.
   */
  push(value: T, options?: AbortOptions & RaceSignalOptions): Promise<void>

  /**
   * Push a list of values into the iterable in-order. Values are yielded from
   * the iterable in the order they are pushed. Values not yet consumed from the
   * iterable are buffered.
   *
   * When the returned promise resolves, all pushed values will have been
   * consumed.
   */
  pushV (values: T[], options?: AbortOptions & RaceSignalOptions): Promise<void>

  /**
   * This property contains the number of bytes (or objects) in the queue ready
   * to be read.
   *
   * If objects pushed into this queue have a `.byteLength` property, this is
   * ths total number of bytes in the queue, otherwise it is the number of
   * objects in the queue
   */
  readableLength: number
}

abstract class AbstractPushable<T> {
  protected readonly errorPromise: DeferredPromise<IteratorReturnResult<void>>
  protected readonly returnPromise: DeferredPromise<IteratorReturnResult<undefined>>
  protected fifo: PFIFO<IteratorResult<T, void>>
  protected onEnd?: (err?: Error) => void
  protected piped: boolean
  protected ended: boolean

  constructor (options?: PushableOptions) {
    this.errorPromise = defer()
    this.returnPromise = defer()
    this.fifo = new PFIFO()
    this.onEnd = options?.onEnd
    this.piped = false
    this.ended = false
  }

  [Symbol.asyncIterator] (): this {
    return this
  }

  async next (): Promise<IteratorResult<T, void>> {
    this.piped = true

    try {
      const result = await Promise.race([
        this.errorPromise.promise,
        this.returnPromise.promise,
        (async () => {
          if (this.ended && this.fifo.isEmpty()) {
            const result: IteratorReturnResult<void> = {
              done: true,
              value: undefined
            }

            return result
          }

          // if this.fifo is empty, this will wait for either a value to be
          // pushed, or for .throw, .return or .end to be called
          return this.getValues()
        })()
      ])

      if (result.done === true) {
        this.onEnd?.()
        this.onEnd = undefined
      }

      return result
    } catch (err: any) {
      this.onEnd?.(err)
      this.onEnd = undefined

      throw err
    }
  }

  async return (): Promise<IteratorReturnResult<void>> {
    this.ended = true
    this.returnPromise.resolve({ done: true, value: undefined })
    this.fifo = new PFIFO()

    this.onEnd?.()
    this.onEnd = undefined

    return {
      done: true,
      value: undefined
    }
  }

  async throw (err: Error): Promise<IteratorReturnResult<undefined>> {
    this.ended = true
    this.errorPromise.reject(err)
    this.fifo = new PFIFO()

    this.onEnd?.(err)
    this.onEnd = undefined

    return {
      done: true,
      value: undefined
    }
  }

  async end (err?: Error, options?: AbortOptions & RaceSignalOptions): Promise<void> {
    this.ended = true

    if (err != null) {
      await this.throw(err)
      return
    }

    await new Promise<void>((resolve, reject) => {
      // settle promise in the microtask queue to give consumers a chance to
      // await after calling .push
      queueMicrotask(() => {
        if (!this.piped && this.fifo.isEmpty()) {
          // never pushed or piped
          this.onEnd?.(err)
          this.onEnd = undefined

          resolve()
          return
        }

        raceSignal(
          this.fifo.push({ done: true, value: undefined }),
          options?.signal,
          options
        )
          .then(() => { resolve() }, (err) => { reject(err) })
      })
    })
  }

  get readableLength (): number {
    return this.fifo.size
  }

  protected abstract getValues (): Promise<IteratorResult<T, void>>
}

class ItPushable<T> extends AbstractPushable<T> implements Pushable<T> {
  protected async getValues (): Promise<IteratorResult<T, void>> {
    return this.fifo.shift()
  }

  async push (value: T, options?: AbortOptions & RaceSignalOptions): Promise<void> {
    if (this.ended) {
      throw new Error('pushable has already ended')
    }

    await raceSignal(
      this.fifo.push({ done: false, value }),
      options?.signal,
      options
    )
  }
}

class ItPushableV<T> extends AbstractPushable<T[]> implements PushableV<T> {
  protected async getValues (): Promise<IteratorResult<T[], void>> {
    const promises: Array<Promise<IteratorResult<T[]>>> = []

    while (!this.fifo.isEmpty()) {
      promises.push(this.fifo.shift())
    }

    const output: IteratorResult<T[]> = {
      done: false,
      value: []
    }

    for (const result of await Promise.all(promises)) {
      if (result.done === true) {
        if (output.value.length > 0) {
          // we have some values, return them but empty the iterator
          // so we return { done: true } on the subsequent calls to
          // .next()
          this.fifo = new PFIFO()
          this.ended = true
          break
        }

        // did not have any values, just return done result
        return {
          done: true,
          value: undefined
        }
      }

      if (result.value != null) {
        output.value.push(...result.value)
      }
    }

    if (output.value.length === 0) {
      return {
        done: true,
        value: undefined
      }
    }

    return output
  }

  async push (value: T, options?: AbortOptions & RaceSignalOptions): Promise<void> {
    await this.pushV([value], options)
  }

  async pushV (values: T[], options?: AbortOptions & RaceSignalOptions): Promise<void> {
    if (this.ended) {
      throw new Error('pushable has already ended')
    }

    await raceSignal(
      this.fifo.push({ done: false, value: values }),
      options?.signal,
      options
    )
  }
}

export function pushable<T> (options?: PushableOptions): Pushable<T>
export function pushable<T> (options?: PushableOptions): Pushable<T> {
  return new ItPushable<T>(options)
}

export function pushableV<T> (options?: PushableOptions): PushableV<T>
export function pushableV<T> (options?: PushableOptions): PushableV<T> {
  return new ItPushableV<T>(options)
}
