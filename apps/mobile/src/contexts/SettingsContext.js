import React, { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const SettingsContext = createContext()

const DEFAULT_ACODE = 3

const load = async (key, fallback) => {
  try {
    const v = await AsyncStorage.getItem(key)
    return v !== null ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}

const save = (key, value) => {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {})
}

export const SettingsContextProvider = ({ children }) => {
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false)
  const [acode, setAcodeState] = useState(DEFAULT_ACODE)
  const [ngWords, setNgWordsState] = useState([])
  const [favorites, setFavoritesState] = useState([])
  const [favoriteThreads, setFavoriteThreadsState] = useState([])
  const [readHistory, setReadHistoryState] = useState([])
  const [readSet, setReadSet] = useState({})
  const [seenCounts, setSeenCounts] = useState({})
  // スレ表示モード: false=最新から(デフォルト) / true=最初から (全スレ共通・永続化)
  const [readFromStart, setReadFromStartState] = useState(true)
  const [memo, setMemoState] = useState('')
  const [appEulaAccepted, setAppEulaAcceptedState] = useState(false)
  const [postEulaAccepted, setPostEulaAcceptedState] = useState(false)
  // rw=1 モードで最後に読んでいたページ番号 { [tid]: page }
  const [readPositions, setReadPositionsState] = useState({})
  // スレごとの表示モード上書き { [tid]: boolean } — undefined の場合はグローバルデフォルトを使用
  const [threadReadModes, setThreadReadModesState] = useState({})
  // 自分が投稿したレスの rrid 一覧 { [tid]: number[] }
  const [myPosts, setMyPostsState] = useState({})

  useEffect(() => {
    ;(async () => {
      setAcodeState(await load('@bakusai_acode', DEFAULT_ACODE))
      setNgWordsState(await load('@bakusai_ngwords', []))
      setFavoritesState(await load('@bakusai_favorites', []))
      setFavoriteThreadsState(await load('@bakusai_fav_threads', []))
      setReadHistoryState(await load('@bakusai_history', []))
      setReadSet(await load('@bakusai_readset', {}))
      setSeenCounts(await load('@bakusai_seencounts', {}))
      setReadFromStartState(await load('@bakusai_read_from_start', true))
      setMemoState(await load('@bakusai_memo', ''))
      setAppEulaAcceptedState(await load('@bakusai_app_eula', false))
      setPostEulaAcceptedState(await load('@bakusai_post_eula', false))
      setReadPositionsState(await load('@bakusai_readpos', {}))
      setThreadReadModesState(await load('@bakusai_thread_read_modes', {}))
      setMyPostsState(await load('@bakusai_my_posts', {}))
      setIsSettingsLoaded(true)
    })()
  }, [])

  const setAcode = (v) => {
    setAcodeState(v)
    save('@bakusai_acode', v)
  }

  const setNgWords = (v) => {
    setNgWordsState(v)
    save('@bakusai_ngwords', v)
  }

  const addFavorite = (board) => {
    const next = [
      board,
      ...favorites.filter((f) => !(f.bid === board.bid && f.acode === board.acode)),
    ]
    setFavoritesState(next)
    save('@bakusai_favorites', next)
  }

  const removeFavorite = (bid, acode) => {
    const next = favorites.filter((f) => !(f.bid === bid && f.acode === acode))
    setFavoritesState(next)
    save('@bakusai_favorites', next)
  }

  const addHistory = (entry) => {
    const next = [
      entry,
      ...readHistory.filter((h) => h.tid !== entry.tid),
    ].slice(0, 200)
    setReadHistoryState(next)
    save('@bakusai_history', next)
  }

  const setReadHistory = (next) => {
    setReadHistoryState(next)
    save('@bakusai_history', next)
  }

  const markRead = (tid, rrid) => {
    const next = { ...readSet, [String(tid)]: rrid }
    setReadSet(next)
    save('@bakusai_readset', next)
  }

  // スレ一覧で「既読時の resCount」を記録し、新着バッジ判定に使う
  const markSeen = (tid, resCount) => {
    const next = { ...seenCounts, [String(tid)]: resCount }
    setSeenCounts(next)
    save('@bakusai_seencounts', next)
  }

  const addFavoriteThread = (entry) => {
    const next = [
      entry,
      ...favoriteThreads.filter((t) => t.tid !== entry.tid),
    ]
    setFavoriteThreadsState(next)
    save('@bakusai_fav_threads', next)
  }

  const removeFavoriteThread = (tid) => {
    const next = favoriteThreads.filter((t) => t.tid !== tid)
    setFavoriteThreadsState(next)
    save('@bakusai_fav_threads', next)
  }

  // 表示モード切替: 全スレ共通・永続化
  const setReadFromStart = (v) => {
    setReadFromStartState(v)
    save('@bakusai_read_from_start', v)
  }

  const setMemo = (v) => {
    setMemoState(v)
    save('@bakusai_memo', v)
  }

  const acceptAppEula = () => {
    setAppEulaAcceptedState(true)
    save('@bakusai_app_eula', true)
  }

  const acceptPostEula = () => {
    setPostEulaAcceptedState(true)
    save('@bakusai_post_eula', true)
  }

  // 自分が投稿したレスの rrid を追加
  const addMyPosts = (tid, rrids) => {
    if (!rrids || rrids.length === 0) return
    const prev = myPosts[String(tid)] || []
    const next = { ...myPosts, [String(tid)]: [...new Set([...prev, ...rrids])] }
    setMyPostsState(next)
    save('@bakusai_my_posts', next)
  }

  // スレごとの表示モード上書きを保存
  const setThreadReadMode = (tid, mode) => {
    const next = { ...threadReadModes, [String(tid)]: mode }
    setThreadReadModesState(next)
    save('@bakusai_thread_read_modes', next)
  }

  // rw=1 モードの再開ページを保存（tid → page number）
  const saveReadPosition = (tid, page) => {
    if (!page || page < 1) return
    const next = { ...readPositions, [String(tid)]: page }
    setReadPositionsState(next)
    save('@bakusai_readpos', next)
  }

  // すべての設定・データをデフォルト値にリセット（AsyncStorage は呼び出し元でクリア済み前提）
  const resetAllSettings = () => {
    setAcodeState(DEFAULT_ACODE)
    setNgWordsState([])
    setFavoritesState([])
    setFavoriteThreadsState([])
    setReadHistoryState([])
    setReadSet({})
    setSeenCounts({})
    setReadFromStartState(true)
    setMemoState('')
    setAppEulaAcceptedState(false)
    setPostEulaAcceptedState(false)
    setReadPositionsState({})
    setThreadReadModesState({})
    setMyPostsState({})
  }

  // 成人・ギャンブルカテゴリ表示判定
  const SHOW_RESTRICTED_WORDS = ['全部', '全て', 'all', 'ぜんぶ', 'すべて', 'zenbu']
  const showRestricted = SHOW_RESTRICTED_WORDS.some((w) =>
    memo.toLowerCase().includes(w.toLowerCase()),
  )

  return (
    <SettingsContext.Provider
      value={{
        isSettingsLoaded,
        acode,
        setAcode,
        ngWords,
        setNgWords,
        favorites,
        addFavorite,
        removeFavorite,
        favoriteThreads,
        addFavoriteThread,
        removeFavoriteThread,
        readHistory,
        addHistory,
        setReadHistory,
        readSet,
        markRead,
        seenCounts,
        markSeen,
        readFromStart,
        setReadFromStart,
        memo,
        setMemo,
        showRestricted,
        appEulaAccepted,
        acceptAppEula,
        postEulaAccepted,
        acceptPostEula,
        readPositions,
        saveReadPosition,
        threadReadModes,
        setThreadReadMode,
        myPosts,
        addMyPosts,
        resetAllSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
