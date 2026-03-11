import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import Settings from '../../../scenes/settings/Settings'
import NgWords from '../../../scenes/ngWords/NgWords'

const Stack = createStackNavigator()

export const SettingsStacks = () => {
  return (
    <Stack.Navigator
      initialRouteName="Settings"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Settings" component={Settings} />
      <Stack.Screen name="NgWords" component={NgWords} />
    </Stack.Navigator>
  )
}
