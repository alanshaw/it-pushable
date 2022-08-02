import { expect } from 'aegir/chai'
import { pipe } from 'it-pipe'
import { pushable, pushableV } from '../src/index.js'
import all from 'it-all'
import { Uint8ArrayList } from 'uint8arraylist'

describe('it-pushable', () => {
  it('should push input slowly', async () => {
    const source = pushable<number>({
      objectMode: true
    })
    const input = [1, 2, 3]
    for (let i = 0; i < input.length; i++) {
      setTimeout(() => source.push(input[i]), i * 10)
    }
    setTimeout(() => source.end(), input.length * 10)
    const output = await pipe(source, async (source) => await all(source))
    expect(output).to.deep.equal(input)
  })

  it('should buffer input', async () => {
    const source = pushable<number>({
      objectMode: true
    })
    const input = [1, 2, 3]
    input.forEach(v => source.push(v))
    setTimeout(() => source.end())
    const output = await pipe(source, async (source) => await all(source))
    expect(output).to.deep.equal(input)
  })

  it('should buffer falsy input', async () => {
    const source = pushable<number | undefined | null>({
      objectMode: true
    })
    const input = [1, 2, 3, undefined, null, 0, 4]
    input.forEach(v => source.push(v))
    setTimeout(() => source.end())
    const output = await pipe(source, async (source) => await all(source))
    expect(output).to.deep.equal(input)
  })

  it('should buffer some inputs', async () => {
    const source = pushable<number | number[]>({
      objectMode: true
    })
    const input = [1, [2.1, 2.2, 2.3], 3, 4, 5, [6.1, 6.2, 6.3, 6.4], 7]
    for (let i = 0; i < input.length; i++) {
      setTimeout(() => {
        if (Array.isArray(input[i])) {
          (input[i] as number[]).forEach(v => source.push(v))
        } else {
          source.push(input[i])
        }
      }, i * 10)
    }
    setTimeout(() => source.end(), input.length * 10)
    const output = await pipe(source, async (source) => await all(source))
    // @ts-expect-error
    expect(output).to.deep.equal([].concat.apply([], input))
  })

  it('should allow end before start', async () => {
    const source = pushable<number>({
      objectMode: true
    })
    const input = [1, 2, 3]
    input.forEach(v => source.push(v))
    source.end()
    const output = await pipe(source, async (source) => await all(source))
    expect(output).to.deep.equal(input)
  })

  it('should end with error immediately', async () => {
    const source = pushable<number>({
      objectMode: true
    })
    const input = [1, 2, 3]
    input.forEach(v => source.push(v))
    source.end(new Error('boom'))

    await expect(pipe(source, async (source) => await all(source)))
      .to.eventually.be.rejected.with.property('message', 'boom')
  })

  it('should end with error in the middle', async () => {
    const source = pushable<number | Error>({
      objectMode: true
    })
    const input = [1, new Error('boom'), 3]
    for (let i = 0; i < input.length; i++) {
      setTimeout(() => {
        if (input[i] instanceof Error) {
          source.end(input[i] as Error)
        } else {
          source.push(input[i])
        }
      }, i * 10)
    }
    setTimeout(() => source.end(), input.length * 10)

    await expect(pipe(source, async (source) => await all(source)))
      .to.eventually.be.rejected.with.property('message', 'boom')
  })

  it('should allow end without push', async () => {
    const source = pushable()
    const input: any[] = []
    source.end()
    const output = await pipe(source, async (source) => await all(source))
    expect(output).to.deep.equal(input)
  })

  it('should allow next after end', async () => {
    const source = pushable<number>({
      objectMode: true
    })
    const input = [1]
    source.push(input[0])
    let next = await source.next()
    expect(next.done).to.be.false()
    expect(next.value).to.equal(input[0])
    source.end()
    next = await source.next()
    expect(next.done).to.be.true()
    next = await source.next()
    expect(next.done).to.be.true()
  })

  it('should call onEnd', (done) => {
    const source = pushable<number>({
      objectMode: true,
      onEnd: () => done()
    })
    const input = [1, 2, 3]
    for (let i = 0; i < input.length; i++) {
      setTimeout(() => source.push(input[i]), i * 10)
    }
    setTimeout(() => source.end(), input.length * 10)
    void pipe(source, async (source) => await all(source))
  })

  it('should call onEnd if passed in options object', (done) => {
    const source = pushable<number>({
      objectMode: true,
      onEnd: () => done()
    })
    const input = [1, 2, 3]
    for (let i = 0; i < input.length; i++) {
      setTimeout(() => source.push(input[i]), i * 10)
    }
    setTimeout(() => source.end(), input.length * 10)
    void pipe(source, async (source) => await all(source))
  })

  it('should call onEnd even if not piped', (done) => {
    const source = pushable({
      onEnd: () => done()
    })
    source.end()
  })

  it('should call onEnd with error', (done) => {
    const source = pushable({
      onEnd: err => {
        expect(err).to.have.property('message', 'boom')
        done()
      }
    })
    setTimeout(() => source.end(new Error('boom')), 10)
    void pipe(source, async (source) => await all(source)).catch(() => {})
  })

  it('should call onEnd on return before end', (done) => {
    const input = [1, 2, 3, 4, 5]
    const max = 2
    const output: number[] = []

    const source = pushable<number>({
      objectMode: true,
      onEnd: () => {
        expect(output).to.deep.equal(input.slice(0, max))
        done()
      }
    })

    input.forEach((v, i) => setTimeout(() => source.push(v), i * 10))
    setTimeout(() => source.end(), input.length * 10)

    void (async () => {
      let i = 0
      for await (const value of source) {
        output.push(value)
        i++
        if (i === max) break
      }
    })()
  })

  it('should call onEnd by calling return', (done) => {
    const input = [1, 2, 3, 4, 5]
    const max = 2
    const output: number[] = []

    const source = pushable<number>({
      objectMode: true,
      onEnd: () => {
        expect(output).to.deep.equal(input.slice(0, max))
        done()
      }
    })

    let index = 0
    input.forEach((v, i) => {
      setTimeout(() => {
        source.push(input[index])
        index++
      }, i * 10)
    })
    setTimeout(() => source.end(), input.length * 10)

    void (async () => {
      let i = 0
      while (i !== max) {
        i++
        const { value } = await source.next()

        if (value != null) {
          output.push(value)
        }
      }
      source.return()
    })()
  })

  it('should call onEnd once', (done) => {
    const input = [1, 2, 3, 4, 5]

    let count = 0
    const source = pushable<number>({
      objectMode: true,
      onEnd: () => {
        count++
        expect(count).to.equal(1)
        setTimeout(() => done(), 50)
      }
    })

    input.forEach((v, i) => setTimeout(() => source.push(v), i * 10))

    void (async () => {
      await source.next()
      source.return()
      await source.next()
    })()
  })

  it('should call onEnd by calling throw', (done) => {
    const input = [1, 2, 3, 4, 5]
    const max = 2
    const output: number[] = []

    const source = pushable<number>({
      objectMode: true,
      onEnd: err => {
        expect(err).to.have.property('message', 'boom')
        expect(output).to.deep.equal(input.slice(0, max))
        done()
      }
    })

    input.forEach((v, i) => setTimeout(() => source.push(v), i * 10))
    setTimeout(() => source.end(), input.length * 10)

    void (async () => {
      let i = 0
      while (i !== max) {
        i++
        const { value } = await source.next()

        if (value != null) {
          output.push(value)
        }
      }
      source.throw(new Error('boom'))
    })()
  })

  it('should support writev', async () => {
    const source = pushableV<number>({
      objectMode: true
    })
    const input = [1, 2, 3]
    input.forEach(v => source.push(v))
    setTimeout(() => source.end())
    const output = await pipe(source, async (source) => await all(source))
    expect(output[0]).to.deep.equal(input)
  })

  it('should always yield arrays when using writev', async () => {
    const source = pushableV<number>({
      objectMode: true
    })
    const input = [1, 2, 3]
    setTimeout(() => {
      input.forEach(v => source.push(v))
      setTimeout(() => source.end())
    })
    const output = await pipe(source, async (source) => await all(source))
    output.forEach(v => expect(Array.isArray(v)).to.be.true())
  })

  it('should support writev and end with error', async () => {
    const source = pushableV<number>({
      objectMode: true
    })
    const input = [1, 2, 3]
    input.forEach(v => source.push(v))
    source.end(new Error('boom'))

    await expect(pipe(source, async (source) => await all(source)))
      .to.eventually.be.rejected.with.property('message', 'boom')
  })

  it('should support readableLength for objects', async () => {
    const source = pushable<number>({
      objectMode: true
    })

    expect(source).to.have.property('readableLength', 0)

    await source.push(1)
    expect(source).to.have.property('readableLength', 1)

    await source.push(1)
    expect(source).to.have.property('readableLength', 2)

    await source.next()
    expect(source).to.have.property('readableLength', 1)

    await source.next()
    expect(source).to.have.property('readableLength', 0)
  })

  it('should support readableLength for bytes', async () => {
    const source = pushable()

    expect(source).to.have.property('readableLength', 0)

    await source.push(Uint8Array.from([1, 2]))
    expect(source).to.have.property('readableLength', 2)

    await source.push(Uint8Array.from([3, 4, 5]))
    expect(source).to.have.property('readableLength', 5)

    await source.next()
    expect(source).to.have.property('readableLength', 3)

    await source.next()
    expect(source).to.have.property('readableLength', 0)
  })

  it('should support readableLength for Uint8ArrayLists', async () => {
    const source = pushable<Uint8ArrayList>()

    expect(source).to.have.property('readableLength', 0)

    await source.push(new Uint8ArrayList(Uint8Array.from([1, 2])))
    expect(source).to.have.property('readableLength', 2)

    await source.push(new Uint8ArrayList(Uint8Array.from([3, 4, 5])))
    expect(source).to.have.property('readableLength', 5)

    await source.next()
    expect(source).to.have.property('readableLength', 3)

    await source.next()
    expect(source).to.have.property('readableLength', 0)
  })

  it('should support readableLength for mixed Uint8ArrayLists and Uint8Arrays', async () => {
    const source = pushable<Uint8ArrayList | Uint8Array>()

    expect(source).to.have.property('readableLength', 0)

    await source.push(new Uint8ArrayList(Uint8Array.from([1, 2])))
    expect(source).to.have.property('readableLength', 2)

    await source.push(Uint8Array.from([3, 4, 5]))
    expect(source).to.have.property('readableLength', 5)

    await source.next()
    expect(source).to.have.property('readableLength', 3)

    await source.next()
    expect(source).to.have.property('readableLength', 0)
  })

  it('should throw if passed an object when objectMode is not true', async () => {
    const source = pushable()

    // @ts-expect-error incorrect argument type
    expect(() => source.push('hello')).to.throw().with.property('message').that.includes('tried to push non-Uint8Array value')
  })
})
