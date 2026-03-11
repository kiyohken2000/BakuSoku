import React, { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import FontIcon from 'react-native-vector-icons/FontAwesome'
import { useSettings } from 'contexts/SettingsContext'
import { useTheme } from 'contexts/ThemeContext'

export default function NgWords() {
  const navigation = useNavigation()
  const { ngWords, setNgWords } = useSettings()
  const { theme, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const [input, setInput] = useState('')

  const add = () => {
    const word = input.trim()
    if (!word || ngWords.includes(word)) return
    setNgWords([...ngWords, word])
    setInput('')
  }

  const remove = (word) => {
    setNgWords(ngWords.filter((w) => w !== word))
  }

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />
      <View
        style={[styles.header, { backgroundColor: theme.header, paddingTop: insets.top + 12 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <FontIcon name="chevron-left" size={18} color={theme.headerText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.headerText }]}>NGワード</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.inputRow,
            { backgroundColor: theme.surface, borderBottomColor: theme.border },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.inputBorder,
                backgroundColor: theme.inputBg,
              },
            ]}
            placeholder="NGワードを追加"
            placeholderTextColor={theme.subText}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={add}
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme.accent }]}
            onPress={add}
          >
            <Text style={styles.addBtnText}>追加</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={ngWords}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <View
              style={[
                styles.row,
                { backgroundColor: theme.surface, borderBottomColor: theme.border },
              ]}
            >
              <Text style={[styles.word, { color: theme.text }]}>{item}</Text>
              <TouchableOpacity onPress={() => remove(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <FontIcon name="times" size={18} color={theme.bad} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: theme.subText }]}>
                NGワードが設定されていません
              </Text>
              <Text style={[styles.emptyHint, { color: theme.subText }]}>
                登録したワードを含むレスは非表示になります
              </Text>
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { width: 40 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  addBtn: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  word: { fontSize: 14, flex: 1, marginRight: 12 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyText: { fontSize: 14, marginBottom: 8 },
  emptyHint: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
})
