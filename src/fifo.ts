// ported from https://www.npmjs.com/package/fast-fifo

class FixedFIFO<T> {
  public buffer: Array<T | undefined>
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

  push (data: T) {
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

export class FIFO<T> {
  private readonly hwm: number
  private head: FixedFIFO<T>
  private tail: FixedFIFO<T>

  constructor (hwm?: number) {
    this.hwm = hwm ?? 16
    this.head = new FixedFIFO<T>(this.hwm)
    this.tail = this.head
  }

  push (val: T) {
    if (!this.head.push(val)) {
      const prev = this.head
      this.head = prev.next = new FixedFIFO<T>(2 * this.head.buffer.length)
      this.head.push(val)
    }
  }

  shift () {
    const val = this.tail.shift()

    if (val === undefined && (this.tail.next != null)) {
      const next = this.tail.next
      this.tail.next = null
      this.tail = next
      return this.tail.shift()
    }

    return val
  }

  isEmpty () {
    return this.head.isEmpty()
  }
}
