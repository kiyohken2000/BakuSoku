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
import * as Haptics from 'expo-haptics'
import FontIcon from 'react-native-vector-icons/FontAwesome'
import { useSettings } from 'contexts/SettingsContext'
import { useTheme } from 'contexts/ThemeContext'
import { AREA_NAMES, checkThreadLatestRrid } from 'lib/bakusai'
import { clearThreadCache } from 'lib/db'
import ContextMenu from 'components/ContextMenu'

export default function History() {
  const navigation = useNavigation()
  const {
    readHistory, setReadHistory,
    favoriteThreads, addFavoriteThread, removeFavoriteThread,
    readSet,
    clearThreadState,
    fs,
  } = useSettings()
  const { theme, isDark } = useTheme()
  const insets = useSafeAreaInsets()

  const [menuItem, setMenuEntry] = useState(null)
  const [newCounts, setNewCounts] = useState({})   // { [tid]: 新着数 }
  const [checking, setChecking] = useState(false)
  const [checkProgress, setCheckProgress] = useState({ done: 0, total: 0 })

  const onPressThread = (entry) => {
    navigation.navigate('ThreadDetail', {
      acode: entry.acode,
      ctgid: entry.ctgid,
      bid: entry.bid,
      tid: entry.tid,
      title: entry.title,
    })
  }

  const onClearAll = () => {
    Alert.alert('履歴を全て削除', '閲覧履歴をすべて削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          setReadHistory([])
          setNewCounts({})
        },
      },
    ])
  }

  const runCheck = async () => {
    if (checking || readHistory.length === 0) return
    setChecking(true)
    setNewCounts({})
    const items = readHistory.slice()
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

  const onLongPress = (entry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setMenuEntry(entry)
  }

  const removeFromHistory = (tid) => {
    setReadHistory(readHistory.filter((h) => h.tid !== tid))
    clearThreadState(tid)
    clearThreadCache(tid).catch(() => {})
  }

  const formatDate = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now - d
    const diffH = Math.floor(diffMs / 3600000)
    if (diffH < 1) return 'たった今'
    if (diffH < 24) return `${diffH}時間前`
    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) return `${diffD}日前`
    return `${d.getMonth() + 1}/${d.getDate()}`
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
        <Text style={[styles.headerTitle, { color: theme.headerText }]}>閲覧履歴</Text>
        <View style={styles.headerActions}>
          {readHistory.length > 0 && (
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
          {readHistory.length > 0 && (
            <TouchableOpacity onPress={onClearAll} style={{ marginLeft: 12 }}>
              <Text style={{ color: theme.headerText, fontSize: 13, opacity: 0.7 }}>全削除</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={readHistory}
        keyExtractor={(item) => item.tid}
        renderItem={({ item }) => {
          const newCount = newCounts[String(item.tid)]
          return (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}
              onPress={() => onPressThread(item)}
              onLongPress={() => onLongPress(item)}
              delayLongPress={400}
              activeOpacity={0.7}
            >
              <View style={styles.rowMain}>
                <Text style={[styles.title, { color: theme.text, fontSize: fs(15) }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[styles.meta, { color: theme.subText, fontSize: fs(11) }]}>
                  {AREA_NAMES[item.acode] || ''}{' · '}{formatDate(item.at)}
                </Text>
              </View>
              {newCount > 0 && (
                <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                  <Text style={styles.badgeText}>+{newCount}</Text>
                </View>
              )}
              <FontIcon name="chevron-right" size={14} color={theme.subText} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.subText }]}>履歴はありません</Text>
          </View>
        }
      />

      <ContextMenu
        visible={!!menuItem}
        onClose={() => setMenuEntry(null)}
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
                onPress: () => addFavoriteThread({
                  tid: menuItem.tid,
                  title: menuItem.title,
                  acode: menuItem.acode,
                  ctgid: menuItem.ctgid,
                  bid: menuItem.bid,
                }),
              },
          {
            label: '履歴から削除',
            onPress: () => removeFromHistory(menuItem.tid),
            destructive: true,
          },
          {
            label: 'ブラウザで開く',
            onPress: () => Linking.openURL(
              `https://bakusai.com/thr_res/acode=${menuItem.acode}/ctgid=${menuItem.ctgid}/bid=${menuItem.bid}/tid=${menuItem.tid}/tp=1/`
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  checkBtn: { flexDirection: 'row', alignItems: 'center' },
  checkBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  checkBtnText: { fontSize: 13, opacity: 0.85 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { flex: 1, marginRight: 8 },
  title: { fontSize: 14, lineHeight: 20 },
  meta: { fontSize: 11, marginTop: 3 },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 28,
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 14 },
})
