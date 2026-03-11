/**
 * MQTT 3.1.1 over WebSocket (subscribe-only) — 外部ライブラリ不要
 *
 * bakusai.com の MQTT ブローカー仕様:
 *   - URL  : wss://mqtt1.bakusai.com:8084/mqtt
 *   - Topic: thread/{tid}
 *   - 認証 : なし (clientId はランダム文字列)
 *   - Payload (JSON): { rrid, body, date, name, npbMyTeam, npbMyTeamShortName }
 */

const MQTT_URL = 'wss://mqtt1.bakusai.com:8084/mqtt'
const KEEP_ALIVE_SEC = 60
const RECONNECT_DELAY_MS = 5000

// ---------------------------------------------------------------------------
// MQTT パケットエンコーダー
// ---------------------------------------------------------------------------

/** UTF-8 バイト列に変換 */
function utf8Bytes(str) {
  const out = []
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c < 0x80) {
      out.push(c)
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f))
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
    }
  }
  return out
}

/** MQTT の長さプレフィックス付き文字列（2 byte big-endian + バイト列） */
function mqttStr(str) {
  const b = utf8Bytes(str)
  return [b.length >> 8, b.length & 0xff, ...b]
}

/** MQTT 可変長エンコード */
function varLen(n) {
  const out = []
  do {
    let byte = n % 128
    n = Math.floor(n / 128)
    if (n > 0) byte |= 0x80
    out.push(byte)
  } while (n > 0)
  return out
}

/** CONNECT パケット */
function buildConnect(clientId) {
  // Protocol Name + Level + Flags(CleanSession=1) + KeepAlive
  const header = [0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, 0x02,
                  KEEP_ALIVE_SEC >> 8, KEEP_ALIVE_SEC & 0xff]
  const body = [...header, ...mqttStr(clientId)]
  return new Uint8Array([0x10, ...varLen(body.length), ...body])
}

/** SUBSCRIBE パケット */
function buildSubscribe(topic) {
  const body = [0x00, 0x01, ...mqttStr(topic), 0x00]  // packetId=1, QoS=0
  return new Uint8Array([0x82, ...varLen(body.length), ...body])
}

const PINGREQ    = new Uint8Array([0xc0, 0x00])
const DISCONNECT = new Uint8Array([0xe0, 0x00])

// ---------------------------------------------------------------------------
// MQTT パケットデコーダー（受信）
// ---------------------------------------------------------------------------

/** ArrayBuffer → UTF-8 文字列 */
function decodeUtf8(bytes) {
  let str = ''
  let i = 0
  while (i < bytes.length) {
    const b = bytes[i]
    if (b < 0x80) {
      str += String.fromCharCode(b); i++
    } else if ((b & 0xe0) === 0xc0) {
      str += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2
    } else {
      str += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3
    }
  }
  return str
}

/**
 * 受信バイナリから PUBLISH パケットを解析
 * @returns {{ topic: string, payload: string } | null}
 */
function parsePublish(data) {
  try {
    let bytes
    if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data)
    } else {
      return null
    }
    if (bytes.length < 4) return null

    const type = (bytes[0] & 0xf0) >> 4
    if (type !== 3) return null  // PUBLISH = 3

    // Remaining length
    let pos = 1
    let remLen = 0
    let mul = 1
    while (pos < bytes.length) {
      const b = bytes[pos++]
      remLen += (b & 0x7f) * mul
      mul *= 128
      if ((b & 0x80) === 0) break
    }

    // Topic
    const topicLen = (bytes[pos] << 8) | bytes[pos + 1]
    pos += 2
    const topic = decodeUtf8(bytes.slice(pos, pos + topicLen))
    pos += topicLen

    // QoS > 0 なら Packet ID を読み飛ばす
    const qos = (bytes[0] & 0x06) >> 1
    if (qos > 0) pos += 2

    // Payload
    const payload = decodeUtf8(bytes.slice(pos))
    return { topic, payload }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// 公開 API
// ---------------------------------------------------------------------------

/**
 * MQTT クライアントを生成して接続開始
 *
 * @param {string}   topic       購読するトピック（例: "thread/12345"）
 * @param {function} onMessage   ({ rrid, body, date, name }) が届いたときのコールバック
 * @param {function} onConnect   接続確立時コールバック
 * @param {function} onDisconnect 切断時コールバック
 * @returns {{ disconnect: function }}  disconnect() を呼ぶとクライアントが終了する
 */
export function createMqttClient(topic, onMessage, onConnect, onDisconnect) {
  let ws = null
  let pingTimer = null
  let reconnectTimer = null
  let destroyed = false

  const clientId =
    'laravel_mqtt_client_' + Math.random().toString(36).substring(2, 15)

  function send(packet) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(packet.buffer)
    }
  }

  function stopTimers() {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null }
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  }

  function scheduleReconnect() {
    if (destroyed) return
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
  }

  function connect() {
    if (destroyed) return

    ws = new WebSocket(MQTT_URL, ['mqtt'])
    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      send(buildConnect(clientId))
    }

    ws.onmessage = (event) => {
      const { data } = event
      if (!(data instanceof ArrayBuffer) || data.byteLength === 0) return

      const bytes = new Uint8Array(data)
      const type = (bytes[0] & 0xf0) >> 4

      switch (type) {
        case 2:  // CONNACK
          send(buildSubscribe(topic))
          pingTimer = setInterval(() => send(PINGREQ), KEEP_ALIVE_SEC * 1000)
          onConnect?.()
          break

        case 9:  // SUBACK — 購読確認（何もしない）
          break

        case 3: {  // PUBLISH
          const msg = parsePublish(data)
          if (!msg) break
          try {
            const parsed = JSON.parse(msg.payload)
            if (parsed?.rrid) onMessage?.(parsed)
          } catch {}
          break
        }

        case 13:  // PINGRESP — 何もしない
          break

        default:
          break
      }
    }

    ws.onerror = () => {}

    ws.onclose = () => {
      stopTimers()
      onDisconnect?.()
      scheduleReconnect()
    }
  }

  connect()

  return {
    disconnect() {
      destroyed = true
      stopTimers()
      if (ws) {
        try { send(DISCONNECT); ws.close() } catch {}
        ws = null
      }
    },
  }
}
