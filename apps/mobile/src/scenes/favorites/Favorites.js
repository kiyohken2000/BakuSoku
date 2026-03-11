import React, { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import FontIcon from 'react-native-vector-icons/FontAwesome'
import { useSettings } from 'contexts/SettingsContext'
import { useTheme } from 'contexts/ThemeContext'
import { AREA_NAMES, checkThreadLatestRrid } from 'lib/bakusai'

export default function Favorites() {
  const navigation = useNavigation()
  const {
    favorites, removeFavorite,
    favoriteThreads, removeFavoriteThread,
    readSet,
  } = useSettings()
  const { theme, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState('boards') // 'boards' | 'threads'

  const [newCounts, setNewCounts] = useState({})
  const [checking, setChecking] = useState(false)
  const [checkProgress, setCheckProgress] = useState({ done: 0, total: 0 })

  // --- 掲示板 ---
  const onPressBoard = (fav) => {
    navigation.navigate('ThreadListFromFavorites', {
      acode: fav.acode,
      ctgid: fav.ctgid,
      bid: fav.bid,
      boardName: fav.name,
    })
  }

  const onRemoveBoard = (fav) => {
    Alert.alert(
      'お気に入りから削除',
      `「${fav.name}」を削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: () => removeFavorite(fav.bid, fav.acode) },
      ],
    )
  }

  const openBoardInBrowser = (fav) => {
    const url = `https://bakusai.com/thr_tl/acode=${fav.acode}/ctgid=${fav.ctgid}/bid=${fav.bid}/`
    Linking.openURL(url)
  }

  // --- スレ ---
  const onPressThread = (t) => {
    navigation.navigate('ThreadDetailFromFavorites', {
      acode: t.acode,
      ctgid: t.ctgid,
      bid: t.bid,
      tid: t.tid,
      title: t.title,
    })
  }

  const onRemoveThread = (t) => {
    Alert.alert(
      'お気に入りから削除',
      `「${t.title}」を削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: () => removeFavoriteThread(t.tid) },
      ],
    )
  }

  const openThreadInBrowser = (t) => {
    const url = `https://bakusai.com/thr_res/acode=${t.acode}/ctgid=${t.ctgid}/bid=${t.bid}/tid=${t.tid}/tp=1/`
    Linking.openURL(url)
  }

  // --- 新着チェック ---
  const runCheck = async () => {
    if (checking || favoriteThreads.length === 0) return
    setChecking(true)
    setNewCounts({})
    const items = favoriteThreads.slice()
    setCheckProgress({ done: 0, total: items.length })

    const results = {}
    let idx = 0

    const worker = async () => {
      while (idx < items.length) {
        const item = items[idx++]
        const latestRrid = await checkThreadLatestRrid(
          item.acode, item.ctgid, item.bid, item.tid,
        )
        const knownRrid = readSet[String(item.tid)] ?? 0
        if (latestRrid !== null && latestRrid > knownRrid) {
          results[String(item.tid)] = latestRrid - knownRrid
        }
        setCheckProgress((prev) => ({ ...prev, done: prev.done + 1 }))
      }
    }

    await Promise.all(Array.from({ length: Math.min(5, items.length) }, worker))
    setNewCounts(results)
    setChecking(false)
  }

  const hasNewCount = Object.keys(newCounts).length > 0
  const newThreadCount = Object.keys(newCounts).length

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />
      <View
        style={[
          styles.header,
          { backgroundColor: theme.header, paddingTop: insets.top + 12 },
        ]}
      >
        <Text style={[styles.headerTitle, { color: theme.headerText }]}>お気に入り</Text>
        {tab === 'threads' && favoriteThreads.length > 0 && (
          <TouchableOpacity
            style={styles.checkBtn}
            onPress={runCheck}
            disabled={checking}
            activeOpacity={0.7}
          >
            {checking ? (
              <View style={styles.checkBtnInner}>
                <ActivityIndicator size="small" color={theme.headerText} />
                <Text style={[styles.checkBtnText, { color: theme.headerText }]}>
                  {checkProgress.done}/{checkProgress.total}
                </Text>
              </View>
            ) : (
              <View style={styles.checkBtnInner}>
                <FontIcon name="refresh" size={13} color={theme.headerText} />
                <Text style={[styles.checkBtnText, { color: theme.headerText }]}>
                  {hasNewCount ? `${newThreadCount}件に新着` : '新着チェック'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* タブ */}
      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'boards' && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}
          onPress={() => setTab('boards')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabLabel, { color: tab === 'boards' ? theme.accent : theme.subText }]}>
            掲示板
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'threads' && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}
          onPress={() => setTab('threads')}
          activeOpacity={0.7}
        >
          <View style={styles.tabLabelWrap}>
            <Text style={[styles.tabLabel, { color: tab === 'threads' ? theme.accent : theme.subText }]}>
              スレ
            </Text>
            {hasNewCount && (
              <View style={[styles.tabBadge, { backgroundColor: theme.accent }]}>
                <Text style={styles.tabBadgeText}>{newThreadCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {tab === 'boards' ? (
        <FlatList
          data={favorites}
          keyExtractor={(item) => `${item.acode}-${item.bid}`}
          renderItem={({ item }) => (
            <View
              style={[styles.row, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}
            >
              <TouchableOpacity style={styles.rowMain} onPress={() => onPressBoard(item)} activeOpacity={0.7}>
                <Text style={[styles.boardName, { color: theme.accent }]}>{item.name}</Text>
                <Text style={[styles.area, { color: theme.subText }]}>
                  {AREA_NAMES[item.acode] || ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => openBoardInBrowser(item)}>
                <FontIcon name="external-link" size={15} color={theme.subText} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => onRemoveBoard(item)}>
                <FontIcon name="times" size={18} color={theme.bad} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.subText }]}>
                お気に入り掲示板はありません
              </Text>
              <Text style={[styles.emptyHint, { color: theme.subText }]}>
                掲示板一覧で ☆ をタップして追加できます
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={favoriteThreads}
          keyExtractor={(item) => String(item.tid)}
          renderItem={({ item }) => {
            const newCount = newCounts[String(item.tid)]
            return (
              <View
                style={[styles.row, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}
              >
                <TouchableOpacity style={styles.rowMain} onPress={() => onPressThread(item)} activeOpacity={0.7}>
                  <Text style={[styles.boardName, { color: theme.accent }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={[styles.area, { color: theme.subText }]}>
                    {AREA_NAMES[item.acode] || ''}
                  </Text>
                </TouchableOpacity>
                {newCount > 0 && (
                  <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                    <Text style={styles.badgeText}>+{newCount}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.iconBtn} onPress={() => openThreadInBrowser(item)}>
                  <FontIcon name="external-link" size={15} color={theme.subText} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => onRemoveThread(item)}>
                  <FontIcon name="times" size={18} color={theme.bad} />
                </TouchableOpacity>
              </View>
            )
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.subText }]}>
                お気に入りスレはありません
              </Text>
              <Text style={[styles.emptyHint, { color: theme.subText }]}>
                スレ画面の ☆ をタップして追加できます
              </Text>
            </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  checkBtn: {},
  checkBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  checkBtnText: { fontSize: 13, opacity: 0.85 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tabLabel: { fontSize: 14, fontWeight: '600' },
  tabLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabBadge: {
    borderRadius: 9,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { flex: 1 },
  boardName: { fontSize: 15, fontWeight: '500' },
  area: { fontSize: 11, marginTop: 3 },
  iconBtn: { paddingLeft: 12 },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 28,
    alignItems: 'center',
    marginRight: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 15, marginBottom: 8 },
  emptyHint: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
})
