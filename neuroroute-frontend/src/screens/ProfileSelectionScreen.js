import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StatusBar, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../theme';
import styles from './ProfileSelectionScreen.styles';
import { API_URL } from '../config/api';

// ---------------------------------------------------------------
// NeuroRoute — Profile Selection Screen
// Shown right after signup. User picks the profile that drives
// the sensory-scoring weights (section 7a of the synopsis).
// ---------------------------------------------------------------

const PROFILES = [
  {
    id: 'autistic',
    label: 'Autistic User',
    description: 'Prioritize avoiding crowds, noise, and bright lights',
  },
  {
    id: 'elderly',
    label: 'Elderly User',
    description: 'Prioritize safer roads and accessible routes',
  },
  {
    id: 'general',
    label: 'General User',
    description: 'Balance comfort with travel efficiency',
  },
];

// Maps the screen's short ids to the exact strings your backend/User model expects
const PROFILE_LABELS = {
  autistic: 'Autistic User',
  elderly: 'Elderly User',
  general: 'General User',
};

export default function ProfileSelectionScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    if (!selected) return;
    setError('');
    setLoading(true);

    const profileLabel = PROFILE_LABELS[selected];

    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ profile: profileLabel }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Could not save your profile');
        setLoading(false);
        return;
      }

      // Keep the locally stored user in sync
      await AsyncStorage.setItem('user', JSON.stringify(data));

      setLoading(false);
      navigation?.navigate('Preferences', { profile: profileLabel });
    } catch (err) {
      setLoading(false);
      setError('Could not reach the server. Check your API_URL and Wi-Fi connection.');
    }
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
            <Text style={styles.title}>Which best describes you?</Text>
            <Text style={styles.subtitle}>
              This helps us tailor routes to what matters most for you
            </Text>

            <View style={styles.optionsList}>
              {PROFILES.map((profile) => {
                const isSelected = selected === profile.id;
                return (
                  <TouchableOpacity
                    key={profile.id}
                    style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                    onPress={() => setSelected(profile.id)}
                  >
                    <View
                      style={[
                        styles.optionIconWrap,
                        isSelected && styles.optionIconWrapSelected,
                      ]}
                    >
                      <View
                        style={[
                          styles.optionIconDot,
                          isSelected && styles.optionIconDotSelected,
                        ]}
                      />
                    </View>

                    <View style={styles.optionTextWrap}>
                      <Text style={styles.optionLabel}>{profile.label}</Text>
                      <Text style={styles.optionDescription}>
                        {profile.description}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && styles.radioOuterSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {!!error && <Text style={{ color: COLORS.error, fontSize: 12, marginTop: 10 }}>{error}</Text>}

            <View style={styles.spacer} />

            <TouchableOpacity
              style={[styles.primaryButton, !selected && styles.primaryButtonDisabled]}
              onPress={handleContinue}
              disabled={!selected || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}