import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../theme';
import styles from './HomeScreen.styles';
import { API_URL } from '../config/api';

// Bandra Reclamation area, Mumbai — used as a stand-in "current location"
// until the app requests real GPS coordinates with expo-location.
const FALLBACK_LAT = 19.045;
const FALLBACK_LNG = 72.8258;

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [userName, setUserName] = useState('there');
  const [userProfile, setUserProfile] = useState('General User');

  const [places, setPlaces] = useState([]);
  const [placesLoading, setPlacesLoading] = useState(true);

  // Load the logged-in user's name/profile every time this screen is focused
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const stored = await AsyncStorage.getItem('user');
          if (stored) {
            const user = JSON.parse(stored);
            setUserName(user.name || 'there');
            setUserProfile(user.profile || 'General User');
          }
        } catch (err) {
          console.warn('Could not load stored user:', err.message);
        }
      })();
    }, [])
  );

  // Fetch nearby quiet places from the backend on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/places/nearby?lat=${FALLBACK_LAT}&lng=${FALLBACK_LNG}`
        );
        const data = await res.json();
        if (res.ok) {
          setPlaces(data.places || []);
        }
      } catch (err) {
        console.warn('Could not load nearby places:', err.message);
      } finally {
        setPlacesLoading(false);
      }
    })();
  }, []);

  // Navigate to RouteOptionsScreen instead of fetching + showing inline.
  // RouteOptionsScreen owns the actual /api/routes/plan call and map.
  const handleFindRoute = () => {
    if (!destination) return;
    navigation?.navigate('RouteOptions', {
      source: source || `${FALLBACK_LAT},${FALLBACK_LNG}`,
      destination,
      profile: userProfile,
      preferences: { avoidCrowds: true, avoidNoise: true },
    });
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good afternoon,</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          <TouchableOpacity
            style={styles.profileBadge}
            onPress={() => navigation?.navigate('Settings')}
          >
            <Text style={styles.profileBadgeText}>{userName.charAt(0)}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.profileTag}>{userProfile}</Text>

        <View style={styles.comfortCard}>
          <View style={styles.comfortDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.comfortLabel}>Current area comfort</Text>
            <Text style={styles.comfortValue}>Calm — low crowd, low noise</Text>
          </View>
        </View>

        <View style={styles.searchCard}>
          <Text style={styles.searchTitle}>Where would you like to go?</Text>

          <View style={styles.inputRow}>
            <View style={[styles.dot, { backgroundColor: COLORS.primary }]} />
            <TextInput
              style={styles.input}
              placeholder="Current location (leave blank to use default)"
              placeholderTextColor={COLORS.textMuted}
              value={source}
              onChangeText={setSource}
            />
          </View>

          <View style={styles.inputDivider} />

          <View style={styles.inputRow}>
            <View style={[styles.dot, { backgroundColor: COLORS.accent }]} />
            <TextInput
              style={styles.input}
              placeholder="Destination"
              placeholderTextColor={COLORS.textMuted}
              value={destination}
              onChangeText={setDestination}
            />
          </View>

          <TouchableOpacity
            style={[styles.findButton, !destination && styles.findButtonDisabled]}
            onPress={handleFindRoute}
            disabled={!destination}
          >
            <Text style={styles.findButtonText}>Find a comfortable route</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.preferencesRow}
          onPress={() => navigation?.navigate('Preferences')}
        >
          <Text style={styles.preferencesText}>
            Avoiding crowds, noise · Editing preferences
          </Text>
          <Text style={styles.preferencesArrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Nearby quiet places</Text>
        </View>

        {placesLoading && <ActivityIndicator color={COLORS.primary} />}

        {!placesLoading && places.length === 0 && (
          <Text style={styles.placeType}>No quiet places found nearby.</Text>
        )}

        {places.map((place) => (
          <TouchableOpacity key={place.id} style={styles.placeRow}>
            <View style={styles.placeIconWrap}>
              <View style={styles.placeIconDot} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.placeName}>{place.name}</Text>
              <Text style={styles.placeType}>{place.type}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={() => navigation?.navigate('Emergency')}
        >
          <Text style={styles.emergencyText}>Feeling overwhelmed? Get help</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}