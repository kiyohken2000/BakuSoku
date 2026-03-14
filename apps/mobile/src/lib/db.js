/**
 * SQLite キャッシュ層（rw=1 モード専用）
 *
 * スキーマ:
 *   responses   (tid, rrid, name, date, body, image_url)  PRIMARY KEY (tid, rrid)
 *   thread_meta (tid, title, cached_at)
 *
 * 保持ポリシー: 直近 MAX_THREADS スレ分のみ保持（古いものは自動削除）
 */

import * as SQLite from 'expo-sqlite'

const MAX_THREADS = 30

let _db = null

// ---------------------------------------------------------------------------
// 初期化（冪等・シングルトン）
// ---------------------------------------------------------------------------

export async function initDb() {
  if (_db) return _db

  _db = await SQLite.openDatabaseAsync('bakusoku.db')

  await _db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS responses (
      tid       INTEGER NOT NULL,
      rrid      INTEGER NOT NULL,
      name      TEXT    NOT NULL DEFAULT '',
      date      TEXT    NOT NULL DEFAULT '',
      body      TEXT    NOT NULL DEFAULT '',
      image_url TEXT    NOT NULL DEFAULT '',
      PRIMARY KEY (tid, rrid)
    );

    CREATE TABLE IF NOT EXISTS thread_meta (
      tid       INTEGER PRIMARY KEY,
      title     TEXT,
      cached_at INTEGER NOT NULL DEFAULT 0
    );
  `)

  // 既存 DB への image_url カラム追加マイグレーション
  const cols = await _db.getAllAsync('PRAGMA table_info(responses)')
  if (!cols.some((c) => c.name === 'image_url')) {
    await _db.execAsync("ALTER TABLE responses ADD COLUMN image_url TEXT NOT NULL DEFAULT ''")
  }

  // 起動時に古いスレのキャッシュを削除
  await pruneOldThreads()

  return _db
}

// ---------------------------------------------------------------------------
// 読み取り
// ---------------------------------------------------------------------------

/** tid に紐づくキャッシュ済みレスを rrid 昇順で全件取得 */
export async function getCachedResponses(tid) {
  const db = await initDb()
  const rows = await db.getAllAsync(
    'SELECT rrid, name, date, body, image_url FROM responses WHERE tid = ? ORDER BY rrid ASC',
    [Number(tid)],
  )
  return rows.map((r) => ({
    rrid: Number(r.rrid),
    name: r.name,
    date: r.date,
    body: r.body,
    imageUrl: r.image_url || null,
  }))
}

/** tid のキャッシュ済み最大 rrid を返す（キャッシュなしのときは 0）*/
export async function getMaxCachedRrid(tid) {
  const db = await initDb()
  const row = await db.getFirstAsync(
    'SELECT MAX(rrid) AS maxRrid FROM responses WHERE tid = ?',
    [Number(tid)],
  )
  return Number(row?.maxRrid ?? 0)
}

// ---------------------------------------------------------------------------
// 書き込み
// ---------------------------------------------------------------------------

/**
 * レスを SQLite に INSERT OR REPLACE する
 * @param {number|string} tid
 * @param {{ rrid: number, name: string, date: string, body: string, imageUrl?: string|null }[]} responses
 */
export async function insertResponses(tid, responses) {
  if (!responses || responses.length === 0) return
  const db = await initDb()

  await db.withTransactionAsync(async () => {
    for (const r of responses) {
      await db.runAsync(
        'INSERT OR REPLACE INTO responses (tid, rrid, name, date, body, image_url) VALUES (?, ?, ?, ?, ?, ?)',
        [Number(tid), Number(r.rrid), r.name ?? '', r.date ?? '', r.body ?? '', r.imageUrl ?? ''],
      )
    }
    // thread_meta を更新（cached_at を更新して eviction の優先度を下げる）
    await db.runAsync(
      'INSERT OR REPLACE INTO thread_meta (tid, cached_at) VALUES (?, ?)',
      [Number(tid), Date.now()],
    )
  })
}

/** tid のキャッシュを全削除 */
export async function clearThreadCache(tid) {
  const db = await initDb()
  await db.runAsync('DELETE FROM responses   WHERE tid = ?', [Number(tid)])
  await db.runAsync('DELETE FROM thread_meta WHERE tid = ?', [Number(tid)])
}

/** 全スレのキャッシュを削除 */
export async function clearAllCache() {
  const db = await initDb()
  await db.runAsync('DELETE FROM responses')
  await db.runAsync('DELETE FROM thread_meta')
}

// ---------------------------------------------------------------------------
// Eviction（古いスレを自動削除）
// ---------------------------------------------------------------------------

/** cached_at が古い順に MAX_THREADS を超えたスレを削除 */
async function pruneOldThreads() {
  const db = await initDb()
  // MAX_THREADS 件を超えた古いスレの tid を取得
  const stale = await db.getAllAsync(
    `SELECT tid FROM thread_meta ORDER BY cached_at DESC LIMIT -1 OFFSET ?`,
    [MAX_THREADS],
  )
  for (const row of stale) {
    await db.runAsync('DELETE FROM responses   WHERE tid = ?', [row.tid])
    await db.runAsync('DELETE FROM thread_meta WHERE tid = ?', [row.tid])
  }
}
