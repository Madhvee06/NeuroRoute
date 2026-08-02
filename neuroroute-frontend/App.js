import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';

// ---------------------------------------------------------------
// NeuroRoute — Root entry point
// SafeAreaProvider MUST wrap the app for useSafeAreaInsets to
// work inside any screen — this is what fixes the status bar
// overlap issue you saw on WelcomeScreen/LoginScreen/SignupScreen.
// ---------------------------------------------------------------

export default function App() {
  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}