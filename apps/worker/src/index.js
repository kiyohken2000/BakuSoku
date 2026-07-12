import { runAllChecks } from './checks.js'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  // データは6時間ごとにしか更新されないので5分キャッシュで十分
  'Cache-Control': 'public, max-age=300',
}

export default {
  // Cron Trigger: 定期ヘルスチェック
  async scheduled(event, env, ctx) {
    const status = await runAllChecks()
    await env.STATUS_KV.put('latest', JSON.stringify(status))
  },

  // HTTP handler
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    // ステータス取得
    if (url.pathname === '/api/status') {
      // Cache API で Worker 呼び出し回数を削減（無料プランの100k/日上限対策）
      const cache = caches.default
      const cacheKey = new Request(url.toString())
      const cached = await cache.match(cacheKey)
      if (cached) return cached

      const data = await env.STATUS_KV.get('latest')
      const response = new Response(
        data || '{"checks":[],"checkedAt":null,"allOk":false,"cloudflareDetected":false}',
        { headers: CORS_HEADERS },
      )
      ctx.waitUntil(cache.put(cacheKey, response.clone()))
      return response
    }

    // 手動トリガー（テスト・デバッグ用）
    if (url.pathname === '/api/trigger') {
      const status = await runAllChecks()
      await env.STATUS_KV.put('latest', JSON.stringify(status))
      // /api/status のエッジキャッシュを破棄（stale データを配り続けないように）
      const statusUrl = new URL('/api/status', url.origin)
      await caches.default.delete(new Request(statusUrl.toString()))
      return new Response(JSON.stringify(status, null, 2), {
        headers: CORS_HEADERS,
      })
    }

    return new Response('Not Found', { status: 404 })
  },
}
