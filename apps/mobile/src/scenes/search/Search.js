import React, { useState } from 'react'
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
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { search as searchApi, AREA_NAMES } from 'lib/bakusai'
import { useSettings } from 'contexts/SettingsContext'
import { useTheme } from 'contexts/ThemeContext'

export default function Search() {
  const navigation = useNavigation()
  const { acode } = useSettings()
  const { theme, isDark } = useTheme()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searched, setSearched] = useState(false)

  const onSearch = async () => {
    if (!query.trim()) return
    Keyboard.dismiss()
    setIsLoading(true)
    setError(null)
    setSearched(true)
    try {
      const res = await searchApi(acode, query.trim())
      setResults(res)
    } catch (e) {
      setError(e.message || 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  const onResultPress = (item) => {
    const m = item.href.match(/acode=(\d+)\/ctgid=(\d+)\/bid=(\d+)\/tid=(\d+)\//)
    if (!m) return
    navigation.navigate('ThreadDetailFromSearch', {
      acode: parseInt(m[1], 10),
      ctgid: parseInt(m[2], 10),
      bid: parseInt(m[3], 10),
      tid: m[4],
      title: item.text,
    })
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.header} />

      <View style={[styles.header, { backgroundColor: theme.header }]}>
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
        <TextInput
          style={[
            styles.searchInput,
            {
              color: theme.text,
              backgroundColor: theme.inputBg,
              borderColor: theme.inputBorder,
            },
          ]}
          placeholder="キーワードを入力"
          placeholderTextColor={theme.subText}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={onSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
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
          keyExtractor={(item, i) => `${i}-${item.href}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.resultItem,
                { borderBottomColor: theme.border, backgroundColor: theme.surface },
              ]}
              onPress={() => onResultPress(item)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.resultText, { color: theme.text }]}
                numberOfLines={3}
              >
                {item.text}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: theme.subText }}>
                {searched
                  ? `「${query}」の検索結果はありません`
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
    paddingVertical: 12,
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
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  searchBtn: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  resultItem: {
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultText: { fontSize: 14, lineHeight: 20 },
})
