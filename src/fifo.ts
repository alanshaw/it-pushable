import defer, { DeferredPromise } from 'p-defer'

export interface Next<T> {
  done?: boolean
  error?: Error
  value?: T
}

export type NextResult<T> = { done: false, value: T} | { done: true }

export interface FIFOOptions {
  highWaterMark?: number
  objectMode?: boolean
}

export class FIFO<T> {
  private readonly objectMode: boolean
  private readonly highWaterMark: number
  private queue: Array<Next<T>>
  private deferred?: DeferredPromise<void>
  private size: number

  constructor (options: FIFOOptions = {}) {
    this.objectMode = Boolean(options.objectMode)
    this.highWaterMark = options.highWaterMark ?? Infinity
    this.queue = []
    this.size = 0
  }

  async push (val: Next<T>) {
    if (this.size < this.highWaterMark) {
      this.queue.push(val)

      if (val.done === false) {
        if (this.objectMode) {
          this.size++
        } else if (val.value instanceof Uint8Array) {
          this.size += val.value.byteLength
        } else {
          throw new Error('objectMode was false but tried to push non-Uint8Array value')
        }
      }

      return
    }

    // wait for a slot in the queue to become available
    if (this.deferred == null) {
      this.deferred = defer()
    }

    await this.deferred.promise

    // try again
    await this.push(val)
  }

  shift (): Next<T> | undefined {
    const val = this.queue.shift()

    if (val === undefined) {
      return undefined
    }

    if (val.done === false) {
      if (this.objectMode) {
        this.size--
      } else if (val.value instanceof Uint8Array) {
        this.size -= val.value.byteLength
      } else {
        throw new Error('objectMode was false but tried to shift non-Uint8Array value')
      }
    }

    if (this.deferred != null) {
      this.deferred.resolve()
      this.deferred = undefined
    }

    return val
  }

  isEmpty () {
    return this.queue.length === 0
  }

  clear () {
    if (this.deferred != null) {
      this.deferred.resolve()
      this.deferred = undefined
    }

    this.queue = []
    this.size = 0
  }
}
