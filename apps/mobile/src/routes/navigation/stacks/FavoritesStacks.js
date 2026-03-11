import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import Favorites from '../../../scenes/favorites/Favorites'
import ThreadList from '../../../scenes/threadList/ThreadList'
import ThreadDetail from '../../../scenes/threadDetail/ThreadDetail'

const Stack = createStackNavigator()

export const FavoritesStacks = () => {
  return (
    <Stack.Navigator
      initialRouteName="Favorites"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Favorites" component={Favorites} />
      <Stack.Screen name="ThreadListFromFavorites" component={ThreadList} />
      <Stack.Screen name="ThreadDetailFromFavorites" component={ThreadDetail} />
      <Stack.Screen name="ThreadDetail" component={ThreadDetail} />
    </Stack.Navigator>
  )
}
