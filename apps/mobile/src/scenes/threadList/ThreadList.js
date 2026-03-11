import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Linking,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import FontIcon from 'react-native-vector-icons/FontAwesome'
import { getThreadList } from 'lib/bakusai'
import { useSettings } from 'contexts/SettingsContext'
import { useTheme } from 'contexts/ThemeContext'
import ContextMenu from 'components/ContextMenu'

export default function ThreadList() {
  const navigation = useNavigation()
  const route = useRoute()
  const { acode, ctgid, bid, boardName } = route.params
  const { readSet, ngWords, addFavorite, removeFavorite, favorites, seenCounts, markSeen, favoriteThreads, addFavoriteThread, removeFavoriteThread } = useSettings()
  const { theme, isDark } = useTheme()
  const insets = useSafeAreaInsets()

  const [threads, setThreads] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const isFavorited = favorites.some((f) => f.bid === bid && f.acode === acode)
  const boardUrl = `https://bakusai.com/thr_tl/acode=${acode}/ctgid=${ctgid}/bid=${bid}/`
  const openInBrowser = () => Linking.openURL(boardUrl)

  const [menuItem, setMenuItem] = useState(null)

  const onLongPress = (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setMenuItem(item)
  }

  useEffect(() => {
    loadThreads(1, true)
  }, [])

  const loadThreads = async (p = 1, reset = false) => {
    if (reset) {
      setIsLoading(true)
      setError(null)
    }
    try {
      const { threads: newThreads, nextPage } = await getThreadList(
        acode,
        ctgid,
        bid,
        p === 1 ? null : p,
      )
      if (reset) {
        setThreads(newThreads)
        setPage(1)
      } else {
        setThreads((prev) => {
          const existingTids = new Set(prev.map((t) => t.tid))
          return [...prev, ...newThreads.filter((t) => !existingTids.has(t.tid))]
        })
        setPage(p)
      }
      setHasMore(nextPage !== null)
    } catch (e) {
      setError(e.message || 'エラーが発生しました')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
      setIsLoadingMore(false)
    }
  }

  const onRefresh = () => {
    setIsRefreshing(true)
    loadThreads(1, true)
  }

  const onEndReached = () => {
    if (!isLoadingMore && hasMore && !isLoading) {
      setIsLoadingMore(true)
      loadThreads(page + 1, false)
    }
  }

  const onThreadPress = (thread) => {
    Haptics.selectionAsync()
    markSeen(thread.tid, thread.resCount)
    const m = thread.href.match(/acode=(\d+)\/ctgid=(\d+)\/bid=(\d+)\/tid=(\d+)\//)
    navigation.navigate('ThreadDetail', {
      acode: m ? parseInt(m[1], 10) : acode,
      ctgid: m ? parseInt(m[2], 10) : ctgid,
      bid: m ? parseInt(m[3], 10) : bid,
      tid: thread.tid,
      title: thread.title,
    })
  }

  const toggleFavorite = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (isFavorited) {
      removeFavorite(bid, acode)
    } else {
      addFavorite({ acode, ctgid, bid, name: boardName })
    }
  }

  const filteredThreads = threads.filter(
    (t) => !ngWords.some((w) => t.title.includes(w)),
  )

  const renderThread = ({ item }) => {
    const isRead = readSet[item.tid] !== undefined
    const storedCount = seenCounts[item.tid]
    const newCount = storedCount !== undefined ? item.resCount - storedCount : 0
    const hasNew = isRead && newCount > 0
    return (
      <TouchableOpacity
        style={[
          styles.threadItem,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
        onPress={() => onThreadPress(item)}
        onLongPress={() => onLongPress(item)}
        delayLongPress={400}
        activeOpacity={0.7}
      >
        <View style={styles.titleRow}>
          <Text
            style={[styles.threadTitle, { color: isRead ? theme.subText : theme.text }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {hasNew && (
            <View style={[styles.newBadge, { backgroundColor: theme.accent }]}>
              <Text style={styles.newBadgeText}>+{newCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.threadMeta}>
          <Text style={[styles.metaText, { color: theme.subText }]}>{item.updatedAt}</Text>
          <View style={styles.metaRight}>
            <Text style={[styles.metaText, { color: theme.accent }]}>
              💬 {item.resCount}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
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
        <Text
          style={[styles.headerTitle, { color: theme.headerText }]}
          numberOfLines={1}
        >
          {boardName}
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={openInBrowser} style={styles.headerIconBtn}>
            <FontIcon name="external-link" size={16} color={theme.headerText} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleFavorite} style={styles.headerIconBtn}>
            <FontIcon name={isFavorited ? 'star' : 'star-o'} size={20} color={isFavorited ? '#f97316' : theme.headerText} />
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
            onPress={() => loadThreads(1, true)}
            style={[styles.retryBtn, { borderColor: theme.accent }]}
          >
            <Text style={{ color: theme.accent }}>再試行</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredThreads}
          keyExtractor={(item) => item.tid}
          renderItem={renderThread}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={theme.accent}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: theme.subText }}>スレッドがありません</Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator color={theme.accent} style={{ padding: 16 }} />
            ) : null
          }
        />
      )}

      <ContextMenu
        visible={!!menuItem}
        onClose={() => setMenuItem(null)}
        title={menuItem?.title}
        items={menuItem ? [
          favoriteThreads.some((t) => String(t.tid) === String(menuItem.tid))
            ? {
                label: 'スレお気に入りから削除',
                onPress: () => removeFavoriteThread(menuItem.tid),
                destructive: true,
              }
            : {
                label: 'スレをお気に入りに追加',
                onPress: () => addFavoriteThread({ tid: menuItem.tid, title: menuItem.title, acode, ctgid, bid }),
              },
          {
            label: 'ブラウザで開く',
            onPress: () => Linking.openURL(
              `https://bakusai.com/thr_res/acode=${acode}/ctgid=${ctgid}/bid=${bid}/tid=${menuItem.tid}/tp=1/`
            ),
          },
        ] : []}
      />
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 60, justifyContent: 'flex-end' },
  headerIconBtn: { padding: 2 },
  favBtn: { minWidth: 40, alignItems: 'flex-end' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 14, marginBottom: 12, textAlign: 'center' },
  retryBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 8 },
  threadItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  threadTitle: { flex: 1, fontSize: 14, lineHeight: 20 },
  newBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    alignSelf: 'flex-start',
  },
  newBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  threadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaRight: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 11 },
})
