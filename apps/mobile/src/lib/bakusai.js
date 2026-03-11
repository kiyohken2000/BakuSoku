import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = 'https://bakusai.com'
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

// ------------------------------------
// 地域定数
// ------------------------------------

export const AREA_NAMES = {
  1: '北海道',
  2: '南東北',
  3: '東京',
  4: '甲信越',
  5: '東海',
  6: '北陸',
  7: '大阪',
  8: '山陽',
  9: '四国',
  10: '北部九州',
  11: '沖縄',
  12: '山陰',
  14: '北東北',
  15: '北関東',
  16: '南部九州',
  17: '南関東',
  18: '関西',
}

export const AREA_CODES = [3, 17, 15, 7, 18, 5, 10, 16, 1, 14, 2, 6, 4, 8, 12, 9, 11]

// ------------------------------------
// Cookie 管理
// ------------------------------------

let cookieStore = {}
let _initialized = false

export const initBakusai = async () => {
  if (_initialized) return
  try {
    const saved = await AsyncStorage.getItem('@bakusai_cookies')
    if (saved) cookieStore = JSON.parse(saved)
  } catch {}
  _initialized = true
}

const saveCookies = () => {
  AsyncStorage.setItem('@bakusai_cookies', JSON.stringify(cookieStore)).catch(() => {})
}

const applySetCookie = (headers) => {
  try {
    const setCookie = headers.get('set-cookie')
    if (!setCookie) return
    const semicolonIdx = setCookie.indexOf(';')
    const pair = semicolonIdx > 0 ? setCookie.substring(0, semicolonIdx) : setCookie
    const eqIdx = pair.indexOf('=')
    if (eqIdx > 0) {
      const name = pair.substring(0, eqIdx).trim()
      const value = pair.substring(eqIdx + 1).trim()
      if (name && value) {
        cookieStore[name] = value
        saveCookies()
      }
    }
  } catch {}
}

const cookieHeader = () =>
  Object.entries(cookieStore)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')

const getHeaders = (extra = {}) => ({
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
  Cookie: cookieHeader(),
  ...extra,
})

// ------------------------------------
// Fetch ヘルパー
// ------------------------------------

async function doGet(path) {
  if (!_initialized) await initBakusai()
  const res = await fetch(BASE_URL + path, {
    method: 'GET',
    headers: getHeaders(),
  })
  applySetCookie(res.headers)
  return res.text()
}

async function doPost(path, body, extra = {}) {
  if (!_initialized) await initBakusai()
  const res = await fetch(BASE_URL + path, {
    method: 'POST',
    headers: getHeaders(extra),
    body,
  })
  applySetCookie(res.headers)
  return res
}

// ------------------------------------
// HTML ユーティリティ
// ------------------------------------

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/g, ' ')
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ''))
}

// ------------------------------------
// パーサー
// ------------------------------------

export function parseAreaTop(html) {
  const categories = []
  const boards = []

  const catRegex =
    /href="\/bbstop\/acode=(\d+)\/ctgid=(\d+)\/?"[^>]*>([\s\S]*?)<\/a>/g
  let m
  while ((m = catRegex.exec(html)) !== null) {
    const name = stripTags(m[3]).trim()
    if (name && !categories.find((c) => c.ctgid === parseInt(m[2], 10))) {
      categories.push({
        acode: parseInt(m[1], 10),
        ctgid: parseInt(m[2], 10),
        name,
      })
    }
  }

  const boardRegex =
    /href="\/thr_tl\/acode=(\d+)\/ctgid=(\d+)\/bid=(\d+)\/?"[^>]*>([\s\S]*?)<\/a>/g
  while ((m = boardRegex.exec(html)) !== null) {
    const name = stripTags(m[4]).trim()
    if (name && !boards.find((b) => b.bid === parseInt(m[3], 10))) {
      boards.push({
        acode: parseInt(m[1], 10),
        ctgid: parseInt(m[2], 10),
        bid: parseInt(m[3], 10),
        name,
      })
    }
  }

  const boardsByCtgid = {}
  for (const b of boards) {
    if (!boardsByCtgid[b.ctgid]) boardsByCtgid[b.ctgid] = []
    boardsByCtgid[b.ctgid].push(b)
  }

  return { categories, boardsByCtgid }
}

export function parseBoards(html) {
  const boards = []
  const regex =
    /href="\/thr_tl\/acode=(\d+)\/ctgid=(\d+)\/bid=(\d+)\/?"[^>]*>([\s\S]*?)<\/a>/g
  let m
  while ((m = regex.exec(html)) !== null) {
    const name = stripTags(m[4]).trim()
    if (name && !boards.find((b) => b.bid === parseInt(m[3], 10))) {
      boards.push({
        acode: parseInt(m[1], 10),
        ctgid: parseInt(m[2], 10),
        bid: parseInt(m[3], 10),
        name,
      })
    }
  }
  return boards
}

export function parseThreadList(html) {
  const threads = []
  const parts = html.split('<li data-tid=')

  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i]
    const tidMatch = chunk.match(/^"(\d+)"/)
    if (!tidMatch) continue
    const tid = tidMatch[1]

    const hrefMatch = chunk.match(/href="(\/thr_res\/[^"]+)"/)
    const href = hrefMatch ? hrefMatch[1] : ''

    const titleMatch = chunk.match(/thr_status_icon"[^>]*title="([^"]+)"/)
    const title = titleMatch ? decodeEntities(titleMatch[1]) : ''

    let updatedAt = ''
    let views = 0
    let resCount = 0

    const udIdx = chunk.indexOf('class="ttUdTime"')
    if (udIdx !== -1) {
      const udBlockStart = chunk.indexOf('>', udIdx) + 1
      const udBlock = chunk.substring(udBlockStart, udBlockStart + 500)

      const firstSpan = udBlock.indexOf('<span')
      if (firstSpan !== -1) {
        updatedAt = udBlock.substring(0, firstSpan).replace(/<[^>]*>/g, '').trim()
      }

      const nums = [...udBlock.matchAll(/<span>([\d,]+)<\/span>/g)].map((n) =>
        parseInt(n[1].replace(/,/g, ''), 10),
      )
      views = nums[0] || 0
      resCount = nums[1] || 0
    }

    if (tid && title) {
      threads.push({ tid, title, href, updatedAt, views, resCount })
    }
  }

  return threads
}

export function parseThread(html) {
  const responses = []
  const parts = html.split('<div id="res')

  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i]
    const rridMatch = chunk.match(/^(\d+)_block/)
    if (!rridMatch) continue
    const rrid = parseInt(rridMatch[1], 10)

    const dateMatch = chunk.match(/itemprop="commentTime"[^>]*>([\s\S]*?)<\/span>/)
    const date = dateMatch ? stripTags(dateMatch[1]).trim() : ''

    let body = ''
    const bodyMarker = '<div class="res_body">'
    const bodyStart = chunk.indexOf(bodyMarker)
    if (bodyStart !== -1) {
      const bodyContent = chunk.substring(bodyStart + bodyMarker.length)
      const bodyEnd = bodyContent.indexOf('</div>')
      if (bodyEnd !== -1) {
        body = bodyContent
          .substring(0, bodyEnd)
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<a[^>]*>&gt;&gt;(\d+)<\/a>/g, '>>$1')
          .replace(/<[^>]*>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&nbsp;/g, ' ')
          .trim()
      }
    }

    let name = '匿名さん'
    const nameMarker = '<div class="name">'
    const nameStart = chunk.indexOf(nameMarker)
    if (nameStart !== -1) {
      const nameContent = chunk.substring(nameStart + nameMarker.length)
      const nameEnd = nameContent.indexOf('</div>')
      if (nameEnd !== -1) {
        const parsed = stripTags(nameContent.substring(0, nameEnd))
          .replace(/^\[|\]$/g, '')
          .trim()
        if (parsed) name = parsed
      }
    }

    responses.push({ rrid, date, body, name })
  }

  const formFields = parseFormFields(html)

  const titleMatch = html.match(/<title>([^<]+)<\/title>/)
  const pageTitle = titleMatch
    ? decodeEntities(titleMatch[1].split('｜')[0].trim())
    : ''

  const tidMatch = html.match(/var thr_thread_tid = '(\d+)'/)
  const bidMatch = html.match(/var thr_bbs_bid = '(\d+)'/)

  return {
    responses,
    formFields,
    pageTitle,
    tid: tidMatch ? tidMatch[1] : '',
    bid: bidMatch ? bidMatch[1] : '',
  }
}

function parseFormFields(html) {
  const formStart = html.indexOf('name="directForm"')
  if (formStart === -1) return null

  const formTagStart = html.lastIndexOf('<form', formStart)
  const formTagEnd = html.indexOf('</form>', formStart)
  if (formTagStart === -1 || formTagEnd === -1) return null

  const formHtml = html.substring(formTagStart, formTagEnd)

  const actionMatch = formHtml.match(/action="([^"]+)"/)
  const fields = { _action: actionMatch ? actionMatch[1] : '' }

  const inputRegex = /<input[^>]*>/g
  let m
  while ((m = inputRegex.exec(formHtml)) !== null) {
    const nameMatch = m[0].match(/name="([^"]+)"/)
    const valueMatch = m[0].match(/value="([^"]*)"/)
    if (nameMatch && valueMatch) {
      fields[nameMatch[1]] = valueMatch[1]
    }
  }

  return fields
}

export function parseSearch(html) {
  const results = []
  const seen = new Set()
  const regex = /href="(\/thr_res\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  let m
  while ((m = regex.exec(html)) !== null) {
    const href = m[1]
    const text = stripTags(m[2]).trim()
    if (href && text && text.length > 2 && !seen.has(href)) {
      seen.add(href)
      results.push({ href, text })
    }
  }
  return results
}

// ------------------------------------
// 公開 API
// ------------------------------------

export async function getAreaTop(acode) {
  const html = await doGet(`/areatop/acode=${acode}/`)
  return parseAreaTop(html)
}

export async function getBoards(acode, ctgid) {
  const html = await doGet(`/bbstop/acode=${acode}/ctgid=${ctgid}/`)
  return parseBoards(html)
}

export async function getThreadList(acode, ctgid, bid, page = null) {
  const path =
    page
      ? `/thr_tl/acode=${acode}/ctgid=${ctgid}/bid=${bid}/p=${page}/`
      : `/thr_tl/acode=${acode}/ctgid=${ctgid}/bid=${bid}/`
  const html = await doGet(path)
  return parseThreadList(html)
}

export async function getThread(acode, ctgid, bid, tid, page = null) {
  const path =
    page
      ? `/thr_res/acode=${acode}/ctgid=${ctgid}/bid=${bid}/tid=${tid}/p=${page}/tp=1/`
      : `/thr_res/acode=${acode}/ctgid=${ctgid}/bid=${bid}/tid=${tid}/tp=1/`
  const html = await doGet(path)
  return parseThread(html)
}

export async function getRatingList(tid, rrids) {
  const list = rrids.map((r) =>
    r === 0 ? { tid: String(tid) } : { tid: String(tid), rrid: String(r) },
  )
  const body = `data=${encodeURIComponent(JSON.stringify({ list }))}`
  const res = await doPost('/rating_list/', body, {
    'Content-Type': 'application/x-www-form-urlencoded',
  })
  return res.json()
}

export async function pushRating(tid, rrid, rateId) {
  const body = `tid=${tid}&rrid=${rrid}&rate_id=${rateId}`
  const res = await doPost('/rating_push', body, {
    'Content-Type': 'application/x-www-form-urlencoded',
  })
  return res.json()
}

export async function postResponse(action, formFields, body, name) {
  const fd = new FormData()
  const skip = new Set(['_action', 'name', 'body', 'mailaddr', 'image_post', 'stamp_data'])
  for (const [k, v] of Object.entries(formFields)) {
    if (!skip.has(k)) fd.append(k, v)
  }
  fd.append('name', name || '匿名さん')
  fd.append('body', body)
  fd.append('mailaddr', '')

  const url = action.startsWith('http') ? action : BASE_URL + action
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...getHeaders(),
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: fd,
  })
  return res.json()
}

export async function search(acode, word) {
  const html = await doGet(`/sch_all/acode=${acode}/word=${encodeURIComponent(word)}/`)
  return parseSearch(html)
}
