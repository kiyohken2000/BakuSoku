import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import Search from '../../../scenes/search/Search'
import ThreadDetail from '../../../scenes/threadDetail/ThreadDetail'

const Stack = createStackNavigator()

export const SearchStacks = () => {
  return (
    <Stack.Navigator
      initialRouteName="Search"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Search" component={Search} />
      <Stack.Screen name="ThreadDetailFromSearch" component={ThreadDetail} />
    </Stack.Navigator>
  )
}
