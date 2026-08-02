import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { COLORS } from '../theme';
import styles from './RouteOptionsScreen.styles';
import { API_URL } from '../config/api';

// ---------------------------------------------------------------
// NeuroRoute — Route Options Screen (with map)
// Matches the REAL backend contract from routeController.js:
//   POST /api/routes/plan
//   body: { source, destination, profile, preferences }  <- plain
//         address strings, backend geocodes them server-side
//   response: { recommendedRoute, alternativeRoutes, explanation,
//               nearbyQuietPlaces, journeyId }
// recommendedRoute + alternativeRoutes are combined here into one
// list (recommended always shown first). Only recommendedRoute
// comes with a real explanation from the backend; alternatives get
// a short generated one based on their sensory score.
// ---------------------------------------------------------------

const ROUTE_LINE_COLORS = [COLORS.primary, '#B08968', '#8AA6C1'];

function scoreColor(score) {
  if (score <= 35) return COLORS.primary;
  if (score <= 65) return '#D9A05B';
  return COLORS.error;
}

function fallbackExplanation(score) {
  if (score <= 35) return 'A calmer alternative with a low overall sensory load.';
  if (score <= 65) return 'A moderate option — some sensory factors are higher here.';
  return 'This route has a higher sensory load than the recommended option.';
}

export default function RouteOptionsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const { source, destination, profile, preferences } = route?.params || {};

  const [routes, setRoutes] = useState([]); // combined [recommended, ...alternatives]
  const [topExplanation, setTopExplanation] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoutes = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/routes/plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          source,
          destination,
          profile,
          preferences,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not plan a route');

      const combined = [
        { ...data.recommendedRoute, isRecommended: true },
        ...(data.alternativeRoutes || []).map((r) => ({
          ...r,
          isRecommended: false,
        })),
      ];

      setRoutes(combined);
      setTopExplanation(data.explanation || '');

      if (combined.length > 0) {
        setSelectedId(combined[0].id);
        fitMapToRoute(combined[0]);
      }
    } catch (err) {
      setError(err.message || 'Could not load routes. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  // geometry is GeoJSON ([lng, lat] pairs) from OSRM via osrmService
  const toLatLngs = (geometry) => {
    if (!geometry?.coordinates) return [];
    return geometry.coordinates.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));
  };

  const fitMapToRoute = (routeToFit) => {
    const coords = toLatLngs(routeToFit.geometry);
    if (coords.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 60, bottom: 260, left: 60 },
        animated: true,
      });
    }
  };

  const handleSelectCard = (r) => {
    setSelectedId(r.id);
    fitMapToRoute(r);
  };

  const handleStartRoute = () => {
    const selectedRoute = routes.find((r) => r.id === selectedId);
    navigation?.navigate('RouteDetail', { selectedRoute });
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
        <Text style={styles.headerTitle}>Choose your route</Text>
      </View>

      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Finding your calmest routes…</Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchRoutes}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && (
        <>
          <View style={styles.mapWrap}>
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={{
                latitude: 19.076,
                longitude: 72.8777,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              {routes.map((r, index) => {
                const isSelected = r.id === selectedId;
                return (
                  <Polyline
                    key={r.id}
                    coordinates={toLatLngs(r.geometry)}
                    strokeColor={ROUTE_LINE_COLORS[index % ROUTE_LINE_COLORS.length]}
                    strokeWidth={isSelected ? 6 : 3}
                    zIndex={isSelected ? 2 : 1}
                  />
                );
              })}

              {routes[0] && toLatLngs(routes[0].geometry).length > 0 && (
                <>
                  <Marker
                    coordinate={toLatLngs(routes[0].geometry)[0]}
                    title="Start"
                    pinColor={COLORS.primary}
                  />
                  <Marker
                    coordinate={
                      toLatLngs(routes[0].geometry)[
                        toLatLngs(routes[0].geometry).length - 1
                      ]
                    }
                    title="Destination"
                    pinColor={COLORS.accent}
                  />
                </>
              )}
            </MapView>
          </View>

          <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetSummary}>
                {routes.length} route{routes.length !== 1 ? 's' : ''} found ·
                tap a route to preview it on the map
              </Text>

              {routes.map((r, index) => {
                const isRecommended = r.isRecommended;
                const isSelected = r.id === selectedId;
                const distanceKm = Math.round((r.distanceMeters / 1000) * 10) / 10;
                const durationMin = Math.round(r.durationSeconds / 60);

                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      styles.routeCard,
                      isSelected && styles.routeCardSelected,
                    ]}
                    onPress={() => handleSelectCard(r)}
                  >
                    {isRecommended && (
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedBadgeText}>
                          Recommended
                        </Text>
                      </View>
                    )}

                    <View style={styles.routeTopRow}>
                      <View style={styles.routeNameRow}>
                        <View
                          style={[
                            styles.routeColorDot,
                            {
                              backgroundColor:
                                ROUTE_LINE_COLORS[index % ROUTE_LINE_COLORS.length],
                            },
                          ]}
                        />
                        <Text style={styles.routeName}>
                          Route {String.fromCharCode(65 + index)}
                        </Text>
                      </View>
                      <View>
                        <Text
                          style={[
                            styles.scoreValue,
                            { color: scoreColor(r.sensoryScore) },
                          ]}
                        >
                          {r.sensoryScore}
                        </Text>
                        <Text style={styles.scoreLabel}>sensory score</Text>
                      </View>
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={styles.metaText}>{durationMin} min</Text>
                      <Text style={styles.metaDot}>·</Text>
                      <Text style={styles.metaText}>{distanceKm} km</Text>
                    </View>

                    <Text style={styles.explanationText}>
                      {isRecommended
                        ? topExplanation
                        : fallbackExplanation(r.sensoryScore)}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.startButton}
                onPress={handleStartRoute}
                disabled={!selectedId}
              >
                <Text style={styles.startButtonText}>Start this route</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
}