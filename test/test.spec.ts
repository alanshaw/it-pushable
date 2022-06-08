import { expect } from 'aegir/chai'
import { pipe } from 'it-pipe'
import { pushable, pushableV } from '../src/index.js'
import all from 'it-all'

describe('it-pushable', () => {
  it('should push input slowly', async () => {
    const source = pushable<number>({
      objectMode: true
    })
    const input = [1, 2, 3]
    for (let i = 0; i < input.length; i++) {
      setTimeout(() => {
        void source.push(input[i])
      }, i * 10)
    }
    setTimeout(() => {
      void source.end()
    }, input.length * 10)
    const output = await pipe(source, async (source) => await all(source))
    expect(output).to.deep.equal(input)
  })

  it('should buffer input', async () => {
    const source = pushable({
      objectMode: true
    })
    const input = [1, 2, 3]
    input.forEach(v => {
      void source.push(v)
    })
    setTimeout(() => {
      void source.end()
    })
    const output = await pipe(source, async (source) => await all(source))
    expect(output).to.deep.equal(input)
  })

  it('should buffer falsy input', async () => {
    const source = pushable({
      objectMode: true
    })
    const input = [1, 2, 3, undefined, null, 0, 4]
    input.forEach(v => {
      void source.push(v)
    })
    setTimeout(() => {
      void source.end()
    })
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
          (input[i] as number[]).forEach(v => {
            void source.push(v)
          })
        } else {
          void source.push(input[i])
        }
      }, i * 10)
    }
    setTimeout(() => {
      void source.end()
    }, input.length * 10)
    const output = await pipe(source, async (source) => await all(source))
    // @ts-expect-error
    expect(output).to.deep.equal([].concat.apply([], input))
  })

  it('should allow end before start', async () => {
    const source = pushable({
      objectMode: true
    })
    const input = [1, 2, 3]
    input.forEach(v => {
      void source.push(v)
    })
    await source.end()
    const output = await pipe(source, async (source) => await all(source))
    expect(output).to.deep.equal(input)
  })

  it('should end with error immediately', async () => {
    const source = pushable<number>({
      objectMode: true
    })
    const input = [1, 2, 3]
    input.forEach(v => {
      void source.push(v)
    })
    await source.end(new Error('boom'))

    await expect(pipe(source, all))
      .to.eventually.be.rejected.with.property('message', 'boom')
  })

  it('should end with error in the middle', async () => {
    const source = pushable({
      objectMode: true
    })
    const input = [1, new Error('boom'), 3]
    for (let i = 0; i < input.length; i++) {
      setTimeout(() => {
        if (input[i] instanceof Error) {
          void source.end(input[i] as Error)
        } else {
          void source.push(input[i])
        }
      }, i * 10)
    }
    setTimeout(() => {
      void source.end()
    }, input.length * 10)

    await expect(pipe(source, async (source) => await all(source)))
      .to.eventually.be.rejected.with.property('message', 'boom')
  })

  it('should allow end without push', async () => {
    const source = pushable()
    const input: any[] = []
    await source.end()
    const output = await pipe(source, async (source) => await all(source))
    expect(output).to.deep.equal(input)
  })

  it('should allow next after end', async () => {
    const source = pushable<number>({
      objectMode: true
    })
    const input = [1]
    await source.push(input[0])
    let next = await source.next()
    expect(next.done).to.be.false()
    expect(next.value).to.equal(input[0])
    await source.end()
    next = await source.next()
    expect(next.done).to.be.true()
    next = await source.next()
    expect(next.done).to.be.true()
  })

  it('should call onEnd', (done) => {
    const source = pushable({
      onEnd: () => done(),
      objectMode: true
    })
    const input = [1, 2, 3]
    for (let i = 0; i < input.length; i++) {
      setTimeout(() => {
        void source.push(input[i])
      }, i * 10)
    }
    setTimeout(() => {
      void source.end()
    }, input.length * 10)
    void pipe(source, async (source) => await all(source))
  })

  it('should call onEnd if passed in options object', (done) => {
    const source = pushable({
      onEnd: () => done(),
      objectMode: true
    })
    const input = [1, 2, 3]
    for (let i = 0; i < input.length; i++) {
      setTimeout(() => {
        void source.push(input[i])
      }, i * 10)
    }
    setTimeout(() => {
      void source.end()
    }, input.length * 10)
    void pipe(source, async (source) => await all(source))
  })

  it('should call onEnd even if not piped', (done) => {
    const source = pushable({
      onEnd: () => done()
    })
    void source.end()
  })

  it('should call onEnd with error', (done) => {
    const source = pushable({
      onEnd: err => {
        expect(err).to.have.property('message', 'boom')
        done()
      }
    })
    setTimeout(() => {
      void source.end(new Error('boom'))
    }, 10)
    void pipe(source, async (source) => await all(source)).catch(() => {})
  })

  it('should call onEnd on return before end', (done) => {
    const input = [1, 2, 3, 4, 5]
    const max = 2
    const output: number[] = []

    const source = pushable<number>({
      onEnd: () => {
        expect(output).to.deep.equal(input.slice(0, max))
        done()
      },
      objectMode: true
    })

    input.forEach((v, i) => setTimeout(() => {
      void source.push(v)
    }, i * 10))
    setTimeout(() => {
      void source.end()
    }, input.length * 10)

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
      onEnd: () => {
        expect(output).to.deep.equal(input.slice(0, max))
        done()
      },
      objectMode: true
    })

    input.forEach((v, i) => setTimeout(() => {
      void source.push(v)
    }, i * 10))
    setTimeout(() => {
      void source.end()
    }, input.length * 10)

    void (async () => {
      let i = 0
      while (i !== max) {
        i++
        const { value } = await source.next()

        if (value != null) {
          output.push(value)
        }
      }
      await source.return()
    })()
  })

  it('should call onEnd once', (done) => {
    const input = [1, 2, 3, 4, 5]

    let count = 0
    const source = pushable({
      onEnd: () => {
        count++
        expect(count).to.equal(1)
        setTimeout(() => done(), 50)
      },
      objectMode: true
    })

    input.forEach((v, i) => setTimeout(() => {
      void source.push(v)
    }, i * 10))

    void (async () => {
      await source.next()
      await source.return()
      await source.next()
    })()
  })

  it('should call onEnd by calling throw', (done) => {
    const input = [1, 2, 3, 4, 5]
    const max = 2
    const output: number[] = []

    const source = pushable<number>({
      onEnd: err => {
        expect(err).to.have.property('message', 'boom')
        expect(output).to.deep.equal(input.slice(0, max))
        done()
      },
      objectMode: true
    })

    input.forEach((v, i) => setTimeout(() => {
      void source.push(v)
    }, i * 10))
    setTimeout(() => {
      void source.end()
    }, input.length * 10)

    void (async () => {
      let i = 0
      while (i !== max) {
        i++
        const { value } = await source.next()

        if (value != null) {
          output.push(value)
        }
      }
      await source.throw(new Error('boom'))
    })()
  })

  it('should support writev', async () => {
    const source = pushableV<number>({
      objectMode: true
    })
    const input = [1, 2, 3]
    input.forEach(v => {
      void source.push(v)
    })
    setTimeout(() => {
      void source.end()
    })
    const output = await pipe(source, async (source) => await all(source))
    expect(output[0]).to.deep.equal(input)
  })

  it('should always yield arrays when using writev', async () => {
    const source = pushableV<number>({
      objectMode: true
    })
    const input = [1, 2, 3]
    setTimeout(() => {
      input.forEach(v => {
        void source.push(v)
      })
      setTimeout(() => {
        void source.end()
      })
    })
    const output = await pipe(source, async (source) => await all(source))
    output.forEach(v => expect(Array.isArray(v)).to.be.true())
  })

  it('should support writev and end with error', async () => {
    const source = pushableV<number>({
      objectMode: true
    })
    const input = [1, 2, 3]
    input.forEach(v => {
      void source.push(v)
    })
    await source.end(new Error('boom'))

    await expect(pipe(source, async (source) => await all(source)))
      .to.eventually.be.rejected.with.property('message', 'boom')
  })

  it('should support a high water mark for objects', async () => {
    const highWaterMark = 5
    const source = pushable<number>({
      objectMode: true,
      highWaterMark
    })

    for (let i = 0; i < highWaterMark; i++) {
      await source.push(1)
    }

    const p = source.push(5)

    // should not resolve immediately
    await expect(pTimeout(p, 100)).to.be.rejectedWith('timeout')

    // read from the queue
    await source.next()

    // should resolve now we've freed up space in the queue
    await expect(p).to.eventually.equal(source)
  })

  it('should support a high water mark for bytes', async () => {
    const highWaterMark = 5
    const source = pushable({
      highWaterMark
    })

    await source.push(new Uint8Array(highWaterMark))

    const p = source.push(new Uint8Array(5))

    // should not resolve immediately
    await expect(pTimeout(p, 100)).to.be.rejectedWith('timeout')

    // read from the queue
    await source.next()

    // should resolve now we've freed up space in the queue
    await expect(p).to.eventually.equal(source)
  })

  it('should throw if passed an object when objectMode is false', async () => {
    const source = pushable()

    // @ts-expect-error incorrect argument type
    await expect(source.push('hello')).to.eventually.be.rejected.with.property('message').that.includes('tried to push non-Uint8Array value')
  })
})

async function pTimeout <T> (p: Promise<T>, timeout: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        reject(new Error('timeout'))
      }, timeout)
    })
  ])
}
