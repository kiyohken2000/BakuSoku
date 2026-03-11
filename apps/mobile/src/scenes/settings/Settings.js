import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  StatusBar,
  TextInput,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { AREA_NAMES, AREA_CODES } from 'lib/bakusai'
import { useSettings } from 'contexts/SettingsContext'
import { useTheme } from 'contexts/ThemeContext'

export default function Settings() {
  const navigation = useNavigation()
  const { acode, setAcode, ngWords, setNgWords, favorites, removeFavorite, readHistory } =
    useSettings()
  const { theme, isDark, toggleTheme } = useTheme()

  const [newNgWord, setNewNgWord] = useState('')

  const addNgWord = () => {
    const word = newNgWord.trim()
    if (!word) return
    if (!ngWords.includes(word)) {
      setNgWords([...ngWords, word])
    }
    setNewNgWord('')
  }

  const row = [
    styles.row,
    { borderBottomColor: theme.border, backgroundColor: theme.surface },
  ]

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.header} />

      <View style={[styles.header, { backgroundColor: theme.header }]}>
        <Text style={[styles.headerTitle, { color: theme.headerText }]}>設定</Text>
      </View>

      <ScrollView>
        {/* 外観 */}
        <View style={[styles.sectionHeader, { backgroundColor: theme.bg }]}>
          <Text style={[styles.sectionTitle, { color: theme.subText }]}>外観</Text>
        </View>
        <View style={row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>ダークモード</Text>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#e5e7eb', true: '#f97316' }}
            thumbColor={isDark ? '#fff' : '#fff'}
          />
        </View>

        {/* 地域 */}
        <View style={[styles.sectionHeader, { backgroundColor: theme.bg }]}>
          <Text style={[styles.sectionTitle, { color: theme.subText }]}>地域</Text>
        </View>
        <View style={[styles.regionGrid, { backgroundColor: theme.surface }]}>
          {AREA_CODES.map((code) => (
            <TouchableOpacity
              key={code}
              style={[
                styles.regionChip,
                { borderColor: code === acode ? theme.accent : theme.border },
                code === acode && { backgroundColor: theme.accent },
              ]}
              onPress={() => setAcode(code)}
            >
              <Text
                style={[
                  styles.regionChipText,
                  { color: code === acode ? '#fff' : theme.text },
                ]}
              >
                {AREA_NAMES[code]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* NGワード */}
        <View style={[styles.sectionHeader, { backgroundColor: theme.bg }]}>
          <Text style={[styles.sectionTitle, { color: theme.subText }]}>NGワード</Text>
        </View>
        <View
          style={[
            styles.ngInputRow,
            { backgroundColor: theme.surface, borderBottomColor: theme.border },
          ]}
        >
          <TextInput
            style={[
              styles.ngInput,
              {
                color: theme.text,
                borderColor: theme.inputBorder,
                backgroundColor: theme.inputBg,
              },
            ]}
            placeholder="NGワードを追加"
            placeholderTextColor={theme.subText}
            value={newNgWord}
            onChangeText={setNewNgWord}
            onSubmitEditing={addNgWord}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme.accent }]}
            onPress={addNgWord}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>追加</Text>
          </TouchableOpacity>
        </View>
        {ngWords.length === 0 ? (
          <View style={row}>
            <Text style={{ color: theme.subText, fontSize: 13 }}>NGワードなし</Text>
          </View>
        ) : (
          ngWords.map((word) => (
            <View key={word} style={row}>
              <Text style={[styles.rowLabel, { color: theme.text }]}>{word}</Text>
              <TouchableOpacity
                onPress={() => setNgWords(ngWords.filter((w) => w !== word))}
              >
                <Text style={{ color: theme.bad, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* お気に入り */}
        <View style={[styles.sectionHeader, { backgroundColor: theme.bg }]}>
          <Text style={[styles.sectionTitle, { color: theme.subText }]}>
            お気に入り掲示板
          </Text>
        </View>
        {favorites.length === 0 ? (
          <View style={row}>
            <Text style={{ color: theme.subText, fontSize: 13 }}>お気に入りなし</Text>
          </View>
        ) : (
          favorites.map((fav) => (
            <View key={`${fav.acode}-${fav.bid}`} style={row}>
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() =>
                  navigation.navigate('HomeTab', {
                    screen: 'ThreadList',
                    params: {
                      acode: fav.acode,
                      ctgid: fav.ctgid,
                      bid: fav.bid,
                      boardName: fav.name,
                    },
                  })
                }
              >
                <Text style={[styles.rowLabel, { color: theme.accent }]}>
                  {fav.name}
                </Text>
                <Text style={{ color: theme.subText, fontSize: 11 }}>
                  {AREA_NAMES[fav.acode]}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'お気に入りから削除',
                    `「${fav.name}」を削除しますか？`,
                    [
                      { text: 'キャンセル', style: 'cancel' },
                      {
                        text: '削除',
                        style: 'destructive',
                        onPress: () => removeFavorite(fav.bid, fav.acode),
                      },
                    ],
                  )
                }
              >
                <Text style={{ color: theme.bad, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* 閲覧履歴 */}
        <View style={[styles.sectionHeader, { backgroundColor: theme.bg }]}>
          <Text style={[styles.sectionTitle, { color: theme.subText }]}>
            閲覧履歴（最近20件）
          </Text>
        </View>
        {readHistory.slice(0, 20).length === 0 ? (
          <View style={row}>
            <Text style={{ color: theme.subText, fontSize: 13 }}>履歴なし</Text>
          </View>
        ) : (
          readHistory.slice(0, 20).map((entry) => (
            <TouchableOpacity
              key={entry.tid}
              style={row}
              onPress={() =>
                navigation.navigate('HomeTab', {
                  screen: 'ThreadDetail',
                  params: {
                    acode: entry.acode,
                    ctgid: entry.ctgid,
                    bid: entry.bid,
                    tid: entry.tid,
                    title: entry.title,
                  },
                })
              }
            >
              <Text
                style={[styles.rowLabel, { color: theme.text }]}
                numberOfLines={1}
              >
                {entry.title}
              </Text>
              <Text style={{ color: theme.subText, fontSize: 16, marginLeft: 8 }}>›</Text>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { flex: 1, fontSize: 14 },
  regionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    gap: 8,
  },
  regionChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  regionChipText: { fontSize: 13 },
  ngInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  ngInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  addBtn: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
})
