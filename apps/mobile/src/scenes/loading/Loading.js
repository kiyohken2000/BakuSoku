import React, { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { authenticate } from 'slices/app.slice'
import { ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { initBakusai } from 'lib/bakusai'

export default function Loading() {
  const dispatch = useDispatch()

  useEffect(() => {
    initBakusai().then(() => {
      dispatch(authenticate({ checked: true }))
    })
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator size="large" color="#f97316" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
})