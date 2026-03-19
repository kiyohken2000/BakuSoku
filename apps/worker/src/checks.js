import {
  parseAreaTop,
  parseBoards,
  parseThreadList,
  parseThread,
  parseFormFields,
  parseSearch,
} from './parsers.js'

const BASE_URL = 'https://bakusai.com'
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
}

/**
 * fetch して HTTP ステータス・Cloudflare ヘッダー・HTML を返す
 */
async function fetchPage(path) {
  const start = Date.now()
  const res = await fetch(BASE_URL + path, {
    method: 'GET',
    headers: HEADERS,
    signal: AbortSignal.timeout(10000),
  })
  const html = await res.text()
  const durationMs = Date.now() - start

  // Workers ランタイムは server/cf-ray ヘッダーを除去するため、
  // Cloudflare 導入は HTML 内のチャレンジページ特徴で検出する
  const hasCfChallenge =
    html.includes('cf-browser-verification') ||
    html.includes('cf_chl_opt') ||
    html.includes('challenges.cloudflare.com') ||
    html.includes('Attention Required! | Cloudflare')

  return { html, httpStatus: res.status, hasCfHeaders: hasCfChallenge, durationMs }
}

/**
 * 個別チェック結果を生成するヘルパー
 */
function result(name, ok, detail, httpStatus, hasCfHeaders, durationMs, error = null) {
  return { name, ok, detail, httpStatus, hasCfHeaders, durationMs, error }
}

// ----------------------------------------
// 各チェック関数
// ----------------------------------------

async function checkParseAreaTop() {
  const name = 'parseAreaTop'
  try {
    const { html, httpStatus, hasCfHeaders, durationMs } = await fetchPage('/areatop/acode=1/')
    if (httpStatus !== 200) {
      return result(name, false, `HTTP ${httpStatus}`, httpStatus, hasCfHeaders, durationMs)
    }
    const data = parseAreaTop(html, '北海道')
    const catCount = data.categories.length
    const boardCount = Object.values(data.boardsByCtgid).flat().length
    const ok = catCount >= 1
    return result(name, ok, `categories: ${catCount}, boards: ${boardCount}`, httpStatus, hasCfHeaders, durationMs)
  } catch (e) {
    return result(name, false, '', 0, false, 0, e.message)
  }
}

async function checkParseBoards() {
  const name = 'parseBoards'
  try {
    // ctgid=104: 雑談カテゴリ（全地域に存在する安定カテゴリ）
    const { html, httpStatus, hasCfHeaders, durationMs } = await fetchPage('/bbstop/acode=1/ctgid=104/')
    if (httpStatus !== 200) {
      return result(name, false, `HTTP ${httpStatus}`, httpStatus, hasCfHeaders, durationMs)
    }
    const boards = parseBoards(html)
    const ok = boards.length >= 1
    return result(name, ok, `boards: ${boards.length}`, httpStatus, hasCfHeaders, durationMs)
  } catch (e) {
    return result(name, false, '', 0, false, 0, e.message)
  }
}

async function checkParseThreadList() {
  const name = 'parseThreadList'
  try {
    // 東京 > 雑談総合 (安定した大型掲示板)
    const { html, httpStatus, hasCfHeaders, durationMs } = await fetchPage('/thr_tl/acode=3/ctgid=104/bid=2244/')
    if (httpStatus !== 200) {
      return result(name, false, `HTTP ${httpStatus}`, httpStatus, hasCfHeaders, durationMs)
    }
    const data = parseThreadList(html)
    const ok = data.threads.length >= 1
    // 後続チェックのためにスレッド情報を返す
    const firstThread = data.threads[0] || null
    return {
      ...result(name, ok, `threads: ${data.threads.length}`, httpStatus, hasCfHeaders, durationMs),
      _firstThread: firstThread,
    }
  } catch (e) {
    return { ...result(name, false, '', 0, false, 0, e.message), _firstThread: null }
  }
}

async function checkParseThread(threadListResult) {
  const name = 'parseThread'
  try {
    // スレッド一覧の結果からスレッドURLを取得
    let path
    if (threadListResult?._firstThread?.href) {
      path = threadListResult._firstThread.href
    } else {
      // フォールバック: 東京雑談の適当なスレ一覧ページから最新ページ
      path = '/thr_tl/acode=3/ctgid=104/bid=2244/'
      const { html: listHtml } = await fetchPage(path)
      const listData = parseThreadList(listHtml)
      if (listData.threads.length > 0) {
        path = listData.threads[0].href
      }
    }

    const { html, httpStatus, hasCfHeaders, durationMs } = await fetchPage(path)
    if (httpStatus !== 200) {
      return result(name, false, `HTTP ${httpStatus}`, httpStatus, hasCfHeaders, durationMs)
    }
    const data = parseThread(html, 1)
    const ok = data.responses.length >= 1
    return {
      ...result(name, ok, `responses: ${data.responses.length}, tid: ${data.tid}`, httpStatus, hasCfHeaders, durationMs),
      _threadData: data,
      _threadHtml: html,
    }
  } catch (e) {
    return { ...result(name, false, '', 0, false, 0, e.message), _threadData: null, _threadHtml: null }
  }
}

async function checkParseSearch() {
  const name = 'parseSearch'
  try {
    const { html, httpStatus, hasCfHeaders, durationMs } = await fetchPage(
      `/sch_thr_thread/acode=1/word=${encodeURIComponent('テスト')}/`,
    )
    if (httpStatus !== 200) {
      return result(name, false, `HTTP ${httpStatus}`, httpStatus, hasCfHeaders, durationMs)
    }
    const results = parseSearch(html)
    // 検索は0件でもパースが成功していればOK
    return result(name, true, `results: ${results.length}`, httpStatus, hasCfHeaders, durationMs)
  } catch (e) {
    return result(name, false, '', 0, false, 0, e.message)
  }
}

async function checkGetResShow(threadResult) {
  const name = 'getResShow'
  try {
    const data = threadResult?._threadData
    if (!data || !data.tid || data.responses.length === 0) {
      return result(name, false, 'no thread data available', 0, false, 0)
    }

    const res = data.responses.find((r) => r.rrid > 0) || data.responses[0]
    const rrid = res.rrid
    const bid = data.bid
    const tid = data.tid
    const acode = 3
    const ctgid = 104

    const path = `/thr_res_show/acode=${acode}/ctgid=${ctgid}/bid=${bid}/tid=${tid}/rrid=${rrid}/`
    const { html, httpStatus, hasCfHeaders, durationMs } = await fetchPage(path)
    if (httpStatus !== 200) {
      return result(name, false, `HTTP ${httpStatus}`, httpStatus, hasCfHeaders, durationMs)
    }
    // thr_res_show は id="res_block"（数字なし）で parseThread にマッチしない
    // res_body の存在と中身でチェックする
    const hasResBody = html.includes('class="res_body"')
    const bodyMatch = html.match(/<div class="res_body"[^>]*>([\s\S]*?)<\/div>/)
    const bodyText = bodyMatch ? bodyMatch[1].replace(/<[^>]*>/g, '').trim() : ''
    const ok = hasResBody && bodyText.length > 0
    return result(name, ok, `rrid: ${rrid}, bodyLen: ${bodyText.length}`, httpStatus, hasCfHeaders, durationMs)
  } catch (e) {
    return result(name, false, '', 0, false, 0, e.message)
  }
}

async function checkParseFormFields(threadResult) {
  const name = 'parseFormFields'
  try {
    const html = threadResult?._threadHtml
    if (!html) {
      return result(name, false, 'no thread HTML available', 0, false, 0)
    }

    const start = Date.now()
    const fields = parseFormFields(html)
    const durationMs = Date.now() - start

    if (!fields) {
      return result(name, false, 'parseFormFields returned null', 0, false, durationMs)
    }
    const hasAction = !!fields._action
    const fieldCount = Object.keys(fields).length
    const ok = hasAction && fieldCount >= 2
    return result(name, ok, `action: ${hasAction}, fields: ${fieldCount}`, 200, false, durationMs)
  } catch (e) {
    return result(name, false, '', 0, false, 0, e.message)
  }
}

// ----------------------------------------
// メイン
// ----------------------------------------

export async function runAllChecks() {
  const checks = []

  // 独立チェックを並列実行
  const [areaTopResult, boardsResult, searchResult] = await Promise.all([
    checkParseAreaTop(),
    checkParseBoards(),
    checkParseSearch(),
  ])
  checks.push(areaTopResult, boardsResult, searchResult)

  // 依存チェーン: threadList → thread → resShow + formFields
  const threadListResult = await checkParseThreadList()
  checks.push(threadListResult)

  const threadResult = await checkParseThread(threadListResult)
  checks.push(threadResult)

  const [resShowResult, formFieldsResult] = await Promise.all([
    checkGetResShow(threadResult),
    checkParseFormFields(threadResult),
  ])
  checks.push(resShowResult, formFieldsResult)

  // 内部プロパティを除去
  for (const c of checks) {
    delete c._firstThread
    delete c._threadData
    delete c._threadHtml
  }

  // Cloudflare 検知の全体フラグ
  const cloudflareDetected = checks.some((c) => c.hasCfHeaders)

  return {
    checkedAt: new Date().toISOString(),
    checks,
    allOk: checks.every((c) => c.ok),
    cloudflareDetected,
  }
}
