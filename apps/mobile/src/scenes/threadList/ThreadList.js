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
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import { getThreadList } from 'lib/bakusai'
import { useSettings } from 'contexts/SettingsContext'
import { useTheme } from 'contexts/ThemeContext'

export default function ThreadList() {
  const navigation = useNavigation()
  const route = useRoute()
  const { acode, ctgid, bid, boardName } = route.params
  const { readSet, ngWords, addFavorite, removeFavorite, favorites } = useSettings()
  const { theme, isDark } = useTheme()

  const [threads, setThreads] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const isFavorited = favorites.some((f) => f.bid === bid && f.acode === acode)

  useEffect(() => {
    loadThreads(1, true)
  }, [])

  const loadThreads = async (p = 1, reset = false) => {
    if (reset) {
      setIsLoading(true)
      setError(null)
    }
    try {
      const results = await getThreadList(acode, ctgid, bid, p === 1 ? null : p)
      if (reset) {
        setThreads(results)
        setPage(1)
      } else {
        setThreads((prev) => {
          const existingTids = new Set(prev.map((t) => t.tid))
          return [...prev, ...results.filter((t) => !existingTids.has(t.tid))]
        })
        setPage(p)
      }
      setHasMore(results.length > 0)
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
    return (
      <TouchableOpacity
        style={[
          styles.threadItem,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
        onPress={() => onThreadPress(item)}
        activeOpacity={0.7}
      >
        <Text
          style={[styles.threadTitle, { color: isRead ? theme.subText : theme.text }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <View style={styles.threadMeta}>
          <Text style={[styles.metaText, { color: theme.subText }]}>{item.updatedAt}</Text>
          <View style={styles.metaRight}>
            <Text style={[styles.metaText, { color: theme.subText }]}>
              👁 {item.views.toLocaleString()}
            </Text>
            <Text style={[styles.metaText, { color: theme.accent, marginLeft: 10 }]}>
              💬 {item.resCount}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={theme.header}
      />

      <View style={[styles.header, { backgroundColor: theme.header }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: theme.headerText }]}>‹ 戻る</Text>
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: theme.headerText }]}
          numberOfLines={1}
        >
          {boardName}
        </Text>
        <TouchableOpacity onPress={toggleFavorite} style={styles.favBtn}>
          <Text style={{ fontSize: 20 }}>{isFavorited ? '★' : '☆'}</Text>
        </TouchableOpacity>
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backBtn: { minWidth: 60 },
  backText: { fontSize: 16 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600' },
  favBtn: { minWidth: 40, alignItems: 'flex-end' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 14, marginBottom: 12, textAlign: 'center' },
  retryBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 8 },
  threadItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  threadTitle: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  threadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaRight: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 11 },
})
