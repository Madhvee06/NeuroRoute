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
import * as Location from 'expo-location';
import { COLORS } from '../theme';
import styles from './HomeScreen.styles';
import { API_URL } from '../config/api';

// Bandra Reclamation area, Mumbai — last-resort fallback ONLY if the
// user denies location access or GPS/reverse-geocoding fails outright.
// Real current location (below) is now the primary path.
const FALLBACK_LAT = 19.045;
const FALLBACK_LNG = 72.8258;
const FALLBACK_LABEL = 'Bandra Reclamation, Mumbai (default)';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [userName, setUserName] = useState('there');
  const [userProfile, setUserProfile] = useState('General User');

  const [places, setPlaces] = useState([]);
  const [placesLoading, setPlacesLoading] = useState(true);

  const [locating, setLocating] = useState(false);

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

  // Requests GPS permission, gets the phone's real current coordinates,
  // then reverse-geocodes them into a readable address via Nominatim
  // (free, no API key) so the rest of the app — which expects a plain
  // address STRING for `source` — doesn't need any backend changes.
  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setSource(FALLBACK_LABEL);
        setLocating(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16`,
        {
          headers: {
            // Nominatim's usage policy asks for a descriptive User-Agent;
            // fetch() on React Native may not always honor custom
            // User-Agent, but this is included as a good-faith attempt.
            'User-Agent': 'NeuroRoute-App/1.0',
          },
        }
      );
      const data = await res.json();

      const readableAddress =
        data.display_name ||
        `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

      setSource(readableAddress);
    } catch (err) {
      console.warn('Could not get current location:', err.message);
      setSource(FALLBACK_LABEL);
    } finally {
      setLocating(false);
    }
  };

  const handleFindRoute = () => {
    if (!destination) return;
    navigation?.navigate('RouteOptions', {
      source: source || FALLBACK_LABEL,
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
              placeholder="Tap 'Use current location' or type a starting point"
              placeholderTextColor={COLORS.textMuted}
              value={source}
              onChangeText={setSource}
            />
          </View>

          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginLeft: 20 }}
            onPress={handleUseCurrentLocation}
            disabled={locating}
          >
            {locating ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={{ fontSize: 12, color: COLORS.primary, fontWeight: '600' }}>
                📍 Use current location
              </Text>
            )}
          </TouchableOpacity>

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