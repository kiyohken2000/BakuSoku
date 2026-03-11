import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import FontIcon from 'react-native-vector-icons/FontAwesome'
import { useTheme } from 'contexts/ThemeContext'
import { HomeStacks } from '../stacks/HomeStacks'
import { SearchStacks } from '../stacks/SearchStacks'
import { SettingsStacks } from '../stacks/SettingsStacks'

const Tab = createBottomTabNavigator()

export default function TabNavigator() {
  const { theme } = useTheme()

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.subText,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: 1,
        },
      }}
      initialRouteName="HomeTab"
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStacks}
        options={{
          tabBarLabel: '掲示板',
          tabBarIcon: ({ color, size }) => (
            <FontIcon name="th-list" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchStacks}
        options={{
          tabBarLabel: '検索',
          tabBarIcon: ({ color, size }) => (
            <FontIcon name="search" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStacks}
        options={{
          tabBarLabel: '設定',
          tabBarIcon: ({ color, size }) => (
            <FontIcon name="cog" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  )
}
