const INITIAL_TARGET = 49 // 7???? ? 7?? = 49? (rw=1???)

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  Linking,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import FontIcon from 'react-native-vector-icons/FontAwesome'
import * as Clipboard from 'expo-clipboard'
import { getThread, getThreadFromStart, getResShow, getRatingList, postResponse } from 'lib/bakusai'
import { createMqttClient } from 'lib/mqttClient'
import { getCachedResponses, insertResponses, clearThreadCache } from 'lib/db'
import { useSettings } from 'contexts/SettingsContext'
import { useTheme } from 'contexts/ThemeContext'

export default function ThreadDetail() {
  const navigation = useNavigation()
  const route = useRoute()
  const { acode, ctgid, bid, tid, title } = route.params
  const { ngWords, setNgWords, addHistory, markRead, readSet, readFromStart, setReadFromStart, favoriteThreads, addFavoriteThread, removeFavoriteThread, postEulaAccepted, acceptPostEula, readPositions, saveReadPosition, threadReadModes, setThreadReadMode, myPosts, addMyPosts, isSettingsLoaded } = useSettings()

  // スレ固有の上書き設定があればそちらを優先、なければグローバルデフォルトを使用
  const effectiveReadFromStart = threadReadModes[String(tid)] !== undefined
    ? threadReadModes[String(tid)]
    : readFromStart
  const { theme, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const flatListRef = useRef(null)

  const [responses, setResponses] = useState([])
  const [pageTitle, setPageTitle] = useState(title || '')
  const [formFields, setFormFields] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ratings, setRatings] = useState({})

  // ?????????????(??): ??????
  const [hasOlderPages, setHasOlderPages] = useState(false)
  const [olderPage, setOlderPage] = useState(2)
  const [loadingOlder, setLoadingOlder] = useState(false)

  // ?????????????(rw=1): ??????
  // bakusai ? rw=1: p=1=??(7?), p=2=?...??????
  const [hasNewerPages, setHasNewerPages] = useState(false)
  const [newerPage, setNewerPage] = useState(2)
  const [loadingNewer, setLoadingNewer] = useState(false)

  const [isRefreshing, setIsRefreshing] = useState(false)

  const [postBody, setPostBody] = useState('')
  const [postName, setPostName] = useState('')
  const [isPosting, setIsPosting] = useState(false)

  // anchorStack: [{rrid, response}] — 末尾が現在表示中のアンカー
  const [anchorStack, setAnchorStack] = useState([])
  const [anchorLoadingRrid, setAnchorLoadingRrid] = useState(null)
  const showAnchorPopup = anchorStack.length > 0
  const currentAnchor = anchorStack.length > 0 ? anchorStack[anchorStack.length - 1] : null

  // レスへの返信一覧ポップアップ
  const [replyListTarget, setReplyListTarget] = useState(null) // rrid
  const showReplyList = replyListTarget !== null

  const [showTitleModal, setShowTitleModal] = useState(false)
  const [showEulaModal, setShowEulaModal] = useState(false)
  const [pendingReplyTo, setPendingReplyTo] = useState(null)
  const [copyItem, setCopyItem] = useState(null)   // ????????????????
  const [copiedRrid, setCopiedRrid] = useState(null) // ?????????????
  const [showMenu, setShowMenu] = useState(false)   // ??????????????

  // ??????????????
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatchIdx, setSearchMatchIdx] = useState(0) // ??????????????
  const searchInputRef = useRef(null)

  // ???????????
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const isNearBottomRef = useRef(false)

  const [showPostModal, setShowPostModal] = useState(false)

  // MQTT ????????
  const [mqttConnected, setMqttConnected] = useState(false)
  const readFromStartRef = useRef(effectiveReadFromStart)
  useEffect(() => { readFromStartRef.current = effectiveReadFromStart }, [effectiveReadFromStart])

  // ????????????????????????????
  const resumeRridRef = useRef(null)
  const scrollTimerRef = useRef(null) // useRef ???? cleanup ? cancel ???
  const threadUrl = `https://bakusai.com/thr_res/acode=${acode}/ctgid=${ctgid}/bid=${bid}/tid=${tid}/tp=1/`
  const isFavThread = favoriteThreads.some((t) => String(t.tid) === String(tid))
  const toggleFavThread = () => {
    if (isFavThread) {
      removeFavoriteThread(tid)
    } else {
      addFavoriteThread({ tid, title: pageTitle || title, acode, ctgid, bid })
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }
  const openInBrowser = () => Linking.openURL(threadUrl)

  const clearCacheAndReload = async () => {
    try {
      await clearThreadCache(tid)
    } catch {}
    await loadThread(null, effectiveReadFromStart)
  }

  useEffect(() => {
    if (!isSettingsLoaded) return
    resumeRridRef.current = effectiveReadFromStart ? (readSet[String(tid)] ?? null) : null
    const resumePage = effectiveReadFromStart ? (readPositions?.[String(tid)] ?? null) : null
    loadThread(resumePage, effectiveReadFromStart)
  }, [isSettingsLoaded])

  // LIVE ????
  const toastOpacity = useRef(new Animated.Value(0)).current
  const toastTimer = useRef(null)
  const [toastCount, setToastCount] = useState(0)

  const showLiveToast = useCallback((count) => {
    setToastCount(count)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start()
    toastTimer.current = setTimeout(() => { toastTimer.current = null }, 2500)
  }, [toastOpacity])

  // MQTT: liveEnabled ? true ????????????
  const [liveEnabled, setLiveEnabled] = useState(false)
  useEffect(() => {
    if (!liveEnabled) return
    const client = createMqttClient(
      `thread/${tid}`,
      (msg) => {
        const newRes = {
          rrid: msg.rrid,
          body: msg.body || '',
          name: msg.name || '名無し',
          date: msg.date || '',
        }
        setResponses((prev) => {
          if (prev.some((r) => r.rrid === msg.rrid)) return prev
          if (readFromStartRef.current) {
            insertResponses(tid, [newRes]).catch(() => {})
          }
          const next = readFromStartRef.current
            ? [...prev, newRes]
            : [newRes, ...prev]
          // ?????????????
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          const newCount = next.length - prev.length
          showLiveToast(newCount)
          return next
        })
      },
      () => setMqttConnected(true),
      () => setMqttConnected(false),
    )
    return () => {
      client.disconnect()
      setMqttConnected(false)
    }
  }, [liveEnabled, tid])

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await loadThread(null, effectiveReadFromStart)
  }, [effectiveReadFromStart])

  // ?????????????? loadNewerResponses ????? ref?onScrollEndDrag ? stale closure ???
  const loadNewerResponsesRef = useRef(null)
  const consecutiveEmptyRef = useRef(0)  // ???????????????????

  // readFromStart ?????????????????
  const onScrollEndDrag = useCallback((e) => {
    if (!effectiveReadFromStart) return
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y
    if (distanceFromBottom < -24) {
      loadNewerResponsesRef.current?.()
    }
  }, [effectiveReadFromStart])

  const loadThread = async (initialPage, rfs) => {
    setError(null)

    // rw=1 ???? SQLite ?????????????
    let allResps = []
    if (rfs) {
      const cached = await getCachedResponses(tid)
      if (cached.length > 0) {
        allResps = cached
        setResponses([...cached])
        setIsLoading(false)
        setIsRefreshing(false)
      } else {
        if (!isRefreshing) setIsLoading(true)
      }
    } else {
      if (!isRefreshing) setIsLoading(true)
    }

    let page = initialPage ?? null
    let lastLoadedPage = initialPage ?? 1  // ?????????????
    let firstFetch = true

    try {
      while (true) {
        const data = rfs
          ? await getThreadFromStart(acode, ctgid, bid, tid, page)
          : await getThread(acode, ctgid, bid, tid, page)

        lastLoadedPage = page ?? 1  // null = ??=1

        // ???????????????: ?????????????????
        if (firstFetch) {
          setPageTitle(data.pageTitle || title)
          setFormFields(data.formFields)
          addHistory({ tid, title: data.pageTitle || title, acode, ctgid, bid, at: Date.now() })
          setIsLoading(false)
          setIsRefreshing(false)
          firstFetch = false
        }

        // ?????????????
        // rfs=false (??): ??+????????????
        const existRrids = new Set(allResps.map((r) => r.rrid))
        const fresh = data.responses.filter((r) => !existRrids.has(r.rrid))

        // rw=1: ???SQLite ??????
        if (rfs && fresh.length > 0) {
          insertResponses(tid, fresh).catch(() => {})
        }

        allResps = rfs ? [...allResps, ...fresh] : [...allResps, ...[...fresh].reverse()]
        setResponses([...allResps])

        const nextPage = rfs ? data.nextRw1Page : data.nextNormalPage

        // ??????????????? or ??????????? state ???
        if (!nextPage || allResps.length >= INITIAL_TARGET) {
          if (rfs) {
            setHasNewerPages(nextPage !== null)
            setNewerPage(nextPage ?? lastLoadedPage + 1)
            setHasOlderPages(false)
          } else {
            setHasOlderPages(nextPage !== null)
            setOlderPage(nextPage ?? 2)
            setHasNewerPages(false)
          }
          break
        }
        page = nextPage
      }

      if (allResps.length > 0) {
        // rfs=false ?????????
        const latestRrid = rfs
          ? allResps[allResps.length - 1].rrid
          : allResps[0].rrid
        markRead(tid, latestRrid)
        // rw=1 ??????????????????
        if (rfs) saveReadPosition(tid, lastLoadedPage)
        loadRatings(tid, allResps.map((r) => r.rrid))
      }
    } catch (e) {
      if (firstFetch) {
        setIsLoading(false)
        setIsRefreshing(false)
      }
      setError(e.message || 'データの取得に失敗しました')
    }
  }

  const toggleReadMode = () => {
    const next = !effectiveReadFromStart
    setThreadReadMode(String(tid), next)
    resumeRridRef.current = null  // モード切替後は初期位置スクロールをリセット
    setResponses([])
    loadThread(null, next)
  }

  // ?????????????(??): ????????
  const loadOlderResponses = async () => {
    if (loadingOlder) return
    setLoadingOlder(true)
    try {
      const data = await getThread(acode, ctgid, bid, tid, olderPage)
      if (data.responses.length > 0) {
        setResponses((prev) => {
          const existingRrids = new Set(prev.map((r) => r.rrid))
          // ?????????????? reverse ??????
          const newResps = [...data.responses]
            .reverse()
            .filter((r) => !existingRrids.has(r.rrid))
          return [...prev, ...newResps]
        })
        setHasOlderPages(data.nextNormalPage !== null)
        setOlderPage(data.nextNormalPage ?? olderPage + 1)
        loadRatings(tid, data.responses.map((r) => r.rrid))
      } else {
        setHasOlderPages(false)
      }
    } catch {}
    setLoadingOlder(false)
  }

  // ?????????????(rw=1): ??????(??????=??????) ???
  // ? ????? ref ????? onScrollEndDrag ? stale closure ???
  const loadNewerResponses = async () => {
    if (loadingNewer) return
    setLoadingNewer(true)
    try {
      const data = await getThreadFromStart(acode, ctgid, bid, tid, newerPage)
      if (data.responses.length > 0) {
        consecutiveEmptyRef.current = 0  // ????????????????????
        const latestRrid = data.responses[data.responses.length - 1].rrid
        setResponses((prev) => {
          const existingRrids = new Set(prev.map((r) => r.rrid))
          const newResps = data.responses.filter((r) => !existingRrids.has(r.rrid))
          // rw=1 ????????
          if (newResps.length > 0) insertResponses(tid, newResps).catch(() => {})
          return [...prev, ...newResps]
        })
        setHasNewerPages(data.nextRw1Page !== null)
        setNewerPage(data.nextRw1Page ?? newerPage + 1)
        saveReadPosition(tid, newerPage)
        markRead(tid, latestRrid)  // ?????????????? RRID ????????????
        loadRatings(tid, data.responses.map((r) => r.rrid))
      } else if (data.nextRw1Page !== null) {
        // 0??? nextRw1Page ?????????????????
        consecutiveEmptyRef.current = 0
        setHasNewerPages(true)
        setNewerPage(data.nextRw1Page)
      } else {
        // 0??? nextRw1Page ??
        consecutiveEmptyRef.current += 1
        if (consecutiveEmptyRef.current <= 3) {
          // ??3????????????????
          setHasNewerPages(true)
          setNewerPage(newerPage + 1)
        } else {
          // 3???? ? ?????
          consecutiveEmptyRef.current = 0
          setHasNewerPages(false)
        }
      }
    } catch {}
    setLoadingNewer(false)
  }
  // loadNewerResponsesRef ??????????
  loadNewerResponsesRef.current = loadNewerResponses

  const loadRatings = async (tid, rrids) => {
    try {
      if (rrids.length === 0) return
      const list = await getRatingList(tid, [0, ...rrids])
      const newRatings = {}
      rrids.forEach((rrid, i) => {
        const entry = list[i + 1]
        if (entry) {
          newRatings[rrid] = {
            good: entry['1']?.count || 0,
            bad: entry['2']?.count || 0,
          }
        }
      })
      setRatings((prev) => ({ ...prev, ...newRatings }))
    } catch {}
  }

  const onAnchorPress = async (refRrid) => {
    Haptics.selectionAsync()
    const cached = responses.find((r) => r.rrid === refRrid)
    if (cached) {
      setAnchorStack((prev) => [...prev, { rrid: refRrid, response: cached }])
      return
    }
    setAnchorStack((prev) => [...prev, { rrid: refRrid, response: null }])
    setAnchorLoadingRrid(refRrid)
    try {
      const res = await getResShow(acode, ctgid, bid, tid, refRrid)
      setAnchorStack((prev) => {
        const next = [...prev]
        const idx = next.findLastIndex((item) => item.rrid === refRrid && item.response === null)
        if (idx >= 0) next[idx] = { rrid: refRrid, response: res || null }
        return next
      })
    } catch {
      setAnchorStack((prev) => {
        const next = [...prev]
        const idx = next.findLastIndex((item) => item.rrid === refRrid && item.response === null)
        if (idx >= 0) next[idx] = { rrid: refRrid, response: null }
        return next
      })
    } finally {
      setAnchorLoadingRrid(null)
    }
  }

  const renderBodyWithAnchors = useCallback(
    (body) => {
      const parts = body.split(/(>>\d+)/g)
      return (
        <Text style={[styles.body, { color: theme.text }]} selectable>
          {parts.map((part, idx) => {
            const m = part.match(/^>>(\d+)$/)
            if (m) {
              return (
                <Text
                  key={idx}
                  style={{ color: theme.accent, fontWeight: '600' }}
                  onPress={() => onAnchorPress(parseInt(m[1], 10))}
                >
                  {part}
                </Text>
              )
            }
            return part
          })}
        </Text>
      )
    },
    [theme, responses],
  )

  const openPostModalWithEulaCheck = (replyRrid = null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (!postEulaAccepted) {
      setPendingReplyTo(replyRrid)
      setShowEulaModal(true)
    } else {
      if (replyRrid != null) setPostBody(`>>${replyRrid}\n`)
      setShowPostModal(true)
    }
  }

  const onEulaAccept = () => {
    acceptPostEula()
    setShowEulaModal(false)
    if (pendingReplyTo != null) setPostBody(`>>${pendingReplyTo}\n`)
    setPendingReplyTo(null)
    setShowPostModal(true)
  }

  const openReplyTo = (rrid) => openPostModalWithEulaCheck(rrid)

  const copyToClipboard = async (text, rrid) => {
    await Clipboard.setStringAsync(text)
    setCopiedRrid(rrid)
    setTimeout(() => setCopiedRrid(null), 1500)
  }

  const onReport = (item) => {
    const url = `https://bakusai.com/thr_res/acode=${acode}/ctgid=${ctgid}/bid=${bid}/tid=${tid}/`
    Alert.alert(
      '通報',
      `>>>${item.rrid} を通報しますか？\nブラウザで bakusai.com の通報ページを開きます。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '通報する', onPress: () => Linking.openURL(url) },
      ],
    )
  }

  const onRridPress = (rrid) => {
    Haptics.selectionAsync()
    setReplyListTarget(rrid)
  }

  const onBlockUser = (item) => {
    const name = item.name?.trim()
    if (!name) return
    if (ngWords.includes(name)) {
      Alert.alert('ブロック済み', `「${name}」はすでにNGワードに登録されています。`)
      return
    }
    Alert.alert(
      'ユーザーをブロック',
      `「${name}」をブロックしますか？\nこのユーザーの投稿がNGワードとして非表示になります。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ブロックする',
          style: 'destructive',
          onPress: () => setNgWords([...ngWords, name]),
        },
      ],
    )
  }

  const onPost = async () => {
    if (!postBody.trim() || !formFields) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsPosting(true)
    // 投稿前の最大 rrid を記録しておく
    const prevMaxRrid = responses.length > 0
      ? Math.max(...responses.map((r) => r.rrid))
      : 0
    const postedBody = postBody.trim()
    try {
      const result = await postResponse(
        formFields._action,
        formFields,
        postedBody,
        postName.trim(),
      )
      if (result?.status === 'success') {
        setPostBody('')
        setPostName('')
        setShowPostModal(false)
        await loadThread(null, effectiveReadFromStart)
        // リロード後、prevMaxRrid より大きくて投稿内容が一致するレスが自分のレス
        setResponses((current) => {
          const mine = current
            .filter((r) => r.rrid > prevMaxRrid && r.body.trim() === postedBody)
            .map((r) => r.rrid)
          if (mine.length > 0) addMyPosts(tid, mine)
          return current
        })
      } else {
        Alert.alert('エラー', `投稿に失敗しました\nstatus: ${result?.status ?? 'undefined'}`)
      }
    } catch (e) {
      Alert.alert('エラー', e.message || '投稿に失敗しました')
    } finally {
      setIsPosting(false)
    }
  }

  const filteredResponsesRaw = responses.filter(
    (r) => !ngWords.some((w) => r.body.includes(w) || r.name.includes(w)),
  )
  const filteredResponses =
    pageTitle && filteredResponsesRaw.length === 0
      ? [{ rrid: 0, date: '', body: pageTitle, name: '' }]
      : filteredResponsesRaw

  // 各 rrid への返信件数 { [rrid]: count }
  const replyCounts = useMemo(() => {
    const counts = {}
    for (const r of responses) {
      const anchors = r.body.match(/>>(\d+)/g)
      if (!anchors) continue
      for (const a of anchors) {
        const n = parseInt(a.slice(2), 10)
        counts[n] = (counts[n] || 0) + 1
      }
    }
    return counts
  }, [responses])

  const savedRrid = readSet[String(tid)]

  // 「ここまで読んだ」セパレーターは最初から読むモードのときのみ表示
  const displayResponses = useMemo(() => {
    if (!effectiveReadFromStart || !savedRrid || filteredResponses.length === 0) return filteredResponses
    const idx = filteredResponses.findIndex((r) => r.rrid === savedRrid)
    if (idx < 0) return filteredResponses
    return [
      ...filteredResponses.slice(0, idx + 1),
      { rrid: '__resume_separator__', isSeparator: true },
      ...filteredResponses.slice(idx + 1),
    ]
  }, [filteredResponses, savedRrid, effectiveReadFromStart])

  // ?????????????????displayResponses ? index ????
  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return displayResponses.reduce((acc, item, idx) => {
      if (!item.isSeparator && (item.body.toLowerCase().includes(q) || item.name.toLowerCase().includes(q))) {
        acc.push(idx)
      }
      return acc
    }, [])
  }, [displayResponses, searchQuery])

  // ??????????????????????????
  useEffect(() => { setSearchMatchIdx(0) }, [searchQuery])

  const searchPrev = () => {
    if (searchMatches.length === 0) return
    const next = (searchMatchIdx - 1 + searchMatches.length) % searchMatches.length
    setSearchMatchIdx(next)
    flatListRef.current?.scrollToIndex({ index: searchMatches[next], animated: true, viewPosition: 0.3 })
  }
  const searchNext = () => {
    if (searchMatches.length === 0) return
    const next = (searchMatchIdx + 1) % searchMatches.length
    setSearchMatchIdx(next)
    flatListRef.current?.scrollToIndex({ index: searchMatches[next], animated: true, viewPosition: 0.3 })
  }
  const closeSearch = () => {
    setShowSearch(false)
    setSearchQuery('')
    setSearchMatchIdx(0)
  }

  // ???????????????????
  // scrollTimerRef ?????displayResponses ????????? timer ? cancel ???
  useEffect(() => {
    if (scrollTimerRef.current) return // ??????????????????????
    if (!resumeRridRef.current || displayResponses.length === 0) return
    const idx = displayResponses.findIndex((r) => r.rrid === resumeRridRef.current)
    if (idx < 0) return
    resumeRridRef.current = null // ????????????????
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = null
      try {
        flatListRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0 })
      } catch {}
    }, 500)
    // cleanup ????flatListRef.current ? null ?????????????
  }, [displayResponses])

  const renderResponse = ({ item, index }) => {
    if (item.isSeparator) {
      return (
        <View style={[styles.resumeSeparator]}>
          <View style={[styles.resumeLine, { backgroundColor: theme.accent }]} />
          <Text style={[styles.resumeLabel, { color: theme.accent, backgroundColor: theme.bg }]}>
            既読ここまで
          </Text>
          <View style={[styles.resumeLine, { backgroundColor: theme.accent }]} />
        </View>
      )
    }
    const rating = ratings[item.rrid] || { good: 0, bad: 0 }
    const isSearchMatch = searchMatches.includes(index)
    const isCurrentMatch = searchMatches.length > 0 && searchMatches[searchMatchIdx] === index
    const myRrids = myPosts[String(tid)] || []
    const isMyPost = myRrids.includes(item.rrid)
    const isReplyToMe = !isMyPost && myRrids.some((r) => item.body.includes(`>>${r}`))
    return (
      <View
        style={[
          styles.responseItem,
          { borderBottomColor: theme.border },
          isMyPost && styles.myPostItem,
          isReplyToMe && styles.replyToMeItem,
          isCurrentMatch
            ? { backgroundColor: theme.accent + '22' }
            : isSearchMatch
              ? { backgroundColor: theme.accent + '11' }
              : isMyPost
                ? { backgroundColor: '#f9731611' }
                : isReplyToMe
                  ? { backgroundColor: '#3b82f611' }
                  : { backgroundColor: theme.surface },
        ]}
      >
        <View style={styles.responseHeader}>
          <Text
            style={[styles.rrid, { color: theme.accent }]}
            onPress={() => onRridPress(item.rrid)}
            suppressHighlighting
          >#{item.rrid}</Text>
          {replyCounts[item.rrid] > 0 && (
            <TouchableOpacity
              onPress={() => onRridPress(item.rrid)}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              style={styles.replyCountBtn}
            >
              <Text style={[styles.replyCountText, { color: theme.accent }]}>
                {replyCounts[item.rrid]}件
              </Text>
            </TouchableOpacity>
          )}
          {isMyPost && <Text style={styles.myPostBadge}>自分</Text>}
          {isReplyToMe && <Text style={styles.replyToMeBadge}>返信</Text>}
          <Text style={[styles.name, { color: theme.subText }]}>{item.name}</Text>
          <Text style={[styles.date, { color: theme.subText }]}>{item.date}</Text>
        </View>
        {renderBodyWithAnchors(item.body)}
        <View style={styles.responseFooter}>
          {(rating.good > 0 || rating.bad > 0) && (
            <View style={styles.goodBadRow}>
              <Text style={[styles.goodBadText, { color: theme.good }]}>
                👍 {rating.good}
              </Text>
              <Text style={[styles.goodBadText, { color: theme.bad, marginLeft: 12 }]}>
                👎 {rating.bad}
              </Text>
            </View>
          )}
          <View style={styles.responseActions}>
            <TouchableOpacity
              style={styles.replyBtn}
              onPress={() => openReplyTo(item.rrid)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <FontIcon name="reply" size={13} color={theme.subText} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.replyBtn}
              onPress={() => { setCopyItem(item); setCopiedRrid(null) }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <FontIcon name="clipboard" size={13} color={theme.subText} />
            </TouchableOpacity>
            {item.name?.trim() ? (
              <TouchableOpacity
                style={styles.replyBtn}
                onPress={() => onBlockUser(item)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <FontIcon name="ban" size={13} color={theme.subText} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.replyBtn}
              onPress={() => onReport(item)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <FontIcon name="flag" size={13} color={theme.subText} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />

      <View style={[styles.header, { backgroundColor: theme.header, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <FontIcon name="chevron-left" size={18} color={theme.headerText} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerTitleBtn}
          onPress={() => setShowTitleModal(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.headerTitle, { color: theme.headerText }]} numberOfLines={1}>
            {pageTitle}
          </Text>
          {mqttConnected && (
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => { setShowSearch((v) => !v); setSearchQuery(''); setSearchMatchIdx(0) }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <FontIcon name={showSearch ? 'times' : 'search'} size={17} color={showSearch ? theme.accent : theme.headerText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => openPostModalWithEulaCheck()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <FontIcon name="pencil" size={18} color={theme.headerText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setShowMenu(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <FontIcon name="ellipsis-v" size={18} color={theme.headerText} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ??????? */}
      {showSearch && (
        <View style={[styles.searchBar, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
          <FontIcon name="search" size={14} color={theme.subText} style={{ marginRight: 6 }} />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="スレ内を検索..."
            placeholderTextColor={theme.subText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Text style={[styles.searchCount, { color: theme.subText }]}>
              {searchMatches.length > 0 ? `${searchMatchIdx + 1}/${searchMatches.length}` : '0?'}
            </Text>
          )}
          <TouchableOpacity onPress={searchPrev} disabled={searchMatches.length === 0} style={styles.searchNav} hitSlop={8}>
            <FontIcon name="chevron-up" size={14} color={searchMatches.length > 0 ? theme.text : theme.subText} />
          </TouchableOpacity>
          <TouchableOpacity onPress={searchNext} disabled={searchMatches.length === 0} style={styles.searchNav} hitSlop={8}>
            <FontIcon name="chevron-down" size={14} color={searchMatches.length > 0 ? theme.text : theme.subText} />
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.subText }]}>{error}</Text>
          <TouchableOpacity
            onPress={() => loadThread(null)}
            style={[styles.retryBtn, { borderColor: theme.accent }]}
          >
            <Text style={{ color: theme.accent }}>再読込</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.listWrapper}>
        <FlatList
          ref={flatListRef}
          data={displayResponses}
          keyExtractor={(item) => String(item.rrid)}
          renderItem={renderResponse}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={theme.accent}
            />
          }
          ListHeaderComponent={null}
          ListFooterComponent={
            effectiveReadFromStart ? (
              // ?????????????(??): ??????? or ???????
              loadingNewer ? (
                <View style={styles.autoLoadIndicator}>
                  <ActivityIndicator size="small" color={theme.accent} />
                </View>
              ) : !hasNewerPages ? (
                <View style={styles.pullUpHint}>
                  <FontIcon name="arrow-up" size={11} color={theme.subText} />
                  <Text style={[styles.pullUpHintText, { color: theme.subText }]}>
                    引っ張って更新
                  </Text>
                </View>
              ) : null
            ) : (
              // ?????????????(??): ????????????
              loadingOlder ? (
                <View style={styles.autoLoadIndicator}>
                  <ActivityIndicator size="small" color={theme.accent} />
                </View>
              ) : null
            )
          }
          onEndReached={() => {
            if (effectiveReadFromStart && hasNewerPages && !loadingNewer) {
              loadNewerResponsesRef.current?.()
            }
            if (!effectiveReadFromStart && hasOlderPages && !loadingOlder) {
              loadOlderResponses()
            }
          }}
          onEndReachedThreshold={0.3}
          onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
            const distFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y
            const near = distFromBottom < 120
            if (near !== isNearBottomRef.current) {
              isNearBottomRef.current = near
              setShowScrollBottom(!near)
            }
          }}
          scrollEventThrottle={200}
          onScrollEndDrag={onScrollEndDrag}
          onScrollToIndexFailed={({ index }) => {
            // ???????????????????????????????????
            flatListRef.current?.scrollToEnd({ animated: false })
            setTimeout(() => {
              try {
                flatListRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0 })
              } catch {}
            }, 200)
          }}
        />
        {/* LIVE ??????? */}
        <Animated.View
          style={[styles.liveToast, { opacity: toastOpacity }]}
          pointerEvents="none"
        >
          <FontIcon name="wifi" size={12} color="#fff" />
          <Text style={styles.liveToastText}>新着レス +{toastCount}</Text>
        </Animated.View>
        {/* スクロールトップボタン */}
        {displayResponses.length > 0 && (
          <TouchableOpacity
            style={[styles.scrollTopBtn, { backgroundColor: theme.accent }]}
            onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
            activeOpacity={0.8}
          >
            <FontIcon name="angle-double-up" size={18} color="#fff" />
          </TouchableOpacity>
        )}
        {/* rw=1モードの一番下ボタン */}
        {effectiveReadFromStart && showScrollBottom && (
          <TouchableOpacity
            style={[styles.scrollBottomBtn, { backgroundColor: theme.accent }]}
            onPress={() => flatListRef.current?.scrollToEnd({ animated: true })}
            activeOpacity={0.8}
          >
            <FontIcon name="angle-double-down" size={18} color="#fff" />
          </TouchableOpacity>
        )}
        </View>
      )}

      {/* ?????????????? */}
      <Modal visible={showMenu} transparent animationType="none" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity
          style={styles.menuOverlay}
          onPress={() => setShowMenu(false)}
          activeOpacity={1}
        >
          <View style={[styles.menuBox, { backgroundColor: theme.surface, top: insets.top + 52 }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setLiveEnabled((v) => !v); setShowMenu(false) }}
            >
              <FontIcon
                name={liveEnabled ? 'wifi' : 'wifi'}
                size={15}
                color={liveEnabled ? '#22c55e' : theme.subText}
                style={{ width: 22 }}
              />
              <Text style={[styles.menuItemText, { color: liveEnabled ? '#22c55e' : theme.text }]}>
                {liveEnabled ? 'LIVE ライブ更新をオフにする' : 'LIVE ライブ更新をオンにする'}
              </Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { toggleReadMode(); setShowMenu(false) }}
            >
              <FontIcon name={effectiveReadFromStart ? 'arrow-right' : 'arrow-up'} size={15} color={theme.text} style={{ width: 22 }} />
              <Text style={[styles.menuItemText, { color: theme.text }]}>
                {effectiveReadFromStart ? '最新順で読む' : '>>1から読む'}
              </Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { toggleFavThread(); setShowMenu(false) }}
            >
              <FontIcon
                name={isFavThread ? 'star' : 'star-o'}
                size={15}
                color={isFavThread ? '#f97316' : theme.text}
                style={{ width: 22 }}
              />
              <Text style={[styles.menuItemText, { color: theme.text }]}>
                {isFavThread ? 'お気に入りから削除' : 'お気に入りに追加'}
              </Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { clearCacheAndReload(); setShowMenu(false) }}
            >
              <FontIcon name="refresh" size={15} color={theme.text} style={{ width: 22 }} />
              <Text style={[styles.menuItemText, { color: theme.text }]}>キャッシュクリアして再取得</Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { openInBrowser(); setShowMenu(false) }}
            >
              <FontIcon name="external-link" size={15} color={theme.text} style={{ width: 22 }} />
              <Text style={[styles.menuItemText, { color: theme.text }]}>ブラウザで開く</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ?????? */}
      <Modal visible={showPostModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.postModal, { backgroundColor: theme.surface }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>返信する</Text>
              <TouchableOpacity onPress={() => setShowPostModal(false)}>
                <Text style={{ color: theme.subText }}>閉じる</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.nameInput, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
              placeholder="名前（省略可）"
              placeholderTextColor={theme.subText}
              value={postName}
              onChangeText={setPostName}
            />
            <TextInput
              style={[styles.bodyInput, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
              placeholder="本文を入力..."
              placeholderTextColor={theme.subText}
              multiline
              value={postBody}
              onChangeText={setPostBody}
            />
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: postBody.trim() ? theme.accent : theme.surfaceAlt }]}
              onPress={onPost}
              disabled={!postBody.trim() || isPosting}
            >
              {isPosting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>投稿する</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* >>NNN ?????????? */}
      {/* ?? EULA ???? */}
      <Modal visible={showEulaModal} transparent animationType="fade">
        <View style={styles.eulaOverlay}>
          <View style={[styles.eulaBox, { backgroundColor: theme.surface, shadowColor: theme.text }]}>
            <Text style={[styles.eulaTitle, { color: theme.text }]}>書き込み規約</Text>
            <ScrollView style={styles.eulaScroll} showsVerticalScrollIndicator>
              <Text style={[styles.eulaBody, { color: theme.text }]}>
                `爆サイ.com への書き込みに際し、以下の内容に同意の上でご利用ください。\n\n` +
                `【禁止事項】\n` +
                `他者への誤謗中傷・差別的発言・脅迫等の投稿は禁止します。\n` +
                `個人情報（氏名・住所・電話番号等）の投稿は禁止です。\n` +
                `法律に違反する内容の書き込みは禁止します。\n` +
                `営利目的の広告・追尾行為は禁止します。\n` +
                `著作権を侵害するコンテンツの投稿は禁止です。\n` +
                `上記に違反した場合、投稿を削除する場合があります。\n\n` +
                `【免責事項】\n` +
                `投稿内容はユーザー本人の責任において行われます。\n` +
                `爆サイ.com は投稿内容に関して一切の責任を負いません。\n\n` +
                `上記の内容に同意の上、書き込みを行ってください。`}
              </Text>
            </ScrollView>
            <View style={[styles.eulaBtns, { borderTopColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.eulaCancelBtn, { borderRightColor: theme.border }]}
                onPress={() => { setShowEulaModal(false); setPendingReplyTo(null) }}
              >
                <Text style={[styles.eulaCancelText, { color: theme.subText }]}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.eulaAcceptBtn} onPress={onEulaAccept}>
                <Text style={[styles.eulaAcceptText, { color: theme.accent }]}>同意して投稿する</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ????????? */}
      <Modal visible={!!copyItem} transparent animationType="slide">
        <View style={styles.copyOverlay}>
          <View style={[styles.copyBox, { backgroundColor: theme.surface }]}>
            <View style={[styles.copyHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.copyHeaderTitle, { color: theme.text }]}>テキストコピー</Text>
              <Text style={[styles.copyHeaderSub, { color: theme.subText }]}>
                コピーしたいテキストを編集できます。
              </Text>
            </View>
            {copyItem && (
              <View style={[styles.copyMeta, { borderBottomColor: theme.border }]}>
                <Text style={[styles.copyMetaText, { color: theme.accent }]}>#{copyItem.rrid}</Text>
                <Text style={[styles.copyMetaText, { color: theme.subText }]}>
                  {'  '}{copyItem.name}{'  '}{copyItem.date}
                </Text>
              </View>
            )}
            <ScrollView style={styles.copyScroll} showsVerticalScrollIndicator={false}>
              <TextInput
                style={[styles.copyBody, { color: theme.text }]}
                value={copyItem?.body ?? ''}
                multiline
                editable={false}
                selectTextOnFocus={false}
              />
            </ScrollView>
            <View style={[styles.copyBtns, { borderTopColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.copyCancelBtn, { borderRightColor: theme.border }]}
                onPress={() => { setCopyItem(null); setCopiedRrid(null) }}
              >
                <Text style={[styles.copyCancelText, { color: theme.subText }]}>閉じる</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.copyAcceptBtn}
                onPress={() => copyToClipboard(copyItem?.body ?? '', copyItem?.rrid)}
              >
                <FontIcon
                  name={copiedRrid === copyItem?.rrid ? 'check' : 'clipboard'}
                  size={14}
                  color={copiedRrid === copyItem?.rrid ? '#22c55e' : theme.accent}
                />
                <Text style={[styles.copyAcceptText, { color: copiedRrid === copyItem?.rrid ? '#22c55e' : theme.accent }]}>
                  {copiedRrid === copyItem?.rrid ? 'コピーしました' : 'コピーする'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ???????????? */}
      <Modal visible={showTitleModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.anchorOverlay}
          activeOpacity={1}
          onPress={() => setShowTitleModal(false)}
        >
          <View style={[styles.titlePopup, { backgroundColor: theme.surface, shadowColor: theme.text }]}>
            <Text style={[styles.titlePopupText, { color: theme.text }]} selectable>
              {pageTitle}
            </Text>
            <TouchableOpacity
              style={[styles.titlePopupClose, { borderTopColor: theme.border }]}
              onPress={() => setShowTitleModal(false)}
            >
              <Text style={{ color: theme.accent, fontSize: 14 }}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 返信一覧ポップアップ */}
      <Modal visible={showReplyList} transparent animationType="slide">
        <View style={styles.replyListOverlay}>
          <View style={[styles.replyListBox, { backgroundColor: theme.surface }]}>
            {/* ヘッダー */}
            <View style={[styles.replyListHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.replyListTitle, { color: theme.text }]}>
                {`>>${replyListTarget} へのレス`}
                {(() => {
                  const count = responses.filter((r) => r.body.includes(`>>${replyListTarget}`)).length
                  return count > 0 ? <Text style={{ color: theme.subText }}>（{count}件）</Text> : null
                })()}
              </Text>
              <TouchableOpacity onPress={() => setReplyListTarget(null)} hitSlop={8}>
                <FontIcon name="times" size={16} color={theme.subText} />
              </TouchableOpacity>
            </View>
            {/* 返信リスト */}
            {(() => {
              const replies = responses.filter((r) => r.body.includes(`>>${replyListTarget}`))
              if (replies.length === 0) {
                return (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: theme.subText, fontSize: 13 }}>返信はありません</Text>
                  </View>
                )
              }
              return (
                <ScrollView style={styles.replyListScroll} showsVerticalScrollIndicator={false}>
                  {replies.map((r) => (
                    <View key={r.rrid} style={[styles.replyListItem, { borderBottomColor: theme.border }]}>
                      <View style={styles.replyListItemHeader}>
                        <Text
                          style={[styles.replyListRrid, { color: theme.accent }]}
                          onPress={() => { setReplyListTarget(null); onAnchorPress(r.rrid) }}
                          suppressHighlighting
                        >
                          #{r.rrid}
                        </Text>
                        <Text style={[styles.replyListName, { color: theme.subText }]}>{r.name}</Text>
                        <Text style={[styles.replyListDate, { color: theme.subText }]}>{r.date}</Text>
                      </View>
                      {renderBodyWithAnchors(r.body)}
                    </View>
                  ))}
                </ScrollView>
              )
            })()}
          </View>
        </View>
      </Modal>

      <Modal visible={showAnchorPopup} transparent animationType="fade">
        <TouchableOpacity
          style={styles.anchorOverlay}
          activeOpacity={1}
          onPress={() => setAnchorStack([])}
        >
          <View
            style={[styles.anchorPopup, { backgroundColor: theme.surface, shadowColor: theme.text }]}
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {/* スタックナビゲーション */}
            <View style={[styles.anchorNavBar, { borderBottomColor: theme.border }]}>
              {anchorStack.length > 1 ? (
                <TouchableOpacity
                  onPress={() => setAnchorStack((prev) => prev.slice(0, -1))}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.anchorBackBtn}
                >
                  <FontIcon name="chevron-left" size={13} color={theme.accent} />
                  <Text style={[styles.anchorBackText, { color: theme.accent }]}>戻る</Text>
                </TouchableOpacity>
              ) : <View style={styles.anchorBackBtn} />}
              <TouchableOpacity
                onPress={() => setAnchorStack([])}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <FontIcon name="times" size={14} color={theme.subText} />
              </TouchableOpacity>
            </View>

            {anchorLoadingRrid === currentAnchor?.rrid && currentAnchor?.response === null ? (
              <ActivityIndicator size="small" color={theme.accent} style={{ padding: 16 }} />
            ) : currentAnchor?.response ? (
              <>
                <View style={[styles.anchorHeader, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.anchorRrid, { color: theme.accent }]}>
                    #{currentAnchor.response.rrid}
                  </Text>
                  <Text style={[styles.anchorName, { color: theme.subText }]}>{currentAnchor.response.name}</Text>
                  <Text style={[styles.anchorDate, { color: theme.subText }]}>{currentAnchor.response.date}</Text>
                </View>
                <ScrollView
                  style={styles.anchorBodyScroll}
                  showsVerticalScrollIndicator
                  onStartShouldSetResponder={() => true}
                >
                  {renderBodyWithAnchors(currentAnchor.response.body)}
                </ScrollView>
              </>
            ) : (
              <Text style={{ color: theme.subText, fontSize: 13, padding: 12 }}>
                {`>>${currentAnchor?.rrid} は見つかりません`}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  backBtn: { minWidth: 60 },
  backText: { fontSize: 16 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '600' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerIconBtn: { padding: 4 },
  menuOverlay: { flex: 1 },
  menuBox: {
    position: 'absolute',
    right: 12,
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 190,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  menuItemText: { fontSize: 14 },
  menuDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 12 },
  headerTitleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveBadge: {
    backgroundColor: '#22c55e',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  liveBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  listWrapper: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
  },
  searchCount: { fontSize: 12, marginHorizontal: 8 },
  searchNav: { padding: 6 },
  scrollBottomBtn: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  scrollTopBtn: {
    position: 'absolute',
    bottom: 72,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  liveToast: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#166534',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  liveToastText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 14, marginBottom: 12, textAlign: 'center' },
  retryBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 8 },
  responseItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  myPostItem: {
    borderLeftWidth: 3,
    borderLeftColor: '#f97316',
    paddingLeft: 9,
  },
  replyToMeItem: {
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
    paddingLeft: 9,
  },
  myPostBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: '#f97316',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginRight: 6,
    overflow: 'hidden',
  },
  replyToMeBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginRight: 6,
    overflow: 'hidden',
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  rrid: { fontSize: 12, fontWeight: '700', marginRight: 4 },
  replyCountBtn: { marginRight: 8 },
  replyCountText: { fontSize: 11, fontWeight: '600' },
  name: { fontSize: 12, marginRight: 8 },
  date: { fontSize: 11, marginLeft: 'auto' },
  body: { fontSize: 14, lineHeight: 18 },
  responseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  goodBadRow: { flexDirection: 'row', flex: 1 },
  goodBadText: { fontSize: 12 },
  replyBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  responseActions: { flexDirection: 'row', gap: 2 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  postModal: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  sheetContent: { paddingBottom: 8 },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 15, fontWeight: '700' },
  sheetSubTitle: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  copyOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  copyBox: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 10,
  },
  copyHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  copyHeaderTitle: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  copyHeaderSub: { fontSize: 11, lineHeight: 15 },
  copyMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  copyMetaText: { fontSize: 12 },
  copyScroll: { minHeight: 180, paddingHorizontal: 16, paddingVertical: 8 },
  copyBody: {
    fontSize: 14,
    lineHeight: 22,
    paddingVertical: 4,
  },
  copyBtns: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 24,
  },
  copyCancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  copyCancelText: { fontSize: 15 },
  copyAcceptBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 7,
  },
  copyAcceptText: { fontSize: 15, fontWeight: '600' },
  resumeSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  resumeLine: { flex: 1, height: 1, opacity: 0.5 },
  resumeLabel: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8 },
  loadPageBtn: {
    padding: 14,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  autoLoadIndicator: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  pullUpHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 16,
    paddingBottom: 24,
  },
  pullUpHintText: { fontSize: 12 },
  nameInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 8,
    marginHorizontal: 16,
    marginTop: 12,
  },
  bodyInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    height: 120,
    textAlignVertical: 'top',
    marginBottom: 12,
    marginHorizontal: 16,
  },
  submitBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  replyListOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  replyListBox: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  replyListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  replyListTitle: { fontSize: 14, fontWeight: '700' },
  replyListScroll: { paddingHorizontal: 12 },
  replyListItem: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  replyListItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  replyListRrid: { fontSize: 12, fontWeight: '700', marginRight: 8 },
  replyListName: { fontSize: 12, marginRight: 8 },
  replyListDate: { fontSize: 11, marginLeft: 'auto' },
  anchorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  anchorPopup: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  anchorNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  anchorBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 50,
  },
  anchorBackText: { fontSize: 13 },
  anchorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  anchorRrid: { fontSize: 13, fontWeight: '700', marginRight: 8 },
  anchorName: { fontSize: 12, marginRight: 8 },
  anchorDate: { fontSize: 11, marginLeft: 'auto' },
  anchorBodyScroll: { maxHeight: 260, paddingHorizontal: 14, paddingVertical: 10 },
  anchorBody: { fontSize: 13, lineHeight: 18 },
  eulaOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  eulaBox: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  eulaTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  eulaScroll: { maxHeight: 340, paddingHorizontal: 16 },
  eulaBody: { fontSize: 13, lineHeight: 20, paddingBottom: 16 },
  eulaBtns: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  eulaCancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  eulaCancelText: { fontSize: 15 },
  eulaAcceptBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  eulaAcceptText: { fontSize: 15, fontWeight: '600' },
  titlePopup: {
    borderRadius: 12,
    padding: 18,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  titlePopupText: { fontSize: 15, lineHeight: 22 },
  titlePopupClose: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
})
