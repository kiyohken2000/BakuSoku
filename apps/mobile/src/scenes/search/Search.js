import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  TextInput,
  Keyboard,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import FontIcon from 'react-native-vector-icons/FontAwesome'
import { search as searchApi, AREA_NAMES } from 'lib/bakusai'
import { useSettings } from 'contexts/SettingsContext'
import { useTheme } from 'contexts/ThemeContext'

export default function Search() {
  const navigation = useNavigation()
  const { acode } = useSettings()
  const { theme, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const inputRef = useRef(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searched, setSearched] = useState(false)
  const [searchedQuery, setSearchedQuery] = useState('')

  const onSearch = async () => {
    if (!query.trim()) return
    Keyboard.dismiss()
    setIsLoading(true)
    setError(null)
    setSearched(true)
    setSearchedQuery(query.trim())
    try {
      const res = await searchApi(acode, query.trim())
      setResults(res)
    } catch (e) {
      setError(e.message || 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  const onClear = () => {
    setQuery('')
    setResults([])
    setSearched(false)
    setSearchedQuery('')
    setError(null)
    inputRef.current?.focus()
  }

  const onResultPress = (item) => {
    const m = item.href.match(/acode=(\d+)\/ctgid=(\d+)\/bid=(\d+)\/tid=(\d+)\//)
    if (!m) return
    navigation.navigate('ThreadDetailFromSearch', {
      acode: parseInt(m[1], 10),
      ctgid: parseInt(m[2], 10),
      bid: parseInt(m[3], 10),
      tid: item.tid || m[4],
      title: item.title,
    })
  }

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />

      <View style={[styles.header, { backgroundColor: theme.header, paddingTop: insets.top + 12 }]}>
        <Text style={[styles.headerTitle, { color: theme.headerText }]}>検索</Text>
        <Text style={[styles.regionLabel, { color: theme.headerText }]}>
          {AREA_NAMES[acode] || '全国'}
        </Text>
      </View>

      <View
        style={[
          styles.searchBar,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        <View style={[styles.inputWrap, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="キーワードを入力"
            placeholderTextColor={theme.subText}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={onSearch}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={onClear} style={styles.clearBtn} hitSlop={8}>
              <FontIcon name="times-circle" size={16} color={theme.subText} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.searchBtn,
            { backgroundColor: query.trim() ? theme.accent : theme.surfaceAlt },
          ]}
          onPress={onSearch}
          disabled={!query.trim()}
        >
          <Text style={styles.searchBtnText}>検索</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: theme.subText }}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, i) => item.tid || `${i}-${item.href}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.resultItem,
                { borderBottomColor: theme.border, backgroundColor: theme.surface },
              ]}
              onPress={() => onResultPress(item)}
              activeOpacity={0.7}
            >
              <Text style={[styles.resultText, { color: theme.text }]} numberOfLines={3}>
                {item.title}
              </Text>
              <View style={styles.resultMeta}>
                {item.updatedAt ? (
                  <Text style={[styles.metaText, { color: theme.subText }]}>
                    {item.updatedAt}
                  </Text>
                ) : null}
                {item.resCount > 0 ? (
                  <Text style={[styles.metaText, { color: theme.subText }]}>
                    {item.updatedAt ? '  ·  ' : ''}{item.resCount.toLocaleString()}件
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: theme.subText }}>
                {searched
                  ? `「${searchedQuery}」の検索結果はありません`
                  : 'キーワードを入力して検索'}
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
  regionLabel: { fontSize: 13 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
  },
  clearBtn: {
    paddingLeft: 6,
  },
  searchBtn: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  resultItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultText: { fontSize: 14, lineHeight: 20 },
  resultMeta: {
    flexDirection: 'row',
    marginTop: 4,
  },
  metaText: { fontSize: 11 },
})
