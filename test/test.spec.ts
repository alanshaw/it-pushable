import { expect } from 'aegir/chai'
import all from 'it-all'
import { pipe } from 'it-pipe'
import { Uint8ArrayList } from 'uint8arraylist'
import { pushable, pushableV } from '../src/index.js'

describe('it-pushable', () => {
  it('should push input', async () => {
    const source = pushable<number>()
    const input = [1, 2, 3]

    void Promise.resolve().then(async () => {
      for (let i = 0; i < input.length; i++) {
        await source.push(input[i])
      }

      await source.end()
    })

    const output = await all(source)

    expect(output).to.deep.equal(input)
  })

  it('should pull input slowly', async () => {
    const source = pushable<number>()
    const input = [1, 2, 3]

    void Promise.resolve().then(async () => {
      for (let i = 0; i < input.length; i++) {
        await source.push(input[i])
      }

      await source.end()
    })

    const output = await pipe(
      source,
      async function * (source) {
        for await (const value of source) {
          await new Promise<void>((resolve) => {
            setTimeout(() => {
              resolve()
            }, 10)
          })

          yield value
        }
      },
      async (source) => all(source)
    )

    expect(output).to.deep.equal(input)
  })

  it('should push input slowly', async () => {
    const source = pushable<number>()
    const input = [1, 2, 3]
    for (let i = 0; i < input.length; i++) {
      setTimeout(() => {
        void source.push(input[i])
      }, i * 10)
    }
    setTimeout(() => {
      void source.end()
    }, input.length * 10)
    const output = await pipe(source, async (source) => all(source))
    expect(output).to.deep.equal(input)
  })

  it('should buffer input', async () => {
    const source = pushable<number>()
    const input = [1, 2, 3]
    input.forEach(v => {
      void source.push(v)
    })
    setTimeout(() => {
      void source.end()
    })
    const output = await pipe(source, async (source) => all(source))
    expect(output).to.deep.equal(input)
  })

  it('should buffer falsy input', async () => {
    const source = pushable<number | undefined | null>()
    const input = [1, 2, 3, undefined, null, 0, 4]
    input.forEach(v => {
      void source.push(v)
    })
    setTimeout(() => {
      void source.end()
    })
    const output = await pipe(source, async (source) => all(source))
    expect(output).to.deep.equal(input)
  })

  it('should buffer some inputs', async () => {
    const source = pushable<number | number[]>()
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
    const output = await pipe(source, async (source) => all(source))

    expect(output).to.deep.equal(input.flat())
  })

  it('should allow end before start', async () => {
    const source = pushable<number>()
    const input = [1, 2, 3]
    input.forEach(v => {
      void source.push(v)
    })
    void source.end()
    const output = await pipe(source, async (source) => all(source))
    expect(output).to.deep.equal(input)
  })

  it('should end with error immediately', async () => {
    const source = pushable<number>()
    const input = [1, 2, 3]
    input.forEach(v => {
      void source.push(v)
    })
    void source.end(new Error('boom'))

    await expect(pipe(source, async (source) => all(source)))
      .to.eventually.be.rejected.with.property('message', 'boom')
  })

  it('should end with error in the middle', async () => {
    const source = pushable<number | Error>()
    const input = [1, new Error('boom'), 3]
    for (let i = 0; i < input.length; i++) {
      setTimeout(() => {
        if (input[i] instanceof Error) {
          void source.end(input[i] as Error)
        } else {
          void source.push(input[i]).catch(() => {})
        }
      }, i * 10)
    }
    setTimeout(() => {
      void source.end()
    }, input.length * 10)

    await expect(pipe(source, async (source) => all(source)))
      .to.eventually.be.rejected.with.property('message', 'boom')
  })

  it('should allow end without push', async () => {
    const source = pushable()
    const input: any[] = []
    void source.end()
    const output = await pipe(source, async (source) => all(source))
    expect(output).to.deep.equal(input)
  })

  it('should allow next after end', async () => {
    const source = pushable<number>()
    const input = [1]
    void source.push(input[0])
    let next = await source.next()
    expect(next.done).to.be.false()
    expect(next.value).to.equal(input[0])
    void source.end()
    next = await source.next()
    expect(next.done).to.be.true()
    next = await source.next()
    expect(next.done).to.be.true()
  })

  it('should call onEnd', (done) => {
    const source = pushable<number>({
      onEnd: () => { done() }
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
    void pipe(source, async (source) => all(source))
  })

  it('should call onEnd if passed in options object', (done) => {
    const source = pushable<number>({
      onEnd: () => { done() }
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
    void pipe(source, async (source) => all(source))
  })

  it('should call onEnd even if not piped', (done) => {
    const source = pushable({
      onEnd: () => { done() }
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
    void pipe(source, async (source) => all(source)).catch(() => {})
  })

  it('should call onEnd on return before end', (done) => {
    const input = [1, 2, 3, 4, 5]
    const max = 2
    const output: number[] = []

    const source = pushable<number>({
      onEnd: () => {
        expect(output).to.deep.equal(input.slice(0, max))
        done()
      }
    })

    input.forEach((v, i) => setTimeout(() => {
      source.push(v).catch(() => {})
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
      }
    })

    let index = 0
    input.forEach((v, i) => {
      setTimeout(() => {
        source.push(input[index]).catch(() => {})
        index++
      }, i * 10)
    })
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
    const source = pushable<number>({
      onEnd: () => {
        count++
        expect(count).to.equal(1)
        setTimeout(() => { done() }, 50)
      }
    })

    input.forEach((v, i) => setTimeout(() => {
      source.push(v).catch(() => {})
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
      }
    })

    input.forEach((v, i) => setTimeout(() => {
      void source.push(v).catch(() => {})
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

  it('should not allow push after end', async () => {
    const source = pushable<string>()
    await source.end()

    await expect(source.push('hello')).to.eventually.be.rejected
      .with.property('message').that.matches(/already ended/)
  })

  it('should end with error immediately', async () => {
    const source = pushable<number>()

    void Promise.resolve().then(async () => {
      await source.end(new Error('boom'))
    })

    await expect(all(source))
      .to.eventually.be.rejected.with.property('message', 'boom')
  })

  it('should end with error in the middle', async () => {
    const source = pushable<number | Error>()
    const input = [1, new Error('boom'), 3]

    void Promise.resolve().then(async () => {
      for (let i = 0; i < input.length; i++) {
        const value = input[i]

        if (value instanceof Error) {
          await source.end(value)
        } else {
          await source.push(value).catch(() => {})
        }
      }
    })

    await expect(pipe(source, async (source) => all(source)))
      .to.eventually.be.rejected.with.property('message', 'boom')
  })

  it('should call onEnd', (done) => {
    const source = pushable<number>({
      onEnd: () => { done() }
    })
    const input = [1, 2, 3]

    void Promise.resolve().then(async () => {
      for (let i = 0; i < input.length; i++) {
        await source.push(input[i])
      }

      await source.end()
    })

    void all(source)
  })

  it('should call onEnd even if not piped', (done) => {
    const source = pushable({
      onEnd: () => { done() }
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
    void pipe(source, async (source) => all(source)).catch(() => {})
  })

  it('should call onEnd by calling return', (done) => {
    const input = [1, 2, 3, 4, 5]

    const source = pushable<number>({
      onEnd: () => {
        done()
      }
    })

    void Promise.resolve().then(async () => {
      for (let i = 0; i < input.length; i++) {
        await source.push(input[i])
      }

      await source.return()
    })

    void all(source)
  })

  it('should call onEnd once', (done) => {
    const input = [1, 2, 3, 4, 5]

    let count = 0
    const source = pushable<number>({
      onEnd: () => {
        count++
        expect(count).to.equal(1)
        setTimeout(() => { done() }, 50)
      }
    })

    input.forEach((v, i) => setTimeout(() => {
      source.push(v).catch(() => {})
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
      }
    })

    input.forEach((v, i) => setTimeout(() => {
      source.push(v).catch(() => {})
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

  it('should read all available values', async () => {
    const source = pushableV<number>()
    const input = [1, 2, 3]
    input.forEach(v => {
      void source.push(v)
    })
    setTimeout(() => {
      void source.end()
    })
    const output = await pipe(source, async (source) => all(source))
    expect(output[0]).to.deep.equal(input)
  })

  it('should support pushV', async () => {
    const source = pushableV<number>()
    const input = [1, 2, 3]
    void source.pushV(input)
    setTimeout(() => {
      void source.end()
    })
    const output = await pipe(source, async (source) => all(source))
    expect(output[0]).to.deep.equal(input)
  })

  it('should always yield arrays when using writev', async () => {
    const source = pushableV<number>()
    const input = [1, 2, 3]
    setTimeout(() => {
      input.forEach(v => {
        void source.push(v)
      })
      setTimeout(() => {
        void source.end()
      })
    })
    const output = await pipe(source, async (source) => all(source))
    output.forEach(v => expect(Array.isArray(v)).to.be.true())
  })

  it('should support writev and end with error', async () => {
    const source = pushableV<number>()
    const input = [1, 2, 3]
    input.forEach(v => {
      void source.push(v)
    })
    void source.end(new Error('boom'))

    await expect(pipe(source, async (source) => all(source)))
      .to.eventually.be.rejected.with.property('message', 'boom')
  })

  it('should support readableLength for objects', async () => {
    const source = pushable<number>()

    expect(source).to.have.property('readableLength', 0)

    void source.push(1)
    expect(source).to.have.property('readableLength', 1)

    void source.push(1)
    expect(source).to.have.property('readableLength', 2)

    await source.next()
    expect(source).to.have.property('readableLength', 1)

    await source.next()
    expect(source).to.have.property('readableLength', 0)
  })

  it('should support readableLength for bytes', async () => {
    const source = pushable()

    expect(source).to.have.property('readableLength', 0)

    void source.push(Uint8Array.from([1, 2]))
    expect(source).to.have.property('readableLength', 2)

    void source.push(Uint8Array.from([3, 4, 5]))
    expect(source).to.have.property('readableLength', 5)

    await source.next()
    expect(source).to.have.property('readableLength', 3)

    await source.next()
    expect(source).to.have.property('readableLength', 0)
  })

  it('should support readableLength for Uint8ArrayLists', async () => {
    const source = pushable<Uint8ArrayList>()

    expect(source).to.have.property('readableLength', 0)

    void source.push(new Uint8ArrayList(Uint8Array.from([1, 2])))
    expect(source).to.have.property('readableLength', 2)

    void source.push(new Uint8ArrayList(Uint8Array.from([3, 4, 5])))
    expect(source).to.have.property('readableLength', 5)

    await source.next()
    expect(source).to.have.property('readableLength', 3)

    await source.next()
    expect(source).to.have.property('readableLength', 0)
  })

  it('should support readableLength for mixed Uint8ArrayLists and Uint8Arrays', async () => {
    const source = pushable<Uint8ArrayList | Uint8Array>()

    expect(source).to.have.property('readableLength', 0)

    void source.push(new Uint8ArrayList(Uint8Array.from([1, 2])))
    expect(source).to.have.property('readableLength', 2)

    void source.push(Uint8Array.from([3, 4, 5]))
    expect(source).to.have.property('readableLength', 5)

    await source.next()
    expect(source).to.have.property('readableLength', 3)

    await source.next()
    expect(source).to.have.property('readableLength', 0)
  })

  it('should allow aborting the awaiting of a push', async () => {
    const source = pushable<number>()

    await expect(source.push(5, {
      signal: AbortSignal.timeout(10),
      errorCode: 'TOOK_AGES'
    })).to.eventually.be.rejected.with.property('code', 'TOOK_AGES')
  })

  it('should allow aborting the awaiting of an end', async () => {
    const source = pushable<number>()
    void source.push(5)

    await expect(source.end(undefined, {
      signal: AbortSignal.timeout(10),
      errorCode: 'TOOK_AGES'
    })).to.eventually.be.rejected.with.property('code', 'TOOK_AGES')
  })
})
