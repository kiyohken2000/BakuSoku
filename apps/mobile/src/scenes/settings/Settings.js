import React from 'react'
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  StyleSheet,
  StatusBar,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import FontIcon from 'react-native-vector-icons/FontAwesome'
import { AREA_NAMES, AREA_CODES } from 'lib/bakusai'
import { useSettings } from 'contexts/SettingsContext'
import { useTheme } from 'contexts/ThemeContext'
import { version } from '../../config'

const appIcon = require('../../../assets/images/logo-lg.png')

export default function Settings() {
  const navigation = useNavigation()
  const {
    acode, setAcode,
    ngWords,
    readFromStart, setReadFromStart,
    memo, setMemo,
  } = useSettings()
  const { theme, isDark, toggleTheme } = useTheme()
  const insets = useSafeAreaInsets()

  const row = [
    styles.row,
    { borderBottomColor: theme.border, backgroundColor: theme.surface },
  ]

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />

      <View style={[styles.header, { backgroundColor: theme.header, paddingTop: insets.top + 12 }]}>
        <Text style={[styles.headerTitle, { color: theme.headerText }]}>設定</Text>
      </View>

      <ScrollView>
        {/* 外観 */}
        <View style={[styles.sectionHeader, { backgroundColor: theme.bg }]}>
          <Text style={[styles.sectionTitle, { color: theme.subText }]}>外観</Text>
        </View>
        <View style={[row, styles.switchRow]}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>ダークモード</Text>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#e5e7eb', true: '#f97316' }}
            thumbColor="#fff"
          />
        </View>
        <View style={[row, styles.switchRow]}>
          <View style={styles.switchLabelWrap}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>スレを最初から表示</Text>
            <Text style={[styles.rowSub, { color: theme.subText }]}>
              ON: レス1から順に読む / OFF: 最新レスから読む
            </Text>
          </View>
          <Switch
            value={readFromStart}
            onValueChange={setReadFromStart}
            trackColor={{ false: '#e5e7eb', true: '#f97316' }}
            thumbColor="#fff"
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
        <TouchableOpacity
          style={[row, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}
          onPress={() => navigation.navigate('NgWords')}
          activeOpacity={0.7}
        >
          <Text style={[styles.rowLabel, { color: theme.text, flex: 1 }]}>NGワードを管理</Text>
          <View style={styles.rowRight}>
            {ngWords.length > 0 && (
              <Text style={[styles.badge, { color: theme.subText }]}>{ngWords.length}件</Text>
            )}
            <FontIcon name="chevron-right" size={13} color={theme.subText} />
          </View>
        </TouchableOpacity>

        {/* メモ */}
        <View style={[styles.sectionHeader, { backgroundColor: theme.bg }]}>
          <Text style={[styles.sectionTitle, { color: theme.subText }]}>メモ</Text>
        </View>
        <View
          style={[
            styles.memoRow,
            { backgroundColor: theme.surface, borderBottomColor: theme.border },
          ]}
        >
          <TextInput
            style={[
              styles.memoInput,
              {
                color: theme.text,
                borderColor: theme.inputBorder,
                backgroundColor: theme.inputBg,
              },
            ]}
            value={memo}
            onChangeText={setMemo}
            placeholder="メモを入力"
            placeholderTextColor={theme.subText}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
        </View>

        {/* このアプリについて */}
        <View style={[styles.sectionHeader, { backgroundColor: theme.bg }]}>
          <Text style={[styles.sectionTitle, { color: theme.subText }]}>
            このアプリについて
          </Text>
        </View>
        <View
          style={[
            styles.aboutSection,
            { backgroundColor: theme.surface, borderBottomColor: theme.border },
          ]}
        >
          <Image source={appIcon} style={styles.appIcon} resizeMode="contain" />
          <Text style={[styles.appName, { color: theme.text }]}>BakuSoku</Text>
          <Text style={[styles.appVersion, { color: theme.subText }]}>
            Version {version}
          </Text>
          <Text style={[styles.appDesc, { color: theme.subText }]}>
            爆サイ.com 非公式ブラウザアプリ
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  rowLabel: { fontSize: 14 },
  rowSub: { fontSize: 11, marginTop: 2 },
  switchRow: { justifyContent: 'space-between' },
  switchLabelWrap: { flex: 1, marginRight: 12 },
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
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { fontSize: 13 },
  memoRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memoInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  aboutSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 18,
    marginBottom: 12,
  },
  appName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 13,
    marginBottom: 6,
  },
  appDesc: {
    fontSize: 12,
  },
})
