import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import { getThread, getRatingList, postResponse } from 'lib/bakusai'
import { useSettings } from 'contexts/SettingsContext'
import { useTheme } from 'contexts/ThemeContext'

export default function ThreadDetail() {
  const navigation = useNavigation()
  const route = useRoute()
  const { acode, ctgid, bid, tid, title } = route.params
  const { ngWords, addHistory, markRead } = useSettings()
  const { theme, isDark } = useTheme()
  const flatListRef = useRef(null)

  const [responses, setResponses] = useState([])
  const [pageTitle, setPageTitle] = useState(title || '')
  const [formFields, setFormFields] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ratings, setRatings] = useState({})
  const [hasOlderPages, setHasOlderPages] = useState(false)
  const [olderPage, setOlderPage] = useState(2)
  const [loadingOlder, setLoadingOlder] = useState(false)

  const [showPostModal, setShowPostModal] = useState(false)
  const [postBody, setPostBody] = useState('')
  const [postName, setPostName] = useState('')
  const [isPosting, setIsPosting] = useState(false)

  useEffect(() => {
    loadThread(null)
  }, [])

  const loadThread = async (page) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getThread(acode, ctgid, bid, tid, page)
      setResponses(data.responses)
      setPageTitle(data.pageTitle || title)
      setFormFields(data.formFields)
      setHasOlderPages(data.responses.length >= 50)

      addHistory({
        tid,
        title: data.pageTitle || title,
        acode,
        ctgid,
        bid,
        at: Date.now(),
      })

      if (data.responses.length > 0) {
        markRead(tid, data.responses[data.responses.length - 1].rrid)
        loadRatings(tid, data.responses.map((r) => r.rrid))
      }
    } catch (e) {
      setError(e.message || 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  const loadOlderResponses = async () => {
    if (loadingOlder) return
    setLoadingOlder(true)
    try {
      const data = await getThread(acode, ctgid, bid, tid, olderPage)
      if (data.responses.length > 0) {
        setResponses((prev) => {
          const existingRrids = new Set(prev.map((r) => r.rrid))
          const newResps = data.responses.filter((r) => !existingRrids.has(r.rrid))
          return [...newResps, ...prev]
        })
        setOlderPage((p) => p + 1)
        setHasOlderPages(data.responses.length >= 50)
        loadRatings(tid, data.responses.map((r) => r.rrid))
      } else {
        setHasOlderPages(false)
      }
    } catch {}
    setLoadingOlder(false)
  }

  const loadRatings = async (tid, rrids) => {
    try {
      if (rrids.length === 0) return
      const list = await getRatingList(tid, [0, ...rrids])
      const newRatings = {}
      rrids.forEach((rrid, i) => {
        const entry = list[i + 1]
        if (entry) {
          newRatings[rrid] = {
            good: entry['1']?.count || 0,
            bad: entry['2']?.count || 0,
          }
        }
      })
      setRatings((prev) => ({ ...prev, ...newRatings }))
    } catch {}
  }

  const onPost = async () => {
    if (!postBody.trim() || !formFields) return
    setIsPosting(true)
    try {
      const result = await postResponse(
        formFields._action,
        formFields,
        postBody.trim(),
        postName.trim(),
      )
      if (result?.status === 'success') {
        setPostBody('')
        setPostName('')
        setShowPostModal(false)
        await loadThread(null)
      } else if (result?.status === 'cushion') {
        Alert.alert('確認', '投稿してよろしいですか？', [
          { text: 'キャンセル', style: 'cancel' },
          { text: '投稿', onPress: onPost },
        ])
      } else {
        Alert.alert('エラー', '投稿に失敗しました')
      }
    } catch (e) {
      Alert.alert('エラー', e.message || '投稿に失敗しました')
    } finally {
      setIsPosting(false)
    }
  }

  const filteredResponses = responses.filter(
    (r) => !ngWords.some((w) => r.body.includes(w) || r.name.includes(w)),
  )

  const renderResponse = ({ item }) => {
    const rating = ratings[item.rrid] || { good: 0, bad: 0 }
    return (
      <View
        style={[
          styles.responseItem,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        <View style={styles.responseHeader}>
          <Text style={[styles.rrid, { color: theme.accent }]}>#{item.rrid}</Text>
          <Text style={[styles.name, { color: theme.subText }]}>{item.name}</Text>
          <Text style={[styles.date, { color: theme.subText }]}>{item.date}</Text>
        </View>
        <Text style={[styles.body, { color: theme.text }]} selectable>
          {item.body}
        </Text>
        {(rating.good > 0 || rating.bad > 0) && (
          <View style={styles.goodBadRow}>
            <Text style={[styles.goodBadText, { color: theme.good }]}>
              👍 {rating.good}
            </Text>
            <Text style={[styles.goodBadText, { color: theme.bad, marginLeft: 12 }]}>
              👎 {rating.bad}
            </Text>
          </View>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.header} />

      <View style={[styles.header, { backgroundColor: theme.header }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: theme.headerText }]}>‹ 戻る</Text>
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: theme.headerText }]}
          numberOfLines={1}
        >
          {pageTitle}
        </Text>
        <TouchableOpacity
          style={styles.postBtn}
          onPress={() => setShowPostModal(true)}
        >
          <Text style={{ color: theme.headerText, fontSize: 18 }}>✏️</Text>
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
            onPress={() => loadThread(null)}
            style={[styles.retryBtn, { borderColor: theme.accent }]}
          >
            <Text style={{ color: theme.accent }}>再試行</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredResponses}
          keyExtractor={(item) => String(item.rrid)}
          renderItem={renderResponse}
          ListHeaderComponent={
            hasOlderPages ? (
              <TouchableOpacity
                style={[
                  styles.loadOlderBtn,
                  { backgroundColor: theme.surface, borderBottomColor: theme.border },
                ]}
                onPress={loadOlderResponses}
                disabled={loadingOlder}
              >
                {loadingOlder ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <Text style={{ color: theme.accent, fontSize: 14 }}>
                    ▲ 前のレスを読む
                  </Text>
                )}
              </TouchableOpacity>
            ) : null
          }
          onLayout={() => {
            if (filteredResponses.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false })
            }
          }}
        />
      )}

      <Modal visible={showPostModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.postModal, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>返信する</Text>
              <TouchableOpacity onPress={() => setShowPostModal(false)}>
                <Text style={{ color: theme.subText }}>閉じる</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[
                styles.nameInput,
                {
                  color: theme.text,
                  backgroundColor: theme.inputBg,
                  borderColor: theme.inputBorder,
                },
              ]}
              placeholder="名前（省略可）"
              placeholderTextColor={theme.subText}
              value={postName}
              onChangeText={setPostName}
            />
            <TextInput
              style={[
                styles.bodyInput,
                {
                  color: theme.text,
                  backgroundColor: theme.inputBg,
                  borderColor: theme.inputBorder,
                },
              ]}
              placeholder="本文を入力..."
              placeholderTextColor={theme.subText}
              multiline
              value={postBody}
              onChangeText={setPostBody}
            />
            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: postBody.trim() ? theme.accent : theme.surfaceAlt },
              ]}
              onPress={onPost}
              disabled={!postBody.trim() || isPosting}
            >
              {isPosting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>投稿する</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '600' },
  postBtn: { minWidth: 40, alignItems: 'flex-end' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 14, marginBottom: 12, textAlign: 'center' },
  retryBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 8 },
  responseItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  rrid: { fontSize: 12, fontWeight: '700', marginRight: 8 },
  name: { fontSize: 12, marginRight: 8 },
  date: { fontSize: 11, marginLeft: 'auto' },
  body: { fontSize: 14, lineHeight: 21 },
  goodBadRow: { flexDirection: 'row', marginTop: 6 },
  goodBadText: { fontSize: 12 },
  loadOlderBtn: {
    padding: 14,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  postModal: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 16, fontWeight: '600' },
  nameInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 8,
  },
  bodyInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    height: 120,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  submitBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
