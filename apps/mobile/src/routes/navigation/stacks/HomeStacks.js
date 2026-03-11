import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import BoardList from '../../../scenes/boardList/BoardList'
import ThreadList from '../../../scenes/threadList/ThreadList'
import ThreadDetail from '../../../scenes/threadDetail/ThreadDetail'

const Stack = createStackNavigator()

export const HomeStacks = () => {
  return (
    <Stack.Navigator
      initialRouteName="BoardList"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="BoardList" component={BoardList} />
      <Stack.Screen name="ThreadList" component={ThreadList} />
      <Stack.Screen name="ThreadDetail" component={ThreadDetail} />
    </Stack.Navigator>
  )
}