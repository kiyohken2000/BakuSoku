import React, { useRef, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { useSettings } from '../../contexts/SettingsContext'

export default function AppEula() {
  const { theme } = useTheme()
  const { acceptAppEula } = useSettings()
  const [scrolledToEnd, setScrolledToEnd] = useState(false)
  const scrollRef = useRef(null)

  const onScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 40) {
      setScrolledToEnd(true)
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.box, { backgroundColor: theme.surface }]}>
        <Text style={[styles.title, { color: theme.text }]}>利用規約・コンテンツポリシー</Text>
        <Text style={[styles.subtitle, { color: theme.subText }]}>
          BakuSoku をご利用になる前に、以下をお読みください。
        </Text>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          onScroll={onScroll}
          scrollEventThrottle={32}
          showsVerticalScrollIndicator
        >
          <Text style={[styles.body, { color: theme.text }]}>
            {
              '【アプリの概要】\n' +
              'BakuSoku は、爆サイ.com の掲示板コンテンツを閲覧・書き込みするためのサードパーティ製クライアントアプリです。\n\n' +

              '【利用対象年齢】\n' +
              '本アプリは 18 歳以上を対象としています。18 歳未満の方はご利用いただけません。\n\n' +

              '【コンテンツポリシー（不適切コンテンツへの不寛容）】\n' +
              '本アプリを通じた以下のコンテンツ投稿は一切許容されません。\n' +
              '・他者への誹謗中傷・差別的発言・脅迫・ハラスメント\n' +
              '・個人情報（氏名・住所・電話番号等）の無断公開\n' +
              '・性的・暴力的・違法なコンテンツ\n' +
              '・スパム・広告・営利目的の投稿\n' +
              '・著作権を侵害するコンテンツ\n' +
              '・未成年者に有害なコンテンツ\n\n' +
              '上記の不適切コンテンツおよび迷惑ユーザーに対しては一切の寛容を持ちません。\n' +
              '違反が確認された場合、投稿の削除およびユーザーのアクセス制限等の措置を講じます。\n\n' +

              '【通報・ブロック機能】\n' +
              '各レスの「通報」ボタンから違反投稿を報告できます。\n' +
              '各レスの「ユーザーをブロック」ボタンから迷惑ユーザーをブロックできます。\n' +
              '通報は 24 時間以内に確認し、適切に対処します。\n\n' +

              '【お問い合わせ・通報先】\n' +
              '不適切なコンテンツの通報やお問い合わせは、アプリ内設定 > サポート からメールにてご連絡ください。\n\n' +

              '【免責事項】\n' +
              '投稿内容はユーザー本人の責任において行われます。\n' +
              '本アプリは爆サイ.com の公式アプリではありません。\n\n' +

              '【同意について】\n' +
              '「同意してアプリを使用する」ボタンをタップすることで、上記の利用規約およびコンテンツポリシーに同意したものとみなします。'
            }
          </Text>
          {!scrolledToEnd && (
            <Text style={[styles.scrollHint, { color: theme.subText }]}>
              最後までスクロールして同意ボタンを有効にしてください
            </Text>
          )}
        </ScrollView>
        <TouchableOpacity
          style={[
            styles.agreeBtn,
            { backgroundColor: scrolledToEnd ? theme.accent : theme.border },
          ]}
          onPress={scrolledToEnd ? acceptAppEula : undefined}
          disabled={!scrolledToEnd}
          activeOpacity={0.7}
        >
          <Text style={[styles.agreeBtnText, { color: scrolledToEnd ? '#fff' : theme.subText }]}>
            同意してアプリを使用する
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  box: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 12,
    padding: 20,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  scroll: {
    maxHeight: 400,
    marginBottom: 16,
  },
  body: {
    fontSize: 13,
    lineHeight: 20,
  },
  scrollHint: {
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
  agreeBtn: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  agreeBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
})
