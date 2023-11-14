// ported from https://www.npmjs.com/package/p-fifo

import defer from 'p-defer'
import { FIFO } from './fifo.js'

interface Consumer<T> {
  resolve(value?: T | PromiseLike<T> | undefined): void
}

interface Chunk<T> {
  chunk: T
  resolve(value?: T): void
}

function calculateSize (obj: any): number {
  if (obj?.chunk?.value?.byteLength != null) {
    return obj.chunk.value.byteLength
  }

  return 1
}

export class PFIFO<T> {
  private readonly buffer: FIFO<Chunk<T>>
  private readonly waitingConsumers: FIFO<Consumer<T>>

  constructor () {
    this.buffer = new FIFO({
      calculateSize
    })
    this.waitingConsumers = new FIFO()
  }

  async push (chunk: T): Promise<T> {
    const { promise, resolve } = defer<T>()
    this.buffer.push({ chunk, resolve })
    this._consume()
    return promise
  }

  _consume (): void {
    while (!this.waitingConsumers.isEmpty() && !this.buffer.isEmpty()) {
      const nextConsumer = this.waitingConsumers.shift()

      if (nextConsumer == null) {
        return
      }

      const nextChunk = this.buffer.shift()

      if (nextChunk == null) {
        return
      }

      nextConsumer.resolve(nextChunk.chunk)
      nextChunk.resolve()
    }
  }

  async shift (): Promise<T> {
    const { promise, resolve } = defer<T>()
    this.waitingConsumers.push({ resolve })
    this._consume()
    return promise
  }

  isEmpty (): boolean {
    return this.buffer.isEmpty()
  }

  get size (): number {
    return this.buffer.size
  }
}
