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
  const [acode, setAcodeState] = useState(DEFAULT_ACODE)
  const [ngWords, setNgWordsState] = useState([])
  const [favorites, setFavoritesState] = useState([])
  const [readHistory, setReadHistoryState] = useState([])
  const [readSet, setReadSet] = useState({})

  useEffect(() => {
    ;(async () => {
      setAcodeState(await load('@bakusai_acode', DEFAULT_ACODE))
      setNgWordsState(await load('@bakusai_ngwords', []))
      setFavoritesState(await load('@bakusai_favorites', []))
      setReadHistoryState(await load('@bakusai_history', []))
      setReadSet(await load('@bakusai_readset', {}))
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

  const markRead = (tid, rrid) => {
    const next = { ...readSet, [String(tid)]: rrid }
    setReadSet(next)
    save('@bakusai_readset', next)
  }

  return (
    <SettingsContext.Provider
      value={{
        acode,
        setAcode,
        ngWords,
        setNgWords,
        favorites,
        addFavorite,
        removeFavorite,
        readHistory,
        addHistory,
        readSet,
        markRead,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
