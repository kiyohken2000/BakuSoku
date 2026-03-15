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

async function doGet(path, extra = {}) {
  if (!_initialized) await initBakusai()
  const res = await fetch(BASE_URL + path, {
    method: 'GET',
    headers: getHeaders(extra),
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
    .replace(/&ensp;/g, ' ')
    .replace(/&emsp;/g, ' ')
    .replace(/&thinsp;/g, ' ')
    .replace(/&apos;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ''))
}

// HTMLタグがエンコードされて混入するケース（&lt;span ...&gt;）にも対応して除去する
function stripTagsDeep(html) {
  if (!html) return ''
  let s = html
  for (let i = 0; i < 2; i++) {
    s = decodeEntities(s)
    s = s.replace(/<[^>]*>/g, '')
  }
  return decodeEntities(s)
}

// タイトルの余分な改行/空白を潰して 1 行に整形する
function normalizeTitle(html) {
  if (!html) return ''
  return stripTagsDeep(html).replace(/\s+/g, ' ').trim()
}

// bbstop/areatop リンク内HTMLから板名を抽出する
// 構造A (inline): <div class="listNumb">🔫</div><div class="brdName ">板名</div>
// 構造B (multiline): <div class="listNumb">\n  🛩️\n</div>\n<div class="brdName common_categories_text">板名</div>
// listNumb は絵文字アイコンなので除外し、brdName の中身を優先取得する
// 注意: "brdNameWrap" に誤マッチしないよう brdName の直後が " or スペースのみ許可
function extractBoardName(innerHtml) {
  // class="brdName" または class="brdName someOtherClass" にマッチ (brdNameWrap は除外)
  const brdNameMatch = innerHtml.match(/class="brdName(?=["\s])[^"]*"[^>]*>([\s\S]*?)<\/div>/)
  if (brdNameMatch) {
    return decodeEntities(stripTags(brdNameMatch[1])).trim()
  }
  // フォールバック: 全タグ除去
  return stripTags(innerHtml)
}

// areatop/bbstop のアンカーテキストから正しい板名だけを抽出する
// - "もっと見る" 系リンクは null を返す（除外）
// - "PICKUP!\n  板名\n  記事タイトル" は板名行を返す
function cleanBoardName(raw) {
  if (!raw) return null
  if (raw.includes('もっと見る') || raw.includes('もっと\u0020見る')) return null
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return null
  if (lines[0] === 'PICKUP!' && lines.length > 1) return lines[1]
  return lines[0]
}

// プロモーション要素かどうか判定
// id="view_user_new_columns" → 全カテゴリに貼られる「カテゴリーダーの独り言」宣伝リンク（スレなし）
function isPromotionLink(innerHtml) {
  return innerHtml.includes('view_user_new_columns') || innerHtml.includes('view_user_landscape')
}

// ------------------------------------
// パーサー
// ------------------------------------

export function parseAreaTop(html, regionName = '') {
  const categories = []
  const boards = []

  const catRegex =
    /href="\/bbstop\/acode=(\d+)\/ctgid=(\d+)\/?"[^>]*>([\s\S]*?)<\/a>/g
  let m
  while ((m = catRegex.exec(html)) !== null) {
    const name = stripTags(m[3]).trim()
    if (!name) continue
    const ctgid = parseInt(m[2], 10)
    const existingIdx = categories.findIndex((c) => c.ctgid === ctgid)
    const existing = existingIdx >= 0 ? categories[existingIdx] : null
    if (!existing) {
      categories.push({
        acode: parseInt(m[1], 10),
        ctgid,
        name,
      })
    } else if (regionName && name.includes(regionName) && !existing.name.includes(regionName)) {
      // 地域名を含むカテゴリ名が後から出た場合は名称更新 + 表示順も後ろに寄せる
      categories.splice(existingIdx, 1)
      categories.push({ ...existing, name })
    }
  }

  const boardRegex =
    /href="\/thr_tl\/acode=(\d+)\/ctgid=(\d+)\/bid=(\d+)\/?"[^>]*>([\s\S]*?)<\/a>/g
  while ((m = boardRegex.exec(html)) !== null) {
    if (isPromotionLink(m[4])) continue
    const name = cleanBoardName(extractBoardName(m[4]))
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
    if (isPromotionLink(m[4])) continue
    const name = cleanBoardName(extractBoardName(m[4]))
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
  // 実際の HTML は <li  data-tid="..." (スペース複数) なのでregexで分割
  const parts = html.split(/<li\s+data-tid=/)

  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i]
    const tidMatch = chunk.match(/^"(\d+)"/)
    if (!tidMatch) continue
    const tid = tidMatch[1]

    const hrefMatch = chunk.match(/href="(\/thr_res\/[^"]+)"/)
    const href = hrefMatch ? hrefMatch[1] : ''

    // class="thr_status_icon" title="..." または title="..." class="thr_status_icon" 両方に対応
    const titleMatch =
      chunk.match(/class="thr_status_icon"[^>]*title="([^"]*)"/) ||
      chunk.match(/title="([^"]*)"[^>]*class="[^"]*thr_status_icon/)
    const title = titleMatch ? normalizeTitle(titleMatch[1]) : ''

    let updatedAt = ''
    let resCount = 0

    const udIdx = chunk.indexOf('class="ttUdTime"')
    if (udIdx !== -1) {
      const udBlockStart = chunk.indexOf('>', udIdx) + 1
      const udBlock = chunk.substring(udBlockStart, udBlockStart + 600)

      const firstSpan = udBlock.indexOf('<span')
      if (firstSpan !== -1) {
        // &ensp; などのエンティティをデコードしてから不要スペースを除去
        updatedAt = decodeEntities(
          udBlock.substring(0, firstSpan).replace(/<[^>]*>/g, '').trim(),
        ).trim()
      }

      const nums = [...udBlock.matchAll(/<span>([\d,]+)<\/span>/g)].map((n) =>
        parseInt(n[1].replace(/,/g, ''), 10),
      )
      resCount = nums[nums.length - 1] || 0
    }

    // 固定スレ: row_fixed_icon クラスが存在する場合
    const isPinned = chunk.includes('row_fixed_icon')

    if (tid && title) {
      threads.push({ tid, title, href, updatedAt, resCount, isPinned })
    }
  }

  // image-board layout fallback:
  //   weather_thr_list_box        (e.g. bid=5877 weather forecast archive)
  //   photograph_thr_list_wrapper (e.g. bid=5830 landscape photo boards)
  //   class="thr_list img"        (e.g. bid=5868 gravure news, image boards)
  if (threads.length === 0) {
    const wRegex =
      /<li>\s*<a\s+href="(\/thr_res\/[^"]*\/tid=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/g
    let wm
    while ((wm = wRegex.exec(html)) !== null) {
      const href = wm[1]
      const tid = wm[2]
      const inner = wm[3]

      // title: weather layout uses <div class="title">,
      //        photo layout uses <div class="photograph_thr_title">
      const titleMatch =
        inner.match(/<div class="title">\s*([\s\S]*?)\s*<\/div>/) ||
        inner.match(/<div class="photograph_thr_title">\s*([\s\S]*?)\s*<\/div>/) ||
        inner.match(/class="photograph_image"[^>]*alt="([^"]+)"/)
      const title = titleMatch ? normalizeTitle(titleMatch[1]) : ''

      let updatedAt = ''
      const timeDivMatch = inner.match(/<div class="time">([\s\S]*?)<\/div>/)
      if (timeDivMatch) {
        const beforeChart = timeDivMatch[1].split('<span class="thrimg_chart')[0]
        updatedAt = decodeEntities(beforeChart.replace(/<[^>]*>/g, '').trim())
      }

      const spanNums = [...inner.matchAll(/<span>([\d,]+)<\/span>/g)].map((n) =>
        parseInt(n[1].replace(/,/g, ''), 10),
      )
      const resCount = spanNums[spanNums.length - 1] || 0

      const alreadySeen = threads.some((t) => t.tid === tid)
      if (tid && title && !alreadySeen) {
        threads.push({ tid, title, href, updatedAt, resCount, isPinned: false })
      }
    }
  }

  // 次ページ URL: paging_nex_res_and_button の href から抽出
  let nextPage = null
  const pagingM = html.match(
    /class="paging_nex_res_and_button"[\s\S]{0,600}?href="(\/thr_tl\/[^"]+)"/,
  )
  if (pagingM) nextPage = pagingM[1]

  return { threads, nextPage }
}

export function parseThread(html, currentPage = null) {
  const responses = []
  // 実際の HTML は <li id="res{rrid}_block" 形式
  const parts = html.split(/<li\s+id="res/)
  let skippedEmpty = 0 // eslint-disable-line no-unused-vars

  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i]
    const rridMatch = chunk.match(/^(\d+)_block/)
    if (!rridMatch) continue
    const rrid = parseInt(rridMatch[1], 10)

    // 日時: itemprop="commentTime" スパン内テキスト
    // 一部ページでは commentTime が欠けるため、フォールバックで日付文字列を拾う
    const commentTimeMatch = chunk.match(/itemprop="commentTime"[^>]*>([\s\S]*?)<\/span>/)
    let date = ''
    if (commentTimeMatch) {
      date = commentTimeMatch[1].trim()
    } else {
      const altDateMatch = chunk.match(/(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2})/)
      if (altDateMatch) date = altDateMatch[1]
    }

    let body = ''
    const bodyMarker = 'class="res_body"'
    const bodyStart = chunk.indexOf(bodyMarker)
    if (bodyStart !== -1) {
      const afterMarker = chunk.indexOf('>', bodyStart) + 1
      const bodyContent = chunk.substring(afterMarker)
      // res_body 内にネストされた div がある場合（画像付きレスなど）でも
      // 正しく res_body の閉じタグを見つけるため、div の開閉をカウントする
      let bodyEnd = bodyContent.indexOf('</div>') // フォールバック
      {
        let depth = 1
        let pos = 0
        while (pos < bodyContent.length) {
          const nextOpen = bodyContent.indexOf('<div', pos)
          const nextClose = bodyContent.indexOf('</div>', pos)
          if (nextClose === -1) break
          if (nextOpen !== -1 && nextOpen < nextClose) {
            depth++
            pos = nextOpen + 4
          } else {
            depth--
            if (depth === 0) { bodyEnd = nextClose; break }
            pos = nextClose + 6
          }
        }
      }
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
          .replace(/\u00a0/g, ' ')  // non-breaking space
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !l.includes('画像拡大'))  // res_img ラベル除去
          .join('\n')
          .trim()
      }
    }

    if (!body) {
      skippedEmpty++
      continue
    }

    // 投稿者名: class="name" div 内の最初の <span> テキスト
    let name = '匿名さん'
    const nameAreaIdx = chunk.indexOf('class="name"')
    if (nameAreaIdx !== -1) {
      const nameArea = chunk.substring(nameAreaIdx, nameAreaIdx + 400)
      const spanMatch = nameArea.match(/<span[^>]*>([^<]+)<\/span>/)
      if (spanMatch) {
        const parsed = spanMatch[1].trim()
        if (parsed) name = parsed
      }
    }

    // 画像URL: res_img 内 img タグの data-original を抽出（lazy-load 対応）
    let imageUrl = null
    const resImgIdx = chunk.indexOf('class="res_img"')
    if (resImgIdx !== -1) {
      const resImgArea = chunk.substring(resImgIdx, resImgIdx + 1000)
      const dataOrigM = resImgArea.match(/data-original="([^"]+)"/)
      if (dataOrigM) imageUrl = dataOrigM[1]
    }

    responses.push({ rrid, date, body, name, imageUrl })
  }

  // commentTime のないレス（quote）はスキップ済みなので重複は原則発生しないが念のため除去
  const seen = new Set()
  const uniqueResponses = responses.filter((r) => {
    if (seen.has(r.rrid)) return false
    seen.add(r.rrid)
    return true
  })


  // 画像・ニュース系ボード: <li id="res0_whole"> に記事本文がある場合は先頭に挿入
  // (通常ボードの res0_block は空なのでスキップされており、pageTitle フォールバックは
  //  responses.length === 0 のときだけ使われる。ここでは実際の記事本文を使う)
  const res0WholeM = html.match(/<li[^>]*id="res0_whole"[^>]*>([\s\S]*?)(?=<li\s|<\/ul>)/)
  if (res0WholeM) {
    const res0Block = res0WholeM[1]

    // 日時
    const dateM = res0Block.match(/itemprop="datePublished"[^>]*>([\s\S]*?)<\/span>/)
    const res0date = dateM ? dateM[1].trim() : ''

    // スレタイ (bg_thrtitle > p)
    const titleM = res0Block.match(/class="bg_thrtitle[^"]*"[\s\S]*?<p>([\s\S]*?)<\/p>/)
    const res0title = titleM ? normalizeTitle(titleM[1]) : ''

    // 記事本文 (type A): div_box (showmore_list) 内の <p> テキスト (rss_news 系)
    let articleText = ''
    const divBoxM = res0Block.match(/<div[^>]*id="div_box"[^>]*>([\s\S]*?)(?:<\/div>\s*<!--\s*\/showmore_list|<\/section>)/)
    if (divBoxM) {
      const paras = [...divBoxM[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
      articleText = paras
        .map((m) => decodeEntities(m[1].replace(/<[^>]*>/g, '').trim()))
        .filter((t) => t.length > 0)
        .join('\n')
    }

    // 記事本文 (type B): imgbody[itemprop=articlebody] (imagebbs 系)
    if (!articleText) {
      const imgBodyM = res0Block.match(/<div[^>]*itemprop="articlebody"[^>]*>([\s\S]*?)<\/div>/)
      if (imgBodyM) {
        articleText = decodeEntities(
          imgBodyM[1]
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]*>/g, '')
        )
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
          .join('\n')
          .trim()
      }
    }

    // 配信元情報: 【日時】【提供】【ソース】
    const sourceLines = []
    const jijiM = res0Block.match(/【日時】([^\n<]{1,80})/)
    if (jijiM) sourceLines.push('\u3010\u65e5\u6642\u3011' + jijiM[1].trim())
    const provM = res0Block.match(/【(?:\u63d0\u4f9b|\u30bd\u30fc\u30b9)】([\s\S]*?)(?:<span|<\/div>|\n)/)
    if (provM) {
      const provText = provM[1].replace(/<[^>]*>/g, '').trim()
      if (provText) sourceLines.push('\u3010\u63d0\u4f9b\u3011' + provText)
    }

    // 画像 URL (type A): div_box 内の <img src>（スペーサー画像は除外）
    let imageUrl = null
    if (divBoxM) {
      const imgM = divBoxM[1].match(/<img[^>]+src="([^"]+)"/)
      if (imgM && !imgM[1].includes('spacer') && !imgM[1].includes('loading')) {
        imageUrl = imgM[1]
      }
    }
    // data-original (遅延ロード対応)
    if (!imageUrl && divBoxM) {
      const origM = divBoxM[1].match(/data-original="([^"]+)"/)
      if (origM && !origM[1].includes('spacer')) imageUrl = origM[1]
    }
    // 画像 URL (type B): thr_img div 内の <img src>（imagebbs 系）
    if (!imageUrl) {
      const thrImgM = res0Block.match(/<div[^>]*class="thr_img[^"]*"[\s\S]*?<img[^>]+src="([^"]+)"/)
      if (thrImgM && !thrImgM[1].includes('spacer') && !thrImgM[1].includes('loading')) {
        imageUrl = thrImgM[1]
      }
    }

    // 元記事 URL: href="https://..." で「元記事」に近い <a>
    let sourceUrl = null
    const srcLinkM = res0Block.match(/href="(https?:\/\/[^"]+)"[^>]*>[^<]*(?:\u5143\u8a18\u4e8b|\u8a18\u4e8b\u3092\u8aad\u3080)[^<]*<\/a>/)
    if (srcLinkM) sourceUrl = srcLinkM[1]
    // NewsAeticleUrl クラス内の href でもフォールバック
    if (!sourceUrl) {
      const newsUrlM = res0Block.match(/class="NewsAeticleUrl"[\s\S]*?href="(https?:\/\/[^"]+)"/)
      if (newsUrlM) sourceUrl = newsUrlM[1]
    }

    const bodyParts = []
    if (res0title) bodyParts.push(res0title)
    if (articleText) {
      if (bodyParts.length > 0) bodyParts.push('')
      bodyParts.push(articleText)
    }
    if (sourceLines.length > 0) {
      bodyParts.push('')
      bodyParts.push(...sourceLines)
    }

    const res0body = bodyParts.join('\n')
    if (res0body && !uniqueResponses.some((r) => r.rrid === 0)) {
      // imageUrl / sourceUrl を body の先頭にマーカーとして埋め込む
      // → SQLite にキャッシュされた後でも復元できるようにする
      const markerLines = []
      if (imageUrl) markerLines.push(`\x02IMG\x02${imageUrl}`)
      if (sourceUrl) markerLines.push(`\x02SRC\x02${sourceUrl}`)
      const encodedBody = markerLines.length > 0
        ? markerLines.join('\n') + '\n\x03\n' + res0body
        : res0body
      uniqueResponses.unshift({ rrid: 0, date: res0date, body: encodedBody, name: '', imageUrl, sourceUrl })
    }
  }

  const formFields = parseFormFields(html)

  const titleMatch = html.match(/<title>([^<]+)<\/title>/)
  const rawTitle = titleMatch ? normalizeTitle(titleMatch[1]) : ''
  const pageTitle = rawTitle.split('｜')[0].trim()

  // タイトルから総レス数を抽出: "加茂農林高等学校 ③ - 新潟同窓会掲示板\n951レス｜..."
  const totalCountMatch = rawTitle.match(/(\d+)レス/)
  const totalCount = totalCountMatch ? parseInt(totalCountMatch[1], 10) : null

  const tidMatch = html.match(/var thr_thread_tid = '(\d+)'/)
  const bidMatch = html.match(/var thr_bbs_bid = '(\d+)'/)

  // paging_nex_res_and_button から「次のページ」リンクを検出
  // このdivが存在する = 次ページあり、存在しない = 最終ページ
  // rw=1 モード: /p=N/tp=1/rw=1/
  // 通常モード:  /p=N/tp=1/  (rw=1 なし)
  let nextRw1Page = null
  let nextNormalPage = null
  const pagingIdx = html.indexOf('class="paging_nex_res_and_button"')
  if (pagingIdx !== -1) {
    // div の開始位置から最大 2000 文字以内で href を探す
    const pagingSection = html.substring(pagingIdx, pagingIdx + 2000)
    const hrefMatch = pagingSection.match(/href="([^"]*\/thr_res\/[^"]+)"/)
    if (hrefMatch) {
      const nextUrl = hrefMatch[1]
      const rw1Match = nextUrl.match(/\/p=(\d+)\/tp=1\/rw=1\//)
      const normalMatch = nextUrl.match(/\/p=(\d+)\/tp=1\/(?!rw)/)
      if (rw1Match) nextRw1Page = parseInt(rw1Match[1], 10)
      else if (normalMatch) nextNormalPage = parseInt(normalMatch[1], 10)
    }
  }

  const current = currentPage ?? 1
  const tid = tidMatch ? tidMatch[1] : ''
  if (tid && (nextRw1Page === null || nextNormalPage === null)) {
    const hrefRegex = /href="([^"]*\/thr_res\/[^"]+)"/g
    const rw1Pages = new Set()
    const normalPages = new Set()
    let m
    while ((m = hrefRegex.exec(html)) !== null) {
      const href = m[1]
      if (!href.includes(`tid=${tid}`)) continue
      const isRw1 = href.includes('/rw=1/')
      let p = 1
      const pm = href.match(/\/p=(\d+)\/tp=1\//)
      if (pm) p = parseInt(pm[1], 10)
      if (isRw1) rw1Pages.add(p)
      else normalPages.add(p)
    }
    if (nextRw1Page === null && rw1Pages.size > 0) {
      const cand = [...rw1Pages].filter((p) => p > current).sort((a, b) => a - b)
      if (cand.length > 0) nextRw1Page = cand[0]
    }
    if (nextNormalPage === null && normalPages.size > 0) {
      const cand = [...normalPages].filter((p) => p > current).sort((a, b) => a - b)
      if (cand.length > 0) nextNormalPage = cand[0]
    }
  }

  // console.log('[parseThread] nextRw1Page:', nextRw1Page, 'nextNormalPage:', nextNormalPage)

  return {
    responses: uniqueResponses,
    formFields,
    pageTitle,
    tid: tidMatch ? tidMatch[1] : '',
    bid: bidMatch ? bidMatch[1] : '',
    totalCount,     // スレッドの総レス数 (null = 不明)
    nextRw1Page,   // rw=1 次ページ番号 (null = 最終ページ)
    nextNormalPage, // 通常 次ページ番号 (null = 最終ページ)
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

  // hidden/text inputのみ収集。button・submit・reset・checkboxは除外
  const inputRegex = /<input[^>]*>/gi
  let m
  while ((m = inputRegex.exec(formHtml)) !== null) {
    const tag = m[0]
    const typeMatch = tag.match(/type="([^"]+)"/i)
    const inputType = typeMatch ? typeMatch[1].toLowerCase() : 'text'
    if (['button', 'submit', 'reset', 'image'].includes(inputType)) continue
    const nameMatch = tag.match(/name="([^"]+)"/i)
    const valueMatch = tag.match(/value="([^"]*)"/i)
    if (nameMatch && valueMatch) {
      fields[nameMatch[1]] = valueMatch[1]
    }
  }

  // textarea も収集（body フィールド等）
  const textareaRegex = /<textarea[^>]*>/gi
  let tm
  while ((tm = textareaRegex.exec(formHtml)) !== null) {
    const nameMatch = tm[0].match(/name="([^"]+)"/i)
    if (nameMatch) {
      fields[nameMatch[1]] = ''
    }
  }

  return fields
}

export function parseSearch(html) {
  const results = []
  const seenTid = new Set()

  // 検索結果は <li> 内の <a href="/thr_res/..."> + <h2 id="tid-NNNNN"> 構造
  const liRegex = /<li>\s*<a\s+href="(\/thr_res\/[^"]+)">([\s\S]*?)<\/a>/g
  let m
  while ((m = liRegex.exec(html)) !== null) {
    const href = m[1]
    const content = m[2]
    const h2Match = content.match(/id="tid-(\d+)"[^>]*>([\s\S]*?)<\/h2>/)
    if (!h2Match) continue
    const tid = h2Match[1]
    const title = stripTags(h2Match[2]).trim()
    if (tid && title && !seenTid.has(tid)) {
      seenTid.add(tid)
      // views / resCount: span内数値 (views が先, resCount が後)
      const numsMatch = [...content.matchAll(/<span>(\d+)<\/span>/g)].map((n) =>
        parseInt(n[1], 10),
      )
      const resCount = numsMatch[numsMatch.length - 1] || 0

      // 最終更新日時: class="ttUdTime" または日付っぽいテキスト (YYYY/MM/DD HH:MM 形式)
      let updatedAt = ''
      const udIdx = content.indexOf('class="ttUdTime"')
      if (udIdx !== -1) {
        const udBlockStart = content.indexOf('>', udIdx) + 1
        const udBlock = content.substring(udBlockStart, udBlockStart + 400)
        const firstSpan = udBlock.indexOf('<span')
        const raw = firstSpan !== -1
          ? udBlock.substring(0, firstSpan)
          : udBlock.substring(0, 100)
        updatedAt = decodeEntities(raw.replace(/<[^>]*>/g, '').trim()).trim()
      }
      if (!updatedAt) {
        // フォールバック: YYYY/MM/DD HH:MM パターンを直接検索
        const dateM = content.match(/(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2})/)
        if (dateM) updatedAt = dateM[1]
      }

      results.push({ tid, title, href, resCount, updatedAt })
    }
  }

  // フォールバック: 上記で0件の場合は thr_res リンクのテキストを使用
  if (results.length === 0) {
    const seen = new Set()
    const fallback = /href="(\/thr_res\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    while ((m = fallback.exec(html)) !== null) {
      const href = m[1]
      const text = stripTags(m[2]).trim()
      if (href && text && text.length > 2 && !seen.has(href)) {
        seen.add(href)
        results.push({ tid: '', title: text, href, resCount: 0, updatedAt: '' })
      }
    }
  }

  return results
}

// ------------------------------------
// 公開 API
// ------------------------------------

export async function getAreaTop(acode) {
  // 通常 + 成人(/ctgtop_a/) + ギャンブル(/ctgtop_g/) を並列フェッチ
  const [mainHtml, adultHtml, gambleHtml] = await Promise.all([
    doGet(`/areatop/acode=${acode}/`),
    doGet(`/ctgtop_a/acode=${acode}/`).catch(() => ''),
    doGet(`/ctgtop_g/acode=${acode}/`).catch(() => ''),
  ])

  const regionName = AREA_NAMES[acode] || ''
  const main = parseAreaTop(mainHtml, regionName)
  const adult = parseAreaTop(adultHtml, regionName)
  const gamble = parseAreaTop(gambleHtml, regionName)

  // カテゴリを重複なくマージ（成人・ギャンブルは末尾に追加）
  const allCategories = [...main.categories]
  const allBoardsByCtgid = { ...main.boardsByCtgid }
  const restrictedCtgids = new Set()

  for (const cat of [...adult.categories, ...gamble.categories]) {
    restrictedCtgids.add(cat.ctgid)
    if (!allCategories.find((c) => c.ctgid === cat.ctgid)) {
      allCategories.push(cat)
    }
  }
  for (const [ctgid, boards] of Object.entries({
    ...adult.boardsByCtgid,
    ...gamble.boardsByCtgid,
  })) {
    if (!allBoardsByCtgid[ctgid]) allBoardsByCtgid[ctgid] = boards
  }

  return { categories: allCategories, boardsByCtgid: allBoardsByCtgid, restrictedCtgids }
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
  return parseThread(html, page ?? 1)
}

// 最初から表示: bakusai 公式の rw=1 パラメータを使用 (最古ページから表示)
export async function getThreadFromStart(acode, ctgid, bid, tid, page = null) {
  const path = page
    ? `/thr_res/acode=${acode}/ctgid=${ctgid}/bid=${bid}/tid=${tid}/p=${page}/tp=1/rw=1/`
    : `/thr_res/acode=${acode}/ctgid=${ctgid}/bid=${bid}/tid=${tid}/tp=1/rw=1/`
  const html = await doGet(path)
  const result = parseThread(html, page ?? 1)
  console.log('[bakusai] rw=1 page:', page ?? 1,
    'responses:', result.responses.length,
    'nextRw1Page:', result.nextRw1Page)
  return result
}

// 新着チェック: スレの最新ページ (tp=1) を取得し、最大 RRID を返す
// 失敗時は null を返す
export async function checkThreadLatestRrid(acode, ctgid, bid, tid) {
  try {
    const data = await getThread(acode, ctgid, bid, tid)
    if (!data.responses || data.responses.length === 0) return null
    return Math.max(...data.responses.map((r) => r.rrid))
  } catch {
    return null
  }
}

// >>NNN アンカーポップアップ用: 単一レスを取得
// /thr_res_show/acode=N/ctgid=N/bid=N/tid=N/rrid=N/ → parseThread の responses[0]
export async function getResShow(acode, ctgid, bid, tid, rrid) {
  const html = await doGet(
    `/thr_res_show/acode=${acode}/ctgid=${ctgid}/bid=${bid}/tid=${tid}/rrid=${rrid}/`,
  )
  const result = parseThread(html, null)
  return result.responses[0] || null
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
  // name/body/mailaddr/image_post/stamp_data は以下で個別に追加
  const skip = new Set(['_action', 'name', 'body', 'mailaddr', 'image_post', 'stamp_data'])
  for (const [k, v] of Object.entries(formFields)) {
    if (!skip.has(k)) fd.append(k, v)
  }
  fd.append('name', name || '匿名さん')
  fd.append('body', body)
  fd.append('mailaddr', '')
  fd.append('image_post', '')
  fd.append('stamp_data', '')

  const url = action.startsWith('http') ? action : BASE_URL + action
  // Referer: スレッドページURL（bakusai はリファラーで投稿元を検証する）
  const referer = formFields.bid && formFields.tid
    ? `${BASE_URL}/thr_res/bid=${formFields.bid}/tid=${formFields.tid}/`
    : BASE_URL

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...getHeaders(),
      'Referer': referer,
      'Origin': BASE_URL,
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: fd,
  })
  applySetCookie(res.headers)

  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const json = await res.json()
    // クッション: JSON の html フィールドに確認フォームが入っている
    if (json.status === 'cushion' && json.html) {
      return _submitCushion(json.html, url, referer)
    }
    return json
  }

  // HTML レスポンスの場合: 内容でクッション/成功を判定
  const html = await res.text()
  if (html.includes('cushion') || html.includes('クッション')) {
    return _submitCushion(html, url, referer)
  }
  if (
    res.url !== url ||
    html.includes('書き込みありがとう') ||
    html.includes('投稿が完了') ||
    html.includes('thr_res') ||
    res.ok
  ) {
    return { status: 'success' }
  }
  return { status: 'error' }
}

// クッションページの確認フォームを解析して自動送信
async function _submitCushion(html, originalUrl, referer) {
  // フォームの action を取得（/thr_rp1/usp=... 等）
  const actionMatch = html.match(/action="([^"]+)"/i)
  if (!actionMatch) {
    console.log('[cushion] no form action found')
    return { status: 'error' }
  }
  const confirmUrl = actionMatch[1].startsWith('http')
    ? actionMatch[1]
    : BASE_URL + actionMatch[1]

  // hidden input を全て収集（value がないフィールドは空文字で送信）
  const fd2 = new FormData()
  const inputRegex = /<input[^>]*>/gi
  let m
  while ((m = inputRegex.exec(html)) !== null) {
    const typeMatch = m[0].match(/type="([^"]+)"/i)
    const t = typeMatch ? typeMatch[1].toLowerCase() : 'hidden'
    if (['button', 'submit', 'reset', 'image'].includes(t)) continue
    const nameMatch = m[0].match(/name="([^"]+)"/i)
    const valueMatch = m[0].match(/value="([^"]*)"/i)
    if (nameMatch) {
      fd2.append(nameMatch[1], valueMatch ? valueMatch[1] : '')
    }
  }

  const res2 = await fetch(confirmUrl, {
    method: 'POST',
    headers: {
      ...getHeaders(),
      'Referer': originalUrl,
      'Origin': BASE_URL,
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: fd2,
  })
  applySetCookie(res2.headers)

  const ct2 = res2.headers.get('content-type') || ''
  if (ct2.includes('application/json')) {
    return res2.json()
  }
  if (res2.ok) return { status: 'success' }
  return { status: 'error' }
}

export async function search(acode, word, page = 1) {
  const encoded = encodeURIComponent(word)
  const path = page > 1
    ? `/sch_thr_thread/acode=${acode}/word=${encoded}/p=${page}/`
    : `/sch_thr_thread/acode=${acode}/word=${encoded}/`
  const html = await doGet(path)
  const results = parseSearch(html)
  const nextPageMatch = html.match(/href="\/sch_thr_thread\/[^"]+\/p=(\d+)\/"/)
  const nextPage = nextPageMatch ? parseInt(nextPageMatch[1], 10) : null
  return { results, nextPage }
}
