import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StatusBar, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../theme';
import styles from './SettingsScreen.styles';

// ---------------------------------------------------------------
// NeuroRoute — Settings Screen
// Reads the logged-in user from AsyncStorage (saved at login/signup
// by LoginScreen.js / SignupScreen.js) and provides Logout, which
// clears the token + user, then resets navigation back to Welcome.
// ---------------------------------------------------------------

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    })();
  }, []);

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');

          // reset() clears the navigation history so the user can't
          // press "Back" from Welcome into a now-logged-out Home screen
          navigation?.reset({
            index: 0,
            routes: [{ name: 'Welcome' }],
          });
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.heroTop }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.heroTop} />

      <View style={[styles.heroBand, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity
          style={[styles.backLink, { top: insets.top + 14 }]}
          onPress={() => navigation?.goBack()}
        >
          <Text style={styles.backLinkText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <View style={styles.lowerBand}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
            <View>
              <Text style={styles.profileName}>{user?.name || 'Guest'}</Text>
              <Text style={styles.profileEmail}>{user?.email || ''}</Text>
              {!!user?.profile && (
                <Text style={styles.profileTag}>{user.profile}</Text>
              )}
            </View>
          </View>

          <Text style={styles.sectionLabel}>Travel</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => navigation?.navigate('Preferences')}
            >
              <Text style={styles.menuLabel}>Sensory Preferences</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuRow, styles.menuRowLast]}
              onPress={() => navigation?.navigate('ProfileSelection')}
            >
              <Text style={styles.menuLabel}>Change Profile Type</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuRow}>
              <Text style={styles.menuLabel}>Edit Profile</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuRow, styles.menuRowLast]}>
              <Text style={styles.menuLabel}>Emergency Contact</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Log out</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>NeuroRoute v1.0.0</Text>
        </ScrollView>
      </View>
    </View>
  );
}