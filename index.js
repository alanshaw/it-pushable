module.exports = () => {
  let buffer = []
  let onNext, ended

  const waitNext = () => {
    if (buffer.length) return buffer.shift()
    if (ended) return { done: true }

    return new Promise(resolve => {
      onNext = next => {
        onNext = null
        resolve(next)
        return pusher
      }
    })
  }

  const bufferNext = next => {
    if (onNext) return onNext(Promise.resolve(next))
    buffer.push(Promise.resolve(next))
    return pusher
  }

  const bufferError = err => {
    buffer = []
    if (onNext) return onNext(Promise.reject(err))
    buffer.push(Promise.reject(err))
    return pusher
  }

  const pusher = {
    [Symbol.asyncIterator]: () => pusher,
    next: waitNext,
    push: value => bufferNext({ done: false, value }),
    end: err => {
      ended = true
      return err ? bufferError(err) : bufferNext({ done: true })
    }
  }

  return pusher
}
