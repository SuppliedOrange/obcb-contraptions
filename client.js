const { Bitmap } = require('./bitmap.js');
const WebSocket = require('ws')

let PROTOCOL_VERSION = 1
let CHUNK_SIZE = 64 * 64 * 64
let CHUNK_SIZE_BYTES = CHUNK_SIZE / 8
let CHUNK_COUNT = 64 * 64
let BITMAP_SIZE = CHUNK_SIZE * CHUNK_COUNT
let UPDATE_CHUNK_SIZE = 32

exports.PROTOCOL_VERSION = PROTOCOL_VERSION
exports.CHUNK_SIZE = CHUNK_SIZE
exports.CHUNK_SIZE_BYTES = CHUNK_SIZE_BYTES
exports.CHUNK_COUNT = CHUNK_COUNT
exports.BITMAP_SIZE = CHUNK_SIZE * CHUNK_COUNT
exports.UPDATE_CHUNK_SIZE = UPDATE_CHUNK_SIZE

let MessageType;
exports.MessageType = MessageType;

;(function(MessageType) {
  MessageType[(MessageType["Hello"] = 0)] = "Hello"
  MessageType[(MessageType["Stats"] = 1)] = "Stats"
  MessageType[(MessageType["ChunkFullStateRequest"] = 16)] =
    "ChunkFullStateRequest"
  MessageType[(MessageType["ChunkFullStateResponse"] = 17)] =
    "ChunkFullStateResponse"
  MessageType[(MessageType["PartialStateUpdate"] = 18)] = "PartialStateUpdate"
  MessageType[(MessageType["ToggleBit"] = 19)] = "ToggleBit"
  MessageType[(MessageType["PartialStateSubscription"] = 20)] =
    "PartialStateSubscription"
})(MessageType || (MessageType = {}))

exports.BitmapClient = class BitmapClient {
  goToCheckboxCallback = () => {}
  loadingCallback = () => {}
  highlightedIndex = -1
  websocketOpen = false

  websocket = null
  currentChunkIndex = 0
  chunkLoaded = false

  constructor() {
    this.bitmap = new Bitmap(CHUNK_SIZE)
    this.openWebSocket()
  }

  isChecked(globalIndex) {
    const localIndex = globalIndex % CHUNK_SIZE
    return this.bitmap.get(localIndex)
  }

  toggle(globalIndex) {
    const localIndex = globalIndex % CHUNK_SIZE
    // console.log("Toggling", globalIndex);
    this.send({ msg: MessageType.ToggleBit, index: globalIndex })
    this.bitmap.set(localIndex, !this.bitmap.get(localIndex))
  }

  get chunkIndex() {
    return this.currentChunkIndex
  }

  setChunkIndex(chunkIndex) {
    this.currentChunkIndex = chunkIndex
    this.chunkLoaded = false
    this.loadingCallback(true)
    this.send({ msg: MessageType.PartialStateSubscription, chunkIndex })
    this.send({ msg: MessageType.ChunkFullStateRequest, chunkIndex })
  }

  getUint8Array() {
    return this.bitmap.bytes
  }

  openWebSocket() {
    console.log("Connecting to server")
    if (this.websocket) {
      this.websocketOpen = false
      this.websocket.close()
    }

    const ws = new WebSocket("wss://bitmap-ws.alula.me/")
    ws.binaryType = "arraybuffer"
    this.websocket = ws

    ws.addEventListener("open", () => {
      this.websocketOpen = true
      console.log("Connected to server")
      this.onOpen()
    })

    ws.addEventListener("message", message => {
      if (message.data instanceof ArrayBuffer) {
        const msg = this.deserialize(message.data)
        if (msg) this.onMessage(msg)
      }
    })

    ws.addEventListener("close", () => {
      console.log("Disconnected from server")
      this.websocketOpen = false
      this.websocket = null
      setTimeout(() => this.openWebSocket(), 5000)
    })

    ws.addEventListener("error", err => {
      this.websocketOpen = false
      console.error(err)
    })
  }

  onOpen() {}

  onMessage(msg) {
    // console.log("Received message", msg);

    if (msg.msg === MessageType.Hello) {
      if (msg.versionMajor !== PROTOCOL_VERSION) {
        this.websocket?.close()
        alert("Incompatible protocol version")
      }

      const chunkIndex = this.chunkIndex

      this.send({ msg: MessageType.PartialStateSubscription, chunkIndex })
      this.send({ msg: MessageType.ChunkFullStateRequest, chunkIndex })
    } else if (msg.msg === MessageType.ChunkFullStateResponse) {
      const fullState = msg
      if (fullState.chunkIndex !== this.chunkIndex) return

      this.bitmap.fullStateUpdate(fullState.bitmap)
      this.chunkLoaded = true
      this.loadingCallback(false)
    } else if (msg.msg === MessageType.PartialStateUpdate) {
      const partialState = msg
      // console.log("Partial state update", partialState);

      const chunkIndex = Math.floor(partialState.offset / CHUNK_SIZE_BYTES)
      if (chunkIndex !== this.chunkIndex) return
      const byteOffset = partialState.offset % CHUNK_SIZE_BYTES

      this.bitmap.partialStateUpdate(byteOffset, partialState.chunk)
    }
  }

  deserialize(data) {
    const payload = new Uint8Array(data)
    const dataView = new DataView(data)

    const msg = payload[0]

    if (msg === MessageType.Hello) {
      const versionMajor = dataView.getUint16(1, true)
      const versionMinor = dataView.getUint16(3, true)

      return {
        msg,
        versionMajor,
        versionMinor
      }
    } else if (msg === MessageType.Stats) {
      const currentClients = dataView.getUint32(1, true)

      return {
        msg,
        currentClients
      }
    } else if (msg === MessageType.ChunkFullStateResponse) {
      const chunkIndex = dataView.getUint16(1, true)
      const bitmap = payload.slice(3)

      return {
        msg,
        chunkIndex,
        bitmap
      }
    } else if (msg === MessageType.PartialStateUpdate) {
      const offset = dataView.getUint32(1, true)
      const chunk = payload.slice(5)

      return {
        msg,
        offset,
        chunk
      }
    } else {
      return undefined
    }
  }

  send(msg) {
    if (!this.websocket) return

    const data = this.serialize(msg)
    try {
      this.websocket.send(data)
    } catch (err) {
      if (err.toString().includes("readyState 0")) return
      console.log(err)
    }
  }

  serialize(msg) {
    if (
      msg.msg === MessageType.ChunkFullStateRequest ||
      msg.msg === MessageType.PartialStateSubscription
    ) {
      const data = new Uint8Array(3)
      data[0] = msg.msg
      const view = new DataView(data.buffer)
      view.setUint16(1, msg.chunkIndex, true)

      return data
    } else if (msg.msg === MessageType.ToggleBit) {
      const data = new Uint8Array(5)
      data[0] = msg.msg
      const view = new DataView(data.buffer)
      view.setUint32(1, msg.index, true)

      return data
    } else {
      throw new Error("Invalid message type")
    }
  }
}
