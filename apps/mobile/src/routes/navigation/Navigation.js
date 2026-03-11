import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import RootStack from './rootStack/RootStack'
import Toast from 'react-native-toast-message'

export default function Navigation() {
  return (
    <>
      <NavigationContainer>
        <RootStack />
      </NavigationContainer>
      <Toast />
    </>
  )
}
