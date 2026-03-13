import React from 'react'
import { useSelector } from 'react-redux'
import Main from './navigation'
import Loading from '../scenes/loading/Loading'
import AppEula from '../scenes/appEula/AppEula'
import { useSettings } from '../contexts/SettingsContext'

export default function Routes() {
  const { checked } = useSelector((state) => state.app)
  const { appEulaAccepted, isSettingsLoaded } = useSettings()

  if (!checked || !isSettingsLoaded) {
    return <Loading />
  }

  if (!appEulaAccepted) {
    return <AppEula />
  }

  return <Main />
}
