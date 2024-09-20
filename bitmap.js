// u8 -> number of 1s LUT
const bitCountLUT = [...Array(256)].map((r = 0, a) => {
    for (; a; a >>= 1) r += 1 & a
    return r
  })
  
  function countOnes(array) {
    let count = 0
    for (let i = 0; i < array.length; i++) {
      count += bitCountLUT[array[i]]
    }
    return count
  }
  
exports.Bitmap = class Bitmap {
    checkedCount = 0
  
    subscribers = new Set()
  
    constructor(bitCount) {
      this.bitCount = bitCount
      const byteCount = Math.ceil(bitCount / 8)
      this.bytes = new Uint8Array(byteCount)
    }
  
    get(index) {
      const byteIndex = index >> 3
      const bitIndex = index & 7
      return (this.bytes[byteIndex] & (1 << bitIndex)) !== 0
    }
  
    set(index, value) {
      const byteIndex = index >> 3
      const bitIndex = index & 7
  
      let b = this.bytes[byteIndex]
      this.checkedCount -= bitCountLUT[b]
  
      b &= ~(1 << bitIndex)
  
      if (value) {
        b |= 1 << bitIndex
      }
  
      this.bytes[byteIndex] = b
      this.checkedCount += bitCountLUT[b]
    }
  
    fullStateUpdate(bitmap) {
      this.bytes.set(bitmap)
      this.checkedCount = countOnes(bitmap)
      this.fireChange()
    }
  
    partialStateUpdate(offset, chunk) {
      for (let i = 0; i < chunk.length; i++) {
        const byteIndex = offset + i
        const b = this.bytes[byteIndex]
        this.checkedCount -= bitCountLUT[b]
        this.bytes[byteIndex] = chunk[i]
        this.checkedCount += bitCountLUT[chunk[i]]
      }
      this.fireChange(offset * 8, (offset + chunk.length) * 8)
    }
  
    fireChange(rangeMin = 0, rangeMax = this.bitCount) {
      for (const subscriber of this.subscribers) {
        subscriber(rangeMin, rangeMax)
      }
    }
  
    subscribeToChanges(callback) {
      this.subscribers.add(callback)
    }
  
    unsubscribeFromChanges(callback) {
      this.subscribers.delete(callback)
    }
  }
  