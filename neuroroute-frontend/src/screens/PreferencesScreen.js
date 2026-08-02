import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../theme';
import styles from './PreferencesScreen.styles';
import { API_URL } from '../config/api';

// ---------------------------------------------------------------
// NeuroRoute — Preferences Setup Screen
// Shown right after Profile Selection. Toggles map directly to
// the sensory-factor weights (W1..W6) in the synopsis's formula.
// ---------------------------------------------------------------

const PREFERENCES = [
  {
    id: 'avoidCrowds',
    label: 'Avoid Crowded Areas',
    description: 'Route around busy streets, markets, and events',
  },
  {
    id: 'avoidNoise',
    label: 'Avoid Noisy Roads',
    description: 'Prefer quieter streets over high-traffic roads',
  },
  {
    id: 'avoidBrightLights',
    label: 'Avoid Bright Lights',
    description: 'Steer clear of glaring signage and floodlit areas',
  },
  {
    id: 'avoidConstruction',
    label: 'Avoid Construction Zones',
    description: 'Skip active construction and roadwork',
  },
  {
    id: 'preferParks',
    label: 'Prefer Parks',
    description: 'Favor routes passing through green, open spaces',
  },
  {
    id: 'preferSafeRoutes',
    label: 'Prefer Safe Routes',
    description: 'Prioritize well-lit, well-traveled paths',
  },
];

export default function PreferencesScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [prefs, setPrefs] = useState({
    avoidCrowds: true,
    avoidNoise: true,
    avoidBrightLights: false,
    avoidConstruction: true,
    preferParks: false,
    preferSafeRoutes: true,
  });

  const togglePref = (id) => {
    setPrefs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const savePreferences = async (onDone) => {
    setError('');
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(prefs),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Could not save preferences');
        setLoading(false);
        return;
      }

      setLoading(false);
      onDone();
    } catch (err) {
      setLoading(false);
      setError('Could not reach the server. Check your API_URL and Wi-Fi connection.');
    }
  };

  const handleContinue = () => {
    savePreferences(() => navigation?.navigate('Home'));
  };

  const handleSkip = () => {
    // Skipping still just goes to Home without saving changes
    navigation?.navigate('Home');
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
        <View style={styles.logoCircleSmall}>
          <View style={styles.logoMarkSmall} />
        </View>
      </View>

      <View style={styles.lowerBand}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.title}>Set your travel preferences</Text>
            <Text style={styles.subtitle}>
              You can always change these later in Settings
            </Text>

            <View style={styles.toggleList}>
              {PREFERENCES.map((pref) => (
                <View key={pref.id} style={styles.toggleRow}>
                  <View style={styles.toggleTextWrap}>
                    <Text style={styles.toggleLabel}>{pref.label}</Text>
                    <Text style={styles.toggleDescription}>
                      {pref.description}
                    </Text>
                  </View>
                  <Switch
                    value={prefs[pref.id]}
                    onValueChange={() => togglePref(pref.id)}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor={COLORS.border}
                  />
                </View>
              ))}
            </View>

            {!!error && <Text style={{ color: COLORS.error, fontSize: 12, marginTop: 10 }}>{error}</Text>}

            <View style={styles.spacer} />

            <TouchableOpacity style={styles.primaryButton} onPress={handleContinue} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Continue</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipLink} onPress={handleSkip} disabled={loading}>
              <Text style={styles.skipLinkText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}