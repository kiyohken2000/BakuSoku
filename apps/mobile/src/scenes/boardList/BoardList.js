import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { getAreaTop, getBoards, AREA_NAMES, AREA_CODES } from 'lib/bakusai'
import { useSettings } from 'contexts/SettingsContext'
import { useTheme } from 'contexts/ThemeContext'

export default function BoardList() {
  const navigation = useNavigation()
  const { acode, setAcode, favorites } = useSettings()
  const { theme, isDark } = useTheme()

  const [sections, setSections] = useState([])
  const [categories, setCategories] = useState([])
  const [expandedBoards, setExpandedBoards] = useState({})
  const [loadingCtgid, setLoadingCtgid] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showRegionModal, setShowRegionModal] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [acode])

  const loadCategories = async () => {
    setIsLoading(true)
    setError(null)
    setCategories([])
    setExpandedBoards({})
    setSections([])
    try {
      const { categories: cats, boardsByCtgid } = await getAreaTop(acode)
      setCategories(cats)
      const hasBoards = Object.keys(boardsByCtgid).length > 0
      if (hasBoards) {
        const secs = cats
          .filter((c) => boardsByCtgid[c.ctgid]?.length > 0)
          .map((c) => ({
            title: c.name,
            ctgid: c.ctgid,
            data: boardsByCtgid[c.ctgid],
          }))
        setSections(secs)
      }
    } catch (e) {
      setError(e.message || 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  const onBoardPress = (board) => {
    navigation.navigate('ThreadList', {
      acode: board.acode,
      ctgid: board.ctgid,
      bid: board.bid,
      boardName: board.name,
    })
  }

  const onCategoryPress = async (cat) => {
    if (expandedBoards[cat.ctgid]) {
      setExpandedBoards((prev) => {
        const next = { ...prev }
        delete next[cat.ctgid]
        return next
      })
      return
    }
    setLoadingCtgid(cat.ctgid)
    try {
      const boards = await getBoards(acode, cat.ctgid)
      setExpandedBoards((prev) => ({ ...prev, [cat.ctgid]: boards }))
    } catch {}
    setLoadingCtgid(null)
  }

  const hasSections = sections.length > 0
  const favForRegion = favorites.filter((f) => f.acode === acode)

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'light-content'}
        backgroundColor={theme.header}
      />

      <View style={[styles.header, { backgroundColor: theme.header }]}>
        <Text style={[styles.headerTitle, { color: theme.headerText }]}>爆速</Text>
        <TouchableOpacity onPress={() => setShowRegionModal(true)} style={styles.regionBtn}>
          <Text style={[styles.regionText, { color: theme.headerText }]}>
            {AREA_NAMES[acode] || '地域'} ▼
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
      ) : hasSections ? (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.bid)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.boardItem,
                { backgroundColor: theme.surface, borderBottomColor: theme.border },
              ]}
              onPress={() => onBoardPress(item)}
              activeOpacity={0.7}
            >
              <Text style={[styles.boardName, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.arrow, { color: theme.subText }]}>›</Text>
            </TouchableOpacity>
          )}
          renderSectionHeader={({ section }) => (
            <View
              style={[
                styles.sectionHeader,
                { backgroundColor: theme.bg, borderBottomColor: theme.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: theme.subText }]}>
                {section.title}
              </Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
        />
      ) : (
        <ScrollView>
          {favForRegion.length > 0 && (
            <>
              <View
                style={[
                  styles.sectionHeader,
                  { backgroundColor: theme.bg, borderBottomColor: theme.border },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: theme.subText }]}>
                  ★ お気に入り
                </Text>
              </View>
              {favForRegion.map((board) => (
                <TouchableOpacity
                  key={`fav-${board.bid}`}
                  style={[
                    styles.boardItem,
                    { backgroundColor: theme.surface, borderBottomColor: theme.border },
                  ]}
                  onPress={() => onBoardPress(board)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.boardName, { color: theme.accent }]}>{board.name}</Text>
                  <Text style={[styles.arrow, { color: theme.subText }]}>›</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {categories.map((cat) => (
            <View key={cat.ctgid}>
              <TouchableOpacity
                style={[
                  styles.categoryItem,
                  { backgroundColor: theme.bg, borderBottomColor: theme.border },
                ]}
                onPress={() => onCategoryPress(cat)}
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryName, { color: theme.subText }]}>
                  {cat.name}
                </Text>
                {loadingCtgid === cat.ctgid ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <Text style={{ color: theme.subText }}>
                    {expandedBoards[cat.ctgid] ? '▲' : '▼'}
                  </Text>
                )}
              </TouchableOpacity>
              {expandedBoards[cat.ctgid]?.map((board) => (
                <TouchableOpacity
                  key={`board-${board.bid}`}
                  style={[
                    styles.boardItem,
                    { backgroundColor: theme.surface, borderBottomColor: theme.border },
                  ]}
                  onPress={() => onBoardPress(board)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.boardName, { color: theme.text }]}>{board.name}</Text>
                  <Text style={[styles.arrow, { color: theme.subText }]}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
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
              renderItem={({ item }) => (
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
                    <Text style={{ color: theme.accent }}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
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
    paddingVertical: 12,
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
  boardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  boardName: { flex: 1, fontSize: 15 },
  arrow: { fontSize: 18, marginLeft: 8 },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryName: { flex: 1, fontSize: 13, fontWeight: '600' },
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
