import React, { useState, useEffect } from 'react'
import { View } from 'react-native'
import { Provider } from 'react-redux'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import store from 'utils/store'
import 'utils/ignore'
import { ThemeContextProvider } from './contexts/ThemeContext'
import { SettingsContextProvider } from './contexts/SettingsContext'
import { imageAssets } from 'theme/images'
import { fontAssets } from 'theme/fonts'
import Router from './routes'

export default function App() {
  const [didLoad, setDidLoad] = useState(false)

  useEffect(() => {
    Promise.all([...imageAssets, ...fontAssets])
      .catch(() => {})
      .then(() => setDidLoad(true))
  }, [])

  if (!didLoad) return <View />

  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <ThemeContextProvider>
          <SettingsContextProvider>
            <Router />
          </SettingsContextProvider>
        </ThemeContextProvider>
      </Provider>
    </SafeAreaProvider>
  )
}

