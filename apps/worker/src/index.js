import { runAllChecks } from './checks.js'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=60',
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
      const data = await env.STATUS_KV.get('latest')
      return new Response(data || '{"checks":[],"checkedAt":null,"allOk":false,"cloudflareDetected":false}', {
        headers: CORS_HEADERS,
      })
    }

    // 手動トリガー（テスト・デバッグ用）
    if (url.pathname === '/api/trigger') {
      const status = await runAllChecks()
      await env.STATUS_KV.put('latest', JSON.stringify(status))
      return new Response(JSON.stringify(status, null, 2), {
        headers: CORS_HEADERS,
      })
    }

    return new Response('Not Found', { status: 404 })
  },
}
