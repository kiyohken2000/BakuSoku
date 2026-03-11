import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  StatusBar,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import FontIcon from 'react-native-vector-icons/FontAwesome'
import { getAreaTop, getBoards, AREA_NAMES, AREA_CODES } from 'lib/bakusai'
import { useSettings } from 'contexts/SettingsContext'
import { useTheme } from 'contexts/ThemeContext'

// ─── サブコンポーネント（再レンダー抑制） ────────────────────────────────

const BoardItem = React.memo(({ item, isFav, onPress, theme }) => (
  <TouchableOpacity
    style={[
      styles.boardItem,
      { backgroundColor: theme.surface, borderBottomColor: theme.border },
    ]}
    onPress={() => onPress(item)}
    activeOpacity={0.7}
  >
    <Text style={[styles.boardName, { color: isFav ? theme.accent : theme.text }]}>
      {item.name}
    </Text>
    <FontIcon name="chevron-right" size={13} color={theme.subText} />
  </TouchableOpacity>
))

const SectionHeader = React.memo(({ section, theme }) => (
  <View
    style={[
      styles.sectionHeader,
      { backgroundColor: theme.bg, borderBottomColor: theme.border },
    ]}
  >
    {section.isFav ? (
      <View style={styles.sectionTitleRow}>
        <FontIcon name="star" size={12} color={theme.accent} style={{ marginRight: 6 }} />
        <Text style={[styles.sectionTitle, { color: theme.subText }]}>お気に入り</Text>
      </View>
    ) : (
      <Text style={[styles.sectionTitle, { color: theme.subText }]}>{section.title}</Text>
    )}
  </View>
))

// ─── メインコンポーネント ──────────────────────────────────────────────

export default function BoardList() {
  const navigation = useNavigation()
  const { acode, setAcode, favorites, showRestricted } = useSettings()
  const { theme, isDark } = useTheme()
  const insets = useSafeAreaInsets()

  const [allSections, setAllSections] = useState([])
  const [restrictedCtgids, setRestrictedCtgids] = useState(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showRegionModal, setShowRegionModal] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [acode])

  const loadCategories = async () => {
    setIsLoading(true)
    setError(null)
    setAllSections([])
    try {
      const { categories: cats, boardsByCtgid: areatopBoards, restrictedCtgids: rCtgids } =
        await getAreaTop(acode)

      setRestrictedCtgids(rCtgids)

      const missing = cats.filter((c) => !areatopBoards[c.ctgid]?.length)
      let allBoards = { ...areatopBoards }

      if (missing.length > 0) {
        const results = await Promise.all(
          missing.map(async (cat) => {
            try {
              const boards = await getBoards(acode, cat.ctgid)
              return { ctgid: cat.ctgid, boards }
            } catch {
              return { ctgid: cat.ctgid, boards: [] }
            }
          }),
        )
        for (const { ctgid, boards } of results) {
          if (boards.length > 0) allBoards[ctgid] = boards
        }
      }

      const secs = cats
        .filter((c) => allBoards[c.ctgid]?.length > 0)
        .map((c) => ({ title: c.name, ctgid: c.ctgid, data: allBoards[c.ctgid] }))

      setAllSections(secs)
    } catch (e) {
      setError(e.message || 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  // showRestricted / allSections が変わったときだけ再計算
  const sections = useMemo(() => {
    const filtered = showRestricted
      ? allSections
      : allSections.filter((s) => !restrictedCtgids.has(s.ctgid))

    const favForRegion = favorites.filter((f) => f.acode === acode)
    if (favForRegion.length > 0) {
      return [{ title: 'お気に入り', ctgid: 'fav', data: favForRegion, isFav: true }, ...filtered]
    }
    return filtered
  }, [showRestricted, allSections, restrictedCtgids, favorites, acode])

  const onBoardPress = useCallback((board) => {
    Haptics.selectionAsync()
    navigation.navigate('ThreadList', {
      acode: board.acode,
      ctgid: board.ctgid,
      bid: board.bid,
      boardName: board.name,
    })
  }, [navigation])

  const keyExtractor = useCallback((item) => String(item.bid), [])

  const renderItem = useCallback(({ item, section }) => (
    <BoardItem item={item} isFav={!!section.isFav} onPress={onBoardPress} theme={theme} />
  ), [onBoardPress, theme])

  const renderSectionHeader = useCallback(({ section }) => (
    <SectionHeader section={section} theme={theme} />
  ), [theme])

  const renderRegionItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={[
        styles.regionItem,
        { borderBottomColor: theme.border },
        item === acode && { backgroundColor: theme.surfaceAlt },
      ]}
      onPress={() => {
        setAcode(item)
        setShowRegionModal(false)
      }}
    >
      <Text style={[styles.regionItemText, { color: theme.text }]}>
        {AREA_NAMES[item]}
      </Text>
      {item === acode && (
        <FontIcon name="check" size={15} color={theme.accent} />
      )}
    </TouchableOpacity>
  ), [acode, theme, setAcode])

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />

      <View style={[styles.header, { backgroundColor: theme.header, paddingTop: insets.top + 12 }]}>
        <Text style={[styles.headerTitle, { color: theme.headerText }]}>爆速</Text>
        <TouchableOpacity onPress={() => setShowRegionModal(true)} style={styles.regionBtn}>
          <Text style={[styles.regionText, { color: theme.headerText }]}>
            {AREA_NAMES[acode] || '地域'}{'  '}<FontIcon name="caret-down" size={14} color={theme.headerText} />
          </Text>
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
            onPress={loadCategories}
            style={[styles.retryBtn, { borderColor: theme.accent }]}
          >
            <Text style={{ color: theme.accent }}>再試行</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          windowSize={5}
          maxToRenderPerBatch={20}
          initialNumToRender={30}
          removeClippedSubviews
        />
      )}

      <Modal visible={showRegionModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>地域を選択</Text>
              <TouchableOpacity onPress={() => setShowRegionModal(false)}>
                <Text style={{ color: theme.accent, fontSize: 15 }}>閉じる</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={AREA_CODES}
              keyExtractor={(item) => String(item)}
              renderItem={renderRegionItem}
            />
          </View>
        </View>
      </Modal>
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
  regionBtn: { padding: 4 },
  regionText: { fontSize: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 14, marginBottom: 12, textAlign: 'center' },
  retryBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { fontSize: 12, fontWeight: '600' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  boardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  boardName: { flex: 1, fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 16, fontWeight: '600' },
  regionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  regionItemText: { flex: 1, fontSize: 15 },
})
