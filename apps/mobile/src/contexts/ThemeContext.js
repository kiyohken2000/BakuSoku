import React, { createContext, useContext, useState, useEffect } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const ThemeContext = createContext()

const lightTheme = {
  bg: '#ffffff',
  surface: '#f3f4f6',
  surfaceAlt: '#e5e7eb',
  border: '#e5e7eb',
  text: '#111827',
  subText: '#6b7280',
  accent: '#f97316',
  tabBar: '#ffffff',
  tabBarBorder: '#e5e7eb',
  header: '#f97316',
  headerText: '#ffffff',
  good: '#22c55e',
  bad: '#ef4444',
  inputBg: '#f9fafb',
  inputBorder: '#d1d5db',
}

const darkTheme = {
  bg: '#111827',
  surface: '#1f2937',
  surfaceAlt: '#374151',
  border: '#374151',
  text: '#f9fafb',
  subText: '#9ca3af',
  accent: '#f97316',
  tabBar: '#1f2937',
  tabBarBorder: '#374151',
  header: '#1f2937',
  headerText: '#f97316',
  good: '#22c55e',
  bad: '#ef4444',
  inputBg: '#374151',
  inputBorder: '#4b5563',
}

export const ThemeContextProvider = ({ children }) => {
  const systemScheme = useColorScheme()
  const [isDark, setIsDark] = useState(systemScheme === 'dark')

  useEffect(() => {
    AsyncStorage.getItem('@bakusai_theme')
      .then((v) => {
        if (v === 'dark') setIsDark(true)
        else if (v === 'light') setIsDark(false)
      })
      .catch(() => {})
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    AsyncStorage.setItem('@bakusai_theme', next ? 'dark' : 'light').catch(() => {})
  }

  const theme = isDark ? darkTheme : lightTheme

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
