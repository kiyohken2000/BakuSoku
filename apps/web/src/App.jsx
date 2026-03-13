import { useState, useEffect } from 'react'
import './App.css'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Support from './pages/Support'
import iconImg from './assets/imsages/icon.png'
import badgeAppStore from './assets/imsages/badges/appstore.png'
import badgeGooglePlay from './assets/imsages/badges/googleplay.png'
import ss1 from './assets/imsages/screenshots/1.boards.jpg'
import ss1a from './assets/imsages/screenshots/1.boards_area.jpg'
import ss2 from './assets/imsages/screenshots/2.threads.jpg'
import ss3 from './assets/imsages/screenshots/3.thread_view.jpg'
import ss4 from './assets/imsages/screenshots/4.thread_menu.jpg'
import ss5 from './assets/imsages/screenshots/5.thread_post.jpg'
import ss6 from './assets/imsages/screenshots/6.thread_copy.jpg'
import ss7 from './assets/imsages/screenshots/7.search.jpg'
import ss8 from './assets/imsages/screenshots/8.favorites_boards.jpg'
import ss9 from './assets/imsages/screenshots/9.favorites_threads.jpg'
import ss10 from './assets/imsages/screenshots/10.history.jpg'
import ss11 from './assets/imsages/screenshots/11.settings_1.jpg'

const screenshots = [
  { src: ss1, caption: '掲示板一覧' },
  { src: ss1a, caption: '地域選択' },
  { src: ss2, caption: 'スレッド一覧' },
  { src: ss3, caption: 'スレッド閲覧' },
  { src: ss4, caption: 'メニュー' },
  { src: ss5, caption: '書き込み' },
  { src: ss6, caption: 'コピー' },
  { src: ss7, caption: '検索' },
  { src: ss8, caption: 'お気に入り（板）' },
  { src: ss9, caption: 'お気に入り（スレ）' },
  { src: ss10, caption: '閲覧履歴' },
  { src: ss11, caption: '設定' },
]

const features = [
  {
    icon: '\u{1F6AB}',
    title: '広告なしで快適',
    desc: '煩わしい広告を一切排除。コンテンツだけに集中して閲覧できます。',
  },
  {
    icon: '\u{1F319}',
    title: 'ダークモード',
    desc: '目に優しいダークテーマを標準搭載。夜間の閲覧も快適です。',
  },
  {
    icon: '\u26A1',
    title: '爆速ブラウジング',
    desc: 'ネイティブアプリだから軽快。スレッドの読み込みもサクサク。',
  },
  {
    icon: '\u{1F50D}',
    title: 'スレッド検索',
    desc: 'キーワードでスレッドを横断検索。目当ての話題がすぐ見つかります。',
  },
  {
    icon: '\u2B50',
    title: 'お気に入り管理',
    desc: '板もスレッドもお気に入り登録。新着チェックで見逃しゼロ。',
  },
  {
    icon: '\u{1F6E1}\uFE0F',
    title: 'NGワードフィルタ',
    desc: '見たくないワードを非表示に。自分好みの閲覧環境をカスタマイズ。',
  },
  {
    icon: '\u{1F4DD}',
    title: '書き込み対応',
    desc: 'アプリから直接レスを投稿。アンカーやコピーもワンタップ。',
  },
  {
    icon: '\u{1F4CD}',
    title: '17地域対応',
    desc: '北海道から沖縄まで全国17地域をカバー。地元の話題をチェック。',
  },
  {
    icon: '\u{1F4D6}',
    title: '既読・履歴管理',
    desc: '閲覧履歴の自動保存と既読管理。前回の続きからすぐ再開。',
  },
]

function useHashRoute() {
  const [path, setPath] = useState(window.location.hash.slice(1) || '/')

  useEffect(() => {
    const onHashChange = () => {
      const next = window.location.hash.slice(1) || '/'
      setPath(next)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return path
}

function Landing() {
  return (
    <>
      {/* ===== Hero ===== */}
      <section className="hero">
        <img src={iconImg} alt="BakuSoku" className="hero-icon" />
        <h1>
          <span className="accent">Baku</span>Soku
        </h1>
        <p className="tagline">
          爆サイ.com をもっと快適に。
          <br />
          広告なし・ダークモード対応の非公式ブラウザアプリ。
        </p>
        <div className="hero-badges">
          <img src={badgeAppStore} alt="App Storeからダウンロード" className="store-badge" />
          <a href="https://play.google.com/store/apps/details?id=net.votepurchase.bakusoku" target="_blank" rel="noopener noreferrer">
            <img src={badgeGooglePlay} alt="Google Playで手に入れよう" className="store-badge active" />
          </a>
        </div>
        <div className="pill-features">
          <span className="pill">
            <span className="pill-icon">{'\u{1F6AB}'}</span> 広告なし
          </span>
          <span className="pill">
            <span className="pill-icon">{'\u{1F319}'}</span> ダークモード
          </span>
          <span className="pill">
            <span className="pill-icon">{'\u26A1'}</span> 爆速表示
          </span>
          <span className="pill">
            <span className="pill-icon">{'\u{1F6E1}\uFE0F'}</span> NGワード
          </span>
          <span className="pill">
            <span className="pill-icon">{'\u2B50'}</span> お気に入り
          </span>
        </div>
      </section>

      {/* ===== Screenshots ===== */}
      <section className="screenshots">
        <h2>スクリーンショット</h2>
        <p className="section-sub">実際のアプリ画面をご覧ください</p>
        <div className="screenshot-grid">
          {screenshots.map((s, i) => (
            <div className="screenshot-card" key={i}>
              <img src={s.src} alt={s.caption} loading="lazy" />
              <p className="caption">{s.caption}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Features ===== */}
      <section className="features">
        <h2>主な機能</h2>
        <div className="features-grid">
          {features.map((f, i) => (
            <div className="feature-card" key={i}>
              <span className="feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="cta" id="download">
        <h2>今すぐダウンロード</h2>
        <p>爆サイ.com をストレスなく楽しもう。</p>
        <div className="hero-badges">
          <img src={badgeAppStore} alt="App Storeからダウンロード" className="store-badge" />
          <a href="https://play.google.com/store/apps/details?id=net.votepurchase.bakusoku" target="_blank" rel="noopener noreferrer">
            <img src={badgeGooglePlay} alt="Google Playで手に入れよう" className="store-badge active" />
          </a>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="footer">
        <p>
          <a href="#/privacy">プライバシーポリシー</a>
          {' / '}
          <a href="#/terms">利用規約</a>
          {' / '}
          <a href="#/support">サポート</a>
        </p>
        <p>
          BakuSoku は爆サイ.com の非公式アプリです。爆サイ.com
          とは一切関係ありません。
        </p>
      </footer>
    </>
  )
}

function App() {
  const path = useHashRoute()

  if (path === '/privacy') return <Privacy />
  if (path === '/terms') return <Terms />
  if (path === '/support') return <Support />
  return <Landing />
}

export default App
