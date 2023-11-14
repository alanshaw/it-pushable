import { expect } from 'aegir/chai'
import { FIFO } from '../src/fifo.js'

describe('fifo', () => {
  it('basic', function () {
    const q = new FIFO()
    const values: any[] = [
      1,
      4,
      4,
      0,
      null,
      {},
      Math.random(),
      '',
      'hello',
      9,
      1,
      4,
      5,
      6,
      7,
      null,
      null,
      0,
      0,
      15,
      52.2,
      null
    ]

    expect(q.shift()).to.be.undefined()
    expect(q.isEmpty()).to.be.true()
    expect(q.size).to.equal(0)

    for (const value of values) {
      q.push(value)
    }

    expect(q.size).to.equal(values.length)

    while (!q.isEmpty()) {
      expect(q.shift()).to.deep.equal(values.shift())
      expect(q.size).to.equal(values.length)
    }

    expect(q.shift()).to.be.undefined()
    expect(q.isEmpty()).to.be.true()
  })

  it('long length', function () {
    const q = new FIFO<number>()

    const len = 0x8f7
    for (let i = 0; i < len; i++) {
      q.push(i)
    }

    expect(q.size).to.equal(len)

    let shifts = 0
    while (!q.isEmpty()) {
      q.shift()
      shifts++
    }

    expect(shifts).to.equal(len)
    expect(q.size).to.equal(0)
  })

  it('clear', function () {
    const q = new FIFO<string>()

    q.push('a')
    q.push('a')
    q.clear()

    expect(q.shift()).to.be.undefined()
    expect(q.size).to.equal(0)

    for (let i = 0; i < 50; i++) {
      q.push('a')
    }

    q.clear()

    expect(q.shift()).to.be.undefined()
    expect(q.size).to.equal(0)
  })

  it('basic length', function () {
    const q = new FIFO<string>()

    q.push('a')
    expect(q.size).to.equal(1)

    q.push('a')
    expect(q.size).to.equal(2)

    q.shift()
    expect(q.size).to.equal(1)

    q.shift()
    expect(q.size).to.equal(0)

    q.shift()
    expect(q.size).to.equal(0)
  })

  it('peek', function () {
    const q = new FIFO<string>()

    q.push('a')
    expect(q.size).to.equal(1)
    expect(q.peek()).to.deep.equal('a')
    expect(q.peek()).to.deep.equal('a')

    q.push('b')
    expect(q.size).to.equal(2)
    expect(q.peek()).to.deep.equal('a')
    expect(q.peek()).to.deep.equal('a')

    expect(q.shift()).to.deep.equal('a')
    expect(q.peek()).to.deep.equal('b')
    expect(q.peek()).to.deep.equal('b')

    expect(q.shift()).to.deep.equal('b')
    expect(q.peek()).to.be.undefined()
    expect(q.peek()).to.be.undefined()
  })

  it('peek edgecase', function () {
    const q = new FIFO<string>({ splitLimit: 4 })

    q.push('a')
    q.push('b')
    q.push('c')
    q.push('d')
    q.push('e')

    expect(q.peek()).to.equal(q.shift())
    expect(q.peek()).to.equal(q.shift())
    expect(q.peek()).to.equal(q.shift())
    expect(q.peek()).to.equal(q.shift())
    expect(q.peek()).to.equal(q.shift())
    expect(q.peek()).to.equal(q.shift())
  })

  it('invalid hwm', function () {
    expect(() => new FIFO({ splitLimit: 3 })).to.throw()
  })
})
