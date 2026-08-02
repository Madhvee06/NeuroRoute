import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ProfileSelectionScreen from '../screens/ProfileSelectionScreen';
import PreferencesScreen from '../screens/PreferencesScreen';
import HomeScreen from '../screens/HomeScreen';
import RouteOptionsScreen from '../screens/RouteOptionsScreen';
import SettingsScreen from '../screens/SettingsScreen';

// ---------------------------------------------------------------
// NeuroRoute — App Navigator
// Flow: Welcome -> Login/Signup -> (Signup only) ProfileSelection
//       -> Preferences -> Home
// ---------------------------------------------------------------

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="ProfileSelection" component={ProfileSelectionScreen} />
        <Stack.Screen name="Preferences" component={PreferencesScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="RouteOptions" component={RouteOptionsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        {/* Add RouteDetail here once you build it */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}