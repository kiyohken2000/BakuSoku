import { useState, useEffect, useCallback } from 'react'
import './Status.css'

const STATUS_API = import.meta.env.VITE_STATUS_API || 'https://bakusoku-monitor.votepurchase.workers.dev/api/status'

const CHECK_LABELS = {
  parseAreaTop: { name: '地域トップ', desc: '地域ごとのカテゴリ・掲示板一覧の取得' },
  parseBoards: { name: '掲示板一覧', desc: 'カテゴリ内の掲示板リストの取得' },
  parseThreadList: { name: 'スレッド一覧', desc: '掲示板内のスレッドリストの取得' },
  parseThread: { name: 'スレッド表示', desc: 'スレッド内のレス一覧の取得' },
  parseSearch: { name: '検索', desc: 'キーワードによるスレッド検索' },
  getResShow: { name: 'レス個別表示', desc: 'アンカーポップアップ用の単一レス取得' },
  parseFormFields: { name: '投稿フォーム', desc: '書き込みフォームのフィールド取得' },
}

function StatusIcon({ ok }) {
  return (
    <span className={`st-icon ${ok ? 'ok' : 'ng'}`} aria-label={ok ? '利用可能' : '問題あり'} />
  )
}

export default function Status() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(STATUS_API)
      const data = await res.json()
      setStatus(data)
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const checkedAt = status?.checkedAt
    ? new Date(status.checkedAt).toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  const allOk = status?.allOk ?? false
  const cfDetected = status?.cloudflareDetected ?? false

  return (
    <div className="st-page">
      <header className="st-header">
        <div className="st-header-inner">
          <a href="#/" className="st-back" aria-label="トップに戻る">&larr;</a>
          <h1>システム状況</h1>
        </div>
      </header>

      <main className="st-main">
        {/* サマリー */}
        <section className="st-summary">
          {loading ? (
            <p className="st-summary-text">読み込み中...</p>
          ) : !status || !status.checks?.length ? (
            <p className="st-summary-text muted">ステータスを取得できませんでした。</p>
          ) : (
            <>
              <div className={`st-summary-banner ${allOk ? 'ok' : 'ng'}`}>
                <StatusIcon ok={allOk} />
                <span>
                  {allOk
                    ? 'すべてのサービスが正常に稼働しています。'
                    : '一部のサービスに問題が発生しています。'}
                </span>
              </div>
              {cfDetected && (
                <div className="st-cf-warn">
                  Cloudflare ヘッダーが検出されました。今後スクレイピング対策が導入される可能性があります。
                </div>
              )}
              {checkedAt && (
                <p className="st-updated">最終更新: {checkedAt}</p>
              )}
            </>
          )}
        </section>

        {/* サービス一覧 */}
        {!loading && status?.checks?.length > 0 && (
          <section className="st-services">
            <ul className="st-list">
              {status.checks.map((check) => {
                const label = CHECK_LABELS[check.name] || { name: check.name, desc: '' }
                const isExpanded = expanded === check.name
                return (
                  <li key={check.name} className="st-item">
                    <button
                      className="st-item-header"
                      onClick={() => setExpanded(isExpanded ? null : check.name)}
                      aria-expanded={isExpanded}
                    >
                      <StatusIcon ok={check.ok} />
                      <span className="st-item-name">{label.name}</span>
                      <span className={`st-chevron ${isExpanded ? 'open' : ''}`} />
                    </button>
                    {isExpanded && (
                      <div className="st-item-detail">
                        <p className="st-item-desc">{label.desc}</p>
                        <dl className="st-detail-grid">
                          <dt>ステータス</dt>
                          <dd className={check.ok ? 'val-ok' : 'val-ng'}>
                            {check.ok ? '正常' : '異常'}
                          </dd>
                          <dt>HTTP</dt>
                          <dd>{check.httpStatus > 0 ? check.httpStatus : '—'}</dd>
                          <dt>応答時間</dt>
                          <dd>{check.durationMs > 0 ? `${check.durationMs}ms` : '—'}</dd>
                          <dt>詳細</dt>
                          <dd>{check.error || check.detail || '—'}</dd>
                          {check.hasCfHeaders && (
                            <>
                              <dt>CF</dt>
                              <dd className="val-ng">Cloudflare 検出</dd>
                            </>
                          )}
                        </dl>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <section className="st-note">
          <p>
            bakusai.com の HTML をパースしてデータを取得しています。
            サイトの構造変更やスクレイピング対策の導入により、一部機能が正常に動作しなくなる場合があります。
            ステータスは6時間ごとに自動更新されます。
          </p>
        </section>
      </main>

      <footer className="st-footer">
        <a href="#/">BakuSoku トップ</a>
      </footer>
    </div>
  )
}
