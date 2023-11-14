import { expect } from 'aegir/chai'
import { PFIFO } from '../src/p-fifo.js'

const randomInt = (min: number, max: number): number => {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min)) + min
}

describe('pfifo', () => {
  it('should await for shift', async () => {
    const fifo = new PFIFO<number>()
    const input = Math.random()

    setTimeout(() => {
      void fifo.push(input)
    }, 10)

    await expect(fifo.shift()).to.eventually.equal(input)
  })

  it('should await for push', async () => {
    const fifo = new PFIFO<number>()
    const input = Math.random()

    setTimeout(() => {
      void fifo.shift().then(output => {
        expect(output).to.equal(input)
      })
    }, 10)

    await fifo.push(input)
  })

  it('should consume values in parallel from a full buffer', async () => {
    const fifo = new PFIFO<number>()
    const input = Array.from(Array(randomInt(5, 100)), () => Math.random())

    input.forEach(v => {
      void fifo.push(v)
    })

    const output = await Promise.all(input.map(async () => fifo.shift()))

    expect(output).to.deep.equal(input)
  })

  it('should await all pushed values', async () => {
    const fifo = new PFIFO()
    const input = Array.from(Array(randomInt(5, 100)), () => Math.random())

    const pushPromises = input.map(async v => fifo.push(v))

    setTimeout(() => {
      input.slice(0, -1).forEach(() => {
        void fifo.shift()
      })
    }, 10)

    setTimeout(() => {
      expect(fifo.isEmpty()).to.be.false()
      input.slice(-1).forEach(() => {
        void fifo.shift()
      })
    }, 50)

    await Promise.all(pushPromises)
  })
})
