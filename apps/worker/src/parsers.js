// bakusai.js から抽出した純粋パーサー関数
// AsyncStorage 等のランタイム依存なし

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
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&hellip;/g, '\u2026')
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ''))
}

function stripTagsDeep(html) {
  if (!html) return ''
  let s = html
  for (let i = 0; i < 2; i++) {
    s = decodeEntities(s)
    s = s.replace(/<[^>]*>/g, '')
  }
  return decodeEntities(s)
}

function normalizeTitle(html) {
  if (!html) return ''
  return stripTagsDeep(html).replace(/\s+/g, ' ').trim()
}

function extractBoardName(innerHtml) {
  const brdNameMatch = innerHtml.match(/class="brdName(?=["\s])[^"]*"[^>]*>([\s\S]*?)<\/div>/)
  if (brdNameMatch) {
    return decodeEntities(stripTags(brdNameMatch[1])).trim()
  }
  return stripTags(innerHtml)
}

function cleanBoardName(raw) {
  if (!raw) return null
  if (raw.includes('\u3082\u3063\u3068\u898b\u308b') || raw.includes('\u3082\u3063\u3068\u0020\u898b\u308b')) return null
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return null
  if (lines[0] === 'PICKUP!' && lines.length > 1) return lines[1]
  return lines[0]
}

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
  const parts = html.split(/<li\s+data-tid=/)

  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i]
    const tidMatch = chunk.match(/^"(\d+)"/)
    if (!tidMatch) continue
    const tid = tidMatch[1]

    const hrefMatch = chunk.match(/href="(\/thr_res\/[^"]+)"/)
    const href = hrefMatch ? hrefMatch[1] : ''

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
        updatedAt = decodeEntities(
          udBlock.substring(0, firstSpan).replace(/<[^>]*>/g, '').trim(),
        ).trim()
      }

      const nums = [...udBlock.matchAll(/<span>([\d,]+)<\/span>/g)].map((n) =>
        parseInt(n[1].replace(/,/g, ''), 10),
      )
      resCount = nums[nums.length - 1] || 0
    }

    const isPinned = chunk.includes('row_fixed_icon')

    if (tid && title) {
      threads.push({ tid, title, href, updatedAt, resCount, isPinned })
    }
  }

  // image-board layout fallback
  if (threads.length === 0) {
    const wRegex =
      /<li>\s*<a\s+href="(\/thr_res\/[^"]*\/tid=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/g
    let wm
    while ((wm = wRegex.exec(html)) !== null) {
      const href = wm[1]
      const tid = wm[2]
      const inner = wm[3]

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

  let nextPage = null
  const pagingM = html.match(
    /class="paging_nex_res_and_button"[\s\S]{0,600}?href="(\/thr_tl\/[^"]+)"/,
  )
  if (pagingM) nextPage = pagingM[1]

  return { threads, nextPage }
}

export function parseThread(html, currentPage = null) {
  const responses = []
  const parts = html.split(/<li\s+id="res/)

  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i]
    const rridMatch = chunk.match(/^(\d+)_block/)
    if (!rridMatch) continue
    const rrid = parseInt(rridMatch[1], 10)

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
      let bodyEnd = bodyContent.indexOf('</div>')
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
          .replace(/\u00a0/g, ' ')
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !l.includes('\u753b\u50cf\u62e1\u5927'))
          .join('\n')
          .trim()
      }
    }

    if (!body) continue

    let name = '\u533f\u540d\u3055\u3093'
    const nameAreaIdx = chunk.indexOf('class="name"')
    if (nameAreaIdx !== -1) {
      const nameArea = chunk.substring(nameAreaIdx, nameAreaIdx + 400)
      const spanMatch = nameArea.match(/<span[^>]*>([^<]+)<\/span>/)
      if (spanMatch) {
        const parsed = spanMatch[1].trim()
        if (parsed) name = parsed
      }
    }

    let imageUrl = null
    const resImgIdx = chunk.indexOf('class="res_img"')
    if (resImgIdx !== -1) {
      const resImgArea = chunk.substring(resImgIdx, resImgIdx + 1000)
      const dataOrigM = resImgArea.match(/data-original="([^"]+)"/)
      if (dataOrigM) imageUrl = dataOrigM[1]
    }

    responses.push({ rrid, date, body, name, imageUrl })
  }

  const seen = new Set()
  const uniqueResponses = responses.filter((r) => {
    if (seen.has(r.rrid)) return false
    seen.add(r.rrid)
    return true
  })

  // res0_whole (image/news boards) - simplified for monitor
  const res0WholeM = html.match(/<li[^>]*id="res0_whole"[^>]*>([\s\S]*?)(?=<li\s|<\/ul>)/)
  if (res0WholeM) {
    const res0Block = res0WholeM[1]
    const dateM = res0Block.match(/itemprop="datePublished"[^>]*>([\s\S]*?)<\/span>/)
    const res0date = dateM ? dateM[1].trim() : ''
    const titleM = res0Block.match(/class="bg_thrtitle[^"]*"[\s\S]*?<p>([\s\S]*?)<\/p>/)
    const res0title = titleM ? normalizeTitle(titleM[1]) : ''

    let articleText = ''
    const divBoxM = res0Block.match(/<div[^>]*id="div_box"[^>]*>([\s\S]*?)(?:<\/div>\s*<!--\s*\/showmore_list|<\/section>)/)
    if (divBoxM) {
      const paras = [...divBoxM[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
      articleText = paras
        .map((m) => decodeEntities(m[1].replace(/<[^>]*>/g, '').trim()))
        .filter((t) => t.length > 0)
        .join('\n')
    }
    if (!articleText) {
      const imgBodyM = res0Block.match(/<div[^>]*itemprop="articlebody"[^>]*>([\s\S]*?)<\/div>/)
      if (imgBodyM) {
        articleText = decodeEntities(
          imgBodyM[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
        ).split('\n').map((l) => l.trim()).filter((l) => l.length > 0).join('\n').trim()
      }
    }

    const res0body = [res0title, articleText].filter(Boolean).join('\n\n')
    if (res0body && !uniqueResponses.some((r) => r.rrid === 0)) {
      uniqueResponses.unshift({ rrid: 0, date: res0date, body: res0body, name: '' })
    }
  }

  const formFields = parseFormFields(html)

  const titleMatch = html.match(/<title>([^<]+)<\/title>/)
  const rawTitle = titleMatch ? normalizeTitle(titleMatch[1]) : ''
  const pageTitle = rawTitle.split('\uff5c')[0].trim()

  const totalCountMatch = rawTitle.match(/(\d+)\u30ec\u30b9/)
  const totalCount = totalCountMatch ? parseInt(totalCountMatch[1], 10) : null

  const tidMatch = html.match(/var thr_thread_tid = '(\d+)'/)
  const bidMatch = html.match(/var thr_bbs_bid = '(\d+)'/)

  let nextRw1Page = null
  let nextNormalPage = null
  const pagingIdx = html.indexOf('class="paging_nex_res_and_button"')
  if (pagingIdx !== -1) {
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

  return {
    responses: uniqueResponses,
    formFields,
    pageTitle,
    tid: tidMatch ? tidMatch[1] : '',
    bid: bidMatch ? bidMatch[1] : '',
    totalCount,
    nextRw1Page,
    nextNormalPage,
  }
}

export function parseFormFields(html) {
  const formStart = html.indexOf('name="directForm"')
  if (formStart === -1) return null

  const formTagStart = html.lastIndexOf('<form', formStart)
  const formTagEnd = html.indexOf('</form>', formStart)
  if (formTagStart === -1 || formTagEnd === -1) return null

  const formHtml = html.substring(formTagStart, formTagEnd)

  const actionMatch = formHtml.match(/action="([^"]+)"/)
  const fields = { _action: actionMatch ? actionMatch[1] : '' }

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
      const numsMatch = [...content.matchAll(/<span>(\d+)<\/span>/g)].map((n) =>
        parseInt(n[1], 10),
      )
      const resCount = numsMatch[numsMatch.length - 1] || 0

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
        const dateM = content.match(/(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2})/)
        if (dateM) updatedAt = dateM[1]
      }

      results.push({ tid, title, href, resCount, updatedAt })
    }
  }

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
