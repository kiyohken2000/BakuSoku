const INITIAL_TARGET = 49 // 7件/ページ × 7ページ ≈ 49件 (rw=1モード)

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
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  RefreshControl,
  Linking,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import FontIcon from 'react-native-vector-icons/FontAwesome'
import { getThread, getThreadFromStart, getResShow, getRatingList, postResponse } from 'lib/bakusai'
import { createMqttClient } from 'lib/mqttClient'
import { useSettings } from 'contexts/SettingsContext'
import { useTheme } from 'contexts/ThemeContext'

export default function ThreadDetail() {
  const navigation = useNavigation()
  const route = useRoute()
  const { acode, ctgid, bid, tid, title } = route.params
  const { ngWords, addHistory, markRead, readSet, readFromStart, setReadFromStart, favoriteThreads, addFavoriteThread, removeFavoriteThread, postEulaAccepted, acceptPostEula, readPositions, saveReadPosition } = useSettings()
  const { theme, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const flatListRef = useRef(null)

  const [responses, setResponses] = useState([])
  const [pageTitle, setPageTitle] = useState(title || '')
  const [formFields, setFormFields] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ratings, setRatings] = useState({})

  // 最新から: 前(古い方=ページ番号大)のページを読む
  const [hasOlderPages, setHasOlderPages] = useState(false)
  const [olderPage, setOlderPage] = useState(2)
  const [loadingOlder, setLoadingOlder] = useState(false)

  // 最初から (rw=1): 次(新しい方=ページ番号大)のページを読む
  // bakusai モバイル rw=1: p=1=最古(7件), p=2=次...インクリメント方向
  const [hasNewerPages, setHasNewerPages] = useState(false)
  const [newerPage, setNewerPage] = useState(2)
  const [loadingNewer, setLoadingNewer] = useState(false)

  const [isRefreshing, setIsRefreshing] = useState(false)

  const [showPostModal, setShowPostModal] = useState(false)
  const [postBody, setPostBody] = useState('')
  const [postName, setPostName] = useState('')
  const [isPosting, setIsPosting] = useState(false)

  const [anchorRrid, setAnchorRrid] = useState(null)
  const [showAnchorPopup, setShowAnchorPopup] = useState(false)
  const [anchorResponse, setAnchorResponse] = useState(null) // getResShow で取得したレス
  const [anchorLoading, setAnchorLoading] = useState(false)

  const [showTitleModal, setShowTitleModal] = useState(false)
  const [showEulaModal, setShowEulaModal] = useState(false)
  const [pendingReplyTo, setPendingReplyTo] = useState(null)

  // MQTT リアルタイム更新
  const [mqttConnected, setMqttConnected] = useState(false)
  const readFromStartRef = useRef(readFromStart)  // stale closure 対策
  useEffect(() => { readFromStartRef.current = readFromStart }, [readFromStart])

  // 前回既読位置への自動スクロール（初回ロード時のみ使用）
  const resumeRridRef = useRef(readSet[String(tid)] ?? null)

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

  useEffect(() => {
    // rw=1 モードで保存済みページがあればそこから再開
    const resumePage = readFromStart ? (readPositions?.[String(tid)] ?? null) : null
    loadThread(resumePage, readFromStart)
  }, [])

  // MQTT: スレ表示中だけ接続し、アンマウント時に切断
  useEffect(() => {
    const client = createMqttClient(
      `thread/${tid}`,
      (msg) => {
        // 新着レスをリストに追加（重複チェックあり）
        setResponses((prev) => {
          if (prev.some((r) => r.rrid === msg.rrid)) return prev
          const newRes = {
            rrid: msg.rrid,
            body: msg.body || '',
            name: msg.name || '匿名さん',
            date: msg.date || '',
          }
          // rw=1（昇順）→ 末尾に追加、→最新（降順）→ 先頭に追加
          return readFromStartRef.current
            ? [...prev, newRes]
            : [newRes, ...prev]
        })
      },
      () => setMqttConnected(true),
      () => setMqttConnected(false),
    )
    return () => client.disconnect()
  }, [tid])

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await loadThread(null, readFromStart)
  }, [readFromStart])

  // 常に最新の loadNewerResponses を参照するための ref（stale closure 対策）
  const loadNewerResponsesRef = useRef(null)
  const consecutiveEmptyRef = useRef(0)  // 空ページが連続した回数

  // readFromStart モード: 下端でのオーバースクロール → 最新チェック
  const onScrollEndDrag = useCallback((e) => {
    if (!readFromStart) return
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y
    if (distanceFromBottom < -24) {
      loadNewerResponsesRef.current?.()
    }
  }, [readFromStart])

  const loadThread = async (initialPage, rfs) => {
    setError(null)
    if (!isRefreshing) setIsLoading(true)

    let allResps = []
    let page = initialPage ?? null
    let lastLoadedPage = initialPage ?? 1  // 最後に読み込んだページ番号を追跡
    let firstFetch = true

    try {
      while (true) {
        const data = rfs
          ? await getThreadFromStart(acode, ctgid, bid, tid, page)
          : await getThread(acode, ctgid, bid, tid, page)

        lastLoadedPage = page ?? 1  // null = ページ1

        // 1ページ目: タイトル・フォームをセット、ローディング解除
        if (firstFetch) {
          setPageTitle(data.pageTitle || title)
          setFormFields(data.formFields)
          addHistory({ tid, title: data.pageTitle || title, acode, ctgid, bid, at: Date.now() })
          setIsLoading(false)
          setIsRefreshing(false)
          firstFetch = false
        }

        // 重複除去してレスを追加
        // rfs=false (最新から): 各ページを降順にして末尾に追加
        const existRrids = new Set(allResps.map((r) => r.rrid))
        const fresh = data.responses.filter((r) => !existRrids.has(r.rrid))
        allResps = rfs ? [...allResps, ...fresh] : [...allResps, ...[...fresh].reverse()]
        setResponses([...allResps])

        const nextPage = rfs ? data.nextRw1Page : data.nextNormalPage

        // 十分な件数 or 次ページなし → ページネーション state を確定して終了
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
        // rfs=false は降順配列なので先頭が最新レス
        const latestRrid = rfs
          ? allResps[allResps.length - 1].rrid
          : allResps[0].rrid
        markRead(tid, latestRrid)
        // rw=1 モードのページ位置を保存（次回再開用）
        if (rfs) saveReadPosition(tid, lastLoadedPage)
        loadRatings(tid, allResps.map((r) => r.rrid))
      }
    } catch (e) {
      if (firstFetch) {
        setIsLoading(false)
        setIsRefreshing(false)
      }
      setError(e.message || 'エラーが発生しました')
    }
  }

  const toggleReadMode = () => {
    const next = !readFromStart
    setReadFromStart(next)
    setResponses([])
    // モード切替時は保存ページを使わず先頭から
    loadThread(null, next)
  }

  // 最新から(降順): 古いページを末尾に追加
  const loadOlderResponses = async () => {
    if (loadingOlder) return
    setLoadingOlder(true)
    try {
      const data = await getThread(acode, ctgid, bid, tid, olderPage)
      if (data.responses.length > 0) {
        setResponses((prev) => {
          const existingRrids = new Set(prev.map((r) => r.rrid))
          // 古いページも降順にして末尾に追加
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

  // 最初から (rw=1): 次のページ(新しい側=ページ番号大) を読む
  // ※ 関数定義後に ref を更新することで onScrollEndDrag の stale closure を解消
  const loadNewerResponses = async () => {
    if (loadingNewer) return
    setLoadingNewer(true)
    try {
      const data = await getThreadFromStart(acode, ctgid, bid, tid, newerPage)
      if (data.responses.length > 0) {
        consecutiveEmptyRef.current = 0  // レスあり → カウンターリセット
        setResponses((prev) => {
          const existingRrids = new Set(prev.map((r) => r.rrid))
          const newResps = data.responses.filter((r) => !existingRrids.has(r.rrid))
          return [...prev, ...newResps]
        })
        setHasNewerPages(data.nextRw1Page !== null)
        setNewerPage(data.nextRw1Page ?? newerPage + 1)
        saveReadPosition(tid, newerPage)
        loadRatings(tid, data.responses.map((r) => r.rrid))
      } else if (data.nextRw1Page !== null) {
        // 0件だが次ページリンクあり（全削除ページなど）→ スキップ
        consecutiveEmptyRef.current = 0
        setHasNewerPages(true)
        setNewerPage(data.nextRw1Page)
      } else {
        // 0件かつ次ページリンクなし
        consecutiveEmptyRef.current += 1
        if (consecutiveEmptyRef.current <= 3) {
          // パース失敗や削除ページの可能性 → 最大3ページは強制スキップして続行
          setHasNewerPages(true)
          setNewerPage(newerPage + 1)
        } else {
          // 3ページ連続で空 → 本当の終端と判断して停止
          consecutiveEmptyRef.current = 0
          setHasNewerPages(false)
        }
      }
    } catch {}
    setLoadingNewer(false)
  }
  // 毎レンダーで最新版を ref に保持
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
    setAnchorRrid(refRrid)
    setAnchorResponse(null)
    setShowAnchorPopup(true)

    // 読み込み済みレスにあればそれを使う、なければ /thr_res_show/ でフェッチ
    const cached = responses.find((r) => r.rrid === refRrid)
    if (cached) {
      setAnchorResponse(cached)
      return
    }

    setAnchorLoading(true)
    try {
      const res = await getResShow(acode, ctgid, bid, tid, refRrid)
      setAnchorResponse(res || null)
    } catch {
      setAnchorResponse(null)
    } finally {
      setAnchorLoading(false)
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

  const onPost = async () => {
    if (!postBody.trim() || !formFields) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsPosting(true)
    try {
      const result = await postResponse(
        formFields._action,
        formFields,
        postBody.trim(),
        postName.trim(),
      )
      if (result?.status === 'success') {
        setPostBody('')
        setPostName('')
        setShowPostModal(false)
        await loadThread(null)
      } else if (result?.status === 'cushion') {
        Alert.alert('確認', '投稿してよろしいですか？', [
          { text: 'キャンセル', style: 'cancel' },
          { text: '投稿', onPress: onPost },
        ])
      } else {
        Alert.alert('エラー', '投稿に失敗しました')
      }
    } catch (e) {
      Alert.alert('エラー', e.message || '投稿に失敗しました')
    } finally {
      setIsPosting(false)
    }
  }

  const filteredResponses = responses.filter(
    (r) => !ngWords.some((w) => r.body.includes(w) || r.name.includes(w)),
  )

  // 初回ロード後、前回既読位置にスクロール（セパレーター注入後の displayResponses を使う）
  useEffect(() => {
    if (!resumeRridRef.current || displayResponses.length === 0) return
    const idx = displayResponses.findIndex((r) => r.rrid === resumeRridRef.current)
    if (idx < 0) return
    resumeRridRef.current = null // 一度だけ実行
    const timer = setTimeout(() => {
      try {
        flatListRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0 })
      } catch {}
    }, 350)
    return () => clearTimeout(timer)
  }, [displayResponses])

  const savedRrid = readSet[String(tid)]

  // セパレーターをデータ配列に直接注入（renderItem の外側 View を不要にする）
  const displayResponses = useMemo(() => {
    if (!savedRrid || filteredResponses.length === 0) return filteredResponses
    const idx = filteredResponses.findIndex((r) => r.rrid === savedRrid)
    if (idx < 0) return filteredResponses
    return [
      ...filteredResponses.slice(0, idx + 1),
      { rrid: '__resume_separator__', isSeparator: true },
      ...filteredResponses.slice(idx + 1),
    ]
  }, [filteredResponses, savedRrid])

  const renderResponse = ({ item }) => {
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
    return (
      <View
        style={[
          styles.responseItem,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        <View style={styles.responseHeader}>
          <Text style={[styles.rrid, { color: theme.accent }]}>#{item.rrid}</Text>
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
          <TouchableOpacity
            style={styles.replyBtn}
            onPress={() => openReplyTo(item.rrid)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <FontIcon name="reply" size={13} color={theme.subText} />
          </TouchableOpacity>
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
            style={[styles.modeBtn, { borderColor: theme.headerText + '66' }]}
            onPress={toggleReadMode}
          >
            <Text style={[styles.modeBtnText, { color: theme.headerText }]}>
              {readFromStart ? '1→' : '→最新'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={toggleFavThread}>
            <FontIcon
              name={isFavThread ? 'star' : 'star-o'}
              size={18}
              color={isFavThread ? '#f97316' : theme.headerText}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={openInBrowser}>
            <FontIcon name="external-link" size={16} color={theme.headerText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.postBtn}
            onPress={() => openPostModalWithEulaCheck()}
          >
            <FontIcon name="pencil" size={18} color={theme.headerText} />
          </TouchableOpacity>
        </View>
      </View>

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
            <Text style={{ color: theme.accent }}>再試行</Text>
          </TouchableOpacity>
        </View>
      ) : (
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
            readFromStart ? (
              // 最初から(昇順): 末尾に「引っ張って更新」or ローダー
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
              // 最新から(降順): 末尾に自動ロード中スピナー
              loadingOlder ? (
                <View style={styles.autoLoadIndicator}>
                  <ActivityIndicator size="small" color={theme.accent} />
                </View>
              ) : null
            )
          }
          onEndReached={() => {
            if (readFromStart && hasNewerPages && !loadingNewer) {
              loadNewerResponsesRef.current?.()
            }
            if (!readFromStart && hasOlderPages && !loadingOlder) {
              loadOlderResponses()
            }
          }}
          onEndReachedThreshold={0.3}
          onScrollEndDrag={onScrollEndDrag}
          onScrollToIndexFailed={({ index }) => {
            // アイテムがまだレイアウトされていない場合は末尾にスクロールしてリトライ
            flatListRef.current?.scrollToEnd({ animated: false })
            setTimeout(() => {
              try {
                flatListRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0 })
              } catch {}
            }, 200)
          }}
        />
      )}

      <Modal visible={showPostModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.postModal, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>返信する</Text>
              <TouchableOpacity onPress={() => setShowPostModal(false)}>
                <Text style={{ color: theme.subText }}>閉じる</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[
                styles.nameInput,
                {
                  color: theme.text,
                  backgroundColor: theme.inputBg,
                  borderColor: theme.inputBorder,
                },
              ]}
              placeholder="名前（省略可）"
              placeholderTextColor={theme.subText}
              value={postName}
              onChangeText={setPostName}
            />
            <TextInput
              style={[
                styles.bodyInput,
                {
                  color: theme.text,
                  backgroundColor: theme.inputBg,
                  borderColor: theme.inputBorder,
                },
              ]}
              placeholder="本文を入力..."
              placeholderTextColor={theme.subText}
              multiline
              value={postBody}
              onChangeText={setPostBody}
            />
            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: postBody.trim() ? theme.accent : theme.surfaceAlt },
              ]}
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
      {/* >>NNN アンカーポップアップ */}
      {/* 投稿 EULA モーダル */}
      <Modal visible={showEulaModal} transparent animationType="fade">
        <View style={styles.eulaOverlay}>
          <View style={[styles.eulaBox, { backgroundColor: theme.surface, shadowColor: theme.text }]}>
            <Text style={[styles.eulaTitle, { color: theme.text }]}>投稿前に確認</Text>
            <ScrollView style={styles.eulaScroll} showsVerticalScrollIndicator>
              <Text style={[styles.eulaBody, { color: theme.text }]}>
                {`爆サイ.com への投稿にあたり、以下の利用規約に同意する必要があります。\n\n` +
                `【禁止事項】\n` +
                `・個人情報（氏名・住所・電話番号・顔写真など）の無断掲載\n` +
                `・誹謗中傷・名誉毀損・プライバシーの侵害\n` +
                `・わいせつ・差別的・暴力的な表現\n` +
                `・未成年者に有害なコンテンツ\n` +
                `・スパム・広告・フィッシング目的の投稿\n` +
                `・著作権・商標権を侵害するコンテンツ\n` +
                `・法令に違反するあらゆる行為\n\n` +
                `【免責事項】\n` +
                `投稿した内容に関するすべての責任は投稿者本人が負います。\n` +
                `違法な投稿は削除されるとともに、捜査機関への情報提供が行われる場合があります。\n\n` +
                `上記の内容を確認し、利用規約に同意した場合のみ「同意して投稿する」を押してください。`}
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

      {/* スレタイ全文モーダル */}
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

      <Modal visible={showAnchorPopup} transparent animationType="fade">
        <TouchableOpacity
          style={styles.anchorOverlay}
          activeOpacity={1}
          onPress={() => setShowAnchorPopup(false)}
        >
          <View style={[styles.anchorPopup, { backgroundColor: theme.surface, shadowColor: theme.text }]}>
            {anchorLoading ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : anchorResponse ? (
              <>
                <View style={[styles.anchorHeader, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.anchorRrid, { color: theme.accent }]}>
                    #{anchorResponse.rrid}
                  </Text>
                  <Text style={[styles.anchorName, { color: theme.subText }]}>{anchorResponse.name}</Text>
                  <Text style={[styles.anchorDate, { color: theme.subText }]}>{anchorResponse.date}</Text>
                </View>
                <ScrollView
                  style={styles.anchorBodyScroll}
                  showsVerticalScrollIndicator
                  onStartShouldSetResponder={() => true}
                >
                  <Text style={[styles.anchorBody, { color: theme.text }]} selectable>
                    {anchorResponse.body}
                  </Text>
                </ScrollView>
              </>
            ) : (
              <Text style={{ color: theme.subText, fontSize: 13 }}>
                {`>>${anchorRrid} が見つかりません`}
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modeBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  modeBtnText: { fontSize: 12, fontWeight: '600' },
  headerIconBtn: { padding: 2 },
  headerTitleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveBadge: {
    backgroundColor: '#22c55e',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  liveBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  postBtn: { alignItems: 'flex-end' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 14, marginBottom: 12, textAlign: 'center' },
  retryBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 8 },
  responseItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  rrid: { fontSize: 12, fontWeight: '700', marginRight: 8 },
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
  replyBtn: { paddingLeft: 8 },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  postModal: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 16, fontWeight: '600' },
  nameInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 8,
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
  },
  submitBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  anchorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  anchorPopup: {
    borderRadius: 12,
    padding: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  anchorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  anchorRrid: { fontSize: 13, fontWeight: '700', marginRight: 8 },
  anchorName: { fontSize: 12, marginRight: 8 },
  anchorDate: { fontSize: 11, marginLeft: 'auto' },
  anchorBodyScroll: { maxHeight: 260 },
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
