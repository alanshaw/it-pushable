// ported from https://www.npmjs.com/package/fast-fifo

export interface Next<T> {
  done?: boolean
  error?: Error
  value?: T
}
class FixedFIFO<T> {
  public buffer: Array<Next<T> | undefined>
  private readonly mask: number
  private top: number
  private btm: number
  public next: FixedFIFO<T> | null

  constructor (hwm: number) {
    if (!(hwm > 0) || ((hwm - 1) & hwm) !== 0) {
      throw new Error('Max size for a FixedFIFO should be a power of two')
    }

    this.buffer = new Array(hwm)
    this.mask = hwm - 1
    this.top = 0
    this.btm = 0
    this.next = null
  }

  push (data: Next<T>) {
    if (this.buffer[this.top] !== undefined) {
      return false
    }

    this.buffer[this.top] = data
    this.top = (this.top + 1) & this.mask

    return true
  }

  shift () {
    const last = this.buffer[this.btm]

    if (last === undefined) {
      return undefined
    }

    this.buffer[this.btm] = undefined
    this.btm = (this.btm + 1) & this.mask
    return last
  }

  isEmpty () {
    return this.buffer[this.btm] === undefined
  }
}

export interface FIFOOptions {
  /**
   * When the queue reaches this size, it will be split into head/tail parts
   */
  splitLimit?: number

  /**
   * If true, `size` will be the number of items in the queue. If false, all
   * values will be interpreted as Uint8Arrays and `size` will be the total
   * number of bytes in the queue.
   */
  objectMode?: boolean
}

export class FIFO<T> {
  public size: number
  private readonly hwm: number
  private head: FixedFIFO<T>
  private tail: FixedFIFO<T>
  private readonly objectMode: boolean

  constructor (options: FIFOOptions = {}) {
    this.hwm = options.splitLimit ?? 16
    this.head = new FixedFIFO<T>(this.hwm)
    this.tail = this.head
    this.size = 0
    this.objectMode = Boolean(options.objectMode)
  }

  push (val: Next<T>) {
    if (val?.value != null) {
      if (this.objectMode) {
        if (val.value != null) {
          this.size++
        }
      } else if (val.value instanceof Uint8Array) {
        this.size += val.value.byteLength
      } else {
        throw new Error('objectMode was false but tried to push non-Uint8Array value')
      }
    }

    if (!this.head.push(val)) {
      const prev = this.head
      this.head = prev.next = new FixedFIFO<T>(2 * this.head.buffer.length)
      this.head.push(val)
    }
  }

  shift () {
    let val = this.tail.shift()

    if (val === undefined && (this.tail.next != null)) {
      const next = this.tail.next
      this.tail.next = null
      this.tail = next
      val = this.tail.shift()
    }

    if (val?.value != null) {
      if (this.objectMode) {
        this.size--
      } else if (val.value instanceof Uint8Array) {
        this.size -= val.value.byteLength
      } else {
        throw new Error('objectMode was false but tried to shift non-Uint8Array value')
      }
    }

    return val
  }

  isEmpty () {
    return this.head.isEmpty()
  }
}
