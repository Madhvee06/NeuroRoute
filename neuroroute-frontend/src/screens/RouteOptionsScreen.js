// RouteOptionsScreen.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { WebView } from 'react-native-webview';
import { COLORS } from '../theme';
import styles from './RouteOptionsScreen.styles';
import { API_URL } from '../config/api';

// ---------------------------------------------------------------
// NeuroRoute — Route Options Screen (pure OpenStreetMap via Leaflet)
//
// Backend contract:
//   POST /api/routes/plan
//   body: { source, destination, profile, preferences }
//   response: { recommendedRoute, alternativeRoutes, explanation,
//               nearbyQuietPlaces, journeyId }
//   Each route includes BOTH durationSecondsDriving and
//   durationSecondsWalking, so switching modes on this screen is
//   instant — no refetch required. Each route also now includes
//   `steps` (turn-by-turn), used by NavigationScreen.
//
// FIX: route `id` values from the backend start at 0
// (assigned as array index before sorting by score), so the very
// first/recommended route can legitimately have id === 0. Any check
// like `!selectedId` or `disabled={!selectedId}` treats 0 as falsy
// and silently breaks. Every such check below explicitly compares
// against null/undefined instead.
//
// UPDATED (map legibility pass):
//  1. CAUTION: mapWrap/map in RouteOptionsScreen.styles.js are both
//     flex:1. This already caused a blank grey box once (Leaflet's
//     tile layer never fires because Android measures a flex:1
//     WebView as zero-size). If that resurfaces, the fix already
//     applied elsewhere in this project is to measure mapWrap via
//     onLayout and pass explicit pixel {width,height} to the
//     WebView's style instead of flex.
//  2. The basemap is a low-noise CARTO "light" OSM style rather
//     than the default osm.org raster. Same OpenStreetMap data,
//     far fewer competing labels and POI icons behind the route
//     lines. NavigationScreen goes one step further and uses the
//     label-free variant plus blur.
//  3. `nearbyQuietPlaces` are now drawn on the preview map as soft
//     green dots (this was the only thing the old standalone
//     MapScreen.js did that this screen didn't — MapScreen is now
//     redundant and can be deleted).
// ---------------------------------------------------------------

const ROUTE_LINE_COLORS = [COLORS.primary, '#B08968', '#8AA6C1'];

// Low-noise OSM basemap. Keep labels here (this is a planning
// screen — the user needs street names to recognise the area).
const TILE_URL =
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; OpenStreetMap contributors &copy; CARTO';

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

// ---------------------------------------------------------------
// Backend explanation can be either:
//   1. A string:  "This is the calmest route."
//   2. An object: { type, text, extras }
// React Native <Text> cannot render an object directly, so we
// extract the `text` property.
// ---------------------------------------------------------------
function getExplanationText(explanation) {
  if (typeof explanation === 'string') {
    return explanation;
  }

  if (explanation && typeof explanation === 'object') {
    return explanation.text || '';
  }

  return '';
}

// Driving durations stay in minutes (usually short). Walking durations
// can run into hours for longer distances, so format those as h/m.
function formatDuration(seconds, mode) {
  const totalMinutes = Math.round(seconds / 60);

  if (mode === 'walking' && totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${totalMinutes} min`;
}

// OSRM/GeoJSON gives coordinates as [lng, lat]. Leaflet wants [lat, lng].
function toLatLngs(geometry) {
  if (!geometry?.coordinates) return [];
  return geometry.coordinates.map(([lng, lat]) => [lat, lng]);
}

function buildMapHtml(routes, quietPlaces) {
  const routesData = routes.map((r, index) => ({
    id: r.id,
    coords: toLatLngs(r.geometry),
    color: ROUTE_LINE_COLORS[index % ROUTE_LINE_COLORS.length],
  }));

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />

  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

  <style>
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: ${COLORS.background};
    }

    #map {
      width: 100vw;
      height: 100vh;
    }

    .leaflet-control-attribution {
      font-size: 9px;
      background: rgba(255, 255, 255, 0.55);
      color: ${COLORS.textMuted};
    }
  </style>
</head>

<body>
  <div id="map"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <script>
    const routesData = ${JSON.stringify(routesData)};
    const quietPlaces = ${JSON.stringify(quietPlaces || [])};

    const map = L.map('map', { zoomControl: false });
    window.map = map;

    map.setView([20.5937, 78.9629], 5);

    setTimeout(() => { map.invalidateSize(); }, 300);

    L.tileLayer('${TILE_URL}', {
      attribution: '${TILE_ATTR}',
      maxZoom: 19,
    }).addTo(map);

    const lines = {};

    routesData.forEach((r) => {
      if (r.coords.length === 0) {
        console.log('Route has no coordinates, skipping draw:', r.id);
        return;
      }

      lines[r.id] = L.polyline(r.coords, {
        color: r.color,
        weight: 3,
        opacity: 0.55,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(map);
    });

    // Nearby quiet places — soft, low-contrast dots so they read as
    // supporting information rather than competing with the routes.
    quietPlaces.forEach((p) => {
      if (p.lat == null || p.lng == null) return;

      L.circleMarker([p.lat, p.lng], {
        radius: 6,
        color: '#5C9367',
        weight: 2,
        fillColor: '#8FBF99',
        fillOpacity: 0.75
      })
        .addTo(map)
        .bindPopup((p.name || 'Quiet place') + (p.type ? ' — ' + p.type : ''));
    });

    let startMarker = null;
    let endMarker = null;

    window.selectRoute = function (id) {
      Object.keys(lines).forEach((key) => {
        const isSelected = String(key) === String(id);

        lines[key].setStyle({
          weight: isSelected ? 6 : 3,
          opacity: isSelected ? 1 : 0.35
        });

        if (isSelected) {
          lines[key].bringToFront();
        }
      });

      const selected = routesData.find((r) => String(r.id) === String(id));

      if (!selected || selected.coords.length === 0 || !lines[id]) {
        console.log('No coordinates available for route', id);
        return;
      }

      if (startMarker) map.removeLayer(startMarker);
      if (endMarker) map.removeLayer(endMarker);

      startMarker = L.marker(selected.coords[0]).addTo(map).bindPopup('Start');

      endMarker = L.marker(selected.coords[selected.coords.length - 1])
        .addTo(map)
        .bindPopup('Destination');

      map.fitBounds(lines[id].getBounds(), { padding: [60, 60] });

      setTimeout(() => { map.invalidateSize(); }, 100);
    };

    if (routesData.length > 0) {
      window.selectRoute(routesData[0].id);
    }
  </script>
</body>
</html>
`;
}

export default function RouteOptionsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);

  const { source, destination, profile, preferences } = route?.params || {};

  const [routes, setRoutes] = useState([]);
  const [quietPlaces, setQuietPlaces] = useState([]);
  const [topExplanation, setTopExplanation] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trafficInfo, setTrafficInfo] = useState(null);

  // Display-only toggle. Both durations already come back in one response.
  const [travelMode, setTravelMode] = useState('driving');

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
        body: JSON.stringify({ source, destination, profile, preferences }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Could not plan a route');
      }

      const combined = [
        { ...data.recommendedRoute, isRecommended: true },
        ...(data.alternativeRoutes || []).map((r) => ({
          ...r,
          isRecommended: false,
        })),
      ];

      setRoutes(combined);
      setQuietPlaces(data.nearbyQuietPlaces || []);
      setTopExplanation(getExplanationText(data.explanation));

      if (combined.length > 0) {
        setSelectedId(combined[0].id);
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

  useEffect(() => {
    if (routes.length === 0) return;

    const recommended = routes[0];
    const firstPoint = recommended.geometry?.coordinates?.[0];
    if (!firstPoint) return;

    const [lng, lat] = firstPoint;

    fetch(`${API_URL}/api/traffic?lat=${lat}&lng=${lng}`)
      .then((res) => res.json())
      .then((data) => setTrafficInfo(data))
      .catch((err) => console.log('Traffic fetch failed:', err.message));
  }, [routes]);

  const mapHtml = useMemo(
    () => (routes.length > 0 ? buildMapHtml(routes, quietPlaces) : null),
    [routes, quietPlaces]
  );

  useEffect(() => {
    // Explicit null check so route ID 0 works correctly.
    if (selectedId != null && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `window.selectRoute(${JSON.stringify(selectedId)}); true;`
      );
    }
  }, [selectedId]);

  const handleSelectCard = (r) => {
    setSelectedId(r.id);
  };

  const handleStartRoute = () => {
    const selectedRoute = routes.find((r) => r.id === selectedId);
    if (!selectedRoute) return;

    navigation?.navigate('Navigation', {
      selectedRoute,
      travelMode,
      destination,
      profile,
      // Passed through so NavigationScreen can read blurSurroundings
      // and set its initial focus mode without a second fetch.
      preferences,
    });
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
            {mapHtml && (
              <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                mixedContentMode="always"
                source={{ html: mapHtml }}
                style={styles.map}
                onLoadEnd={() => {
                  webViewRef.current?.injectJavaScript(`
                    setTimeout(() => {
                      if (window.map) { window.map.invalidateSize(); }
                    }, 300);
                    true;
                  `);
                }}
              />
            )}
          </View>

          <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.sheetHandle} />

            {/* Drive / Walk toggle */}
            <View style={styles.modeToggleRow}>
              <TouchableOpacity
                style={[
                  styles.modeToggleButton,
                  travelMode === 'driving' && styles.modeToggleButtonActive,
                ]}
                onPress={() => setTravelMode('driving')}
              >
                <Text
                  style={[
                    styles.modeToggleText,
                    travelMode === 'driving' && styles.modeToggleTextActive,
                  ]}
                >
                  Drive
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeToggleButton,
                  travelMode === 'walking' && styles.modeToggleButtonActive,
                ]}
                onPress={() => setTravelMode('walking')}
              >
                <Text
                  style={[
                    styles.modeToggleText,
                    travelMode === 'walking' && styles.modeToggleTextActive,
                  ]}
                >
                  Walk
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetSummary}>
                {routes.length} route{routes.length !== 1 ? 's' : ''} found · tap
                a route to preview it on the map
              </Text>

              {trafficInfo && (
                <Text style={[styles.metaText, { marginBottom: 12 }]}>
                  Live traffic near start:{' '}
                  {Math.round(trafficInfo.congestion * 100)}% congested
                </Text>
              )}

              {routes.map((r, index) => {
                const isRecommended = r.isRecommended;
                const isSelected = r.id === selectedId;

                const distanceKm =
                  Math.round((r.distanceMeters / 1000) * 10) / 10;

                const durationSeconds =
                  travelMode === 'walking'
                    ? r.durationSecondsWalking
                    : r.durationSecondsDriving;

                const durationLabel = formatDuration(
                  durationSeconds,
                  travelMode
                );

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
                                ROUTE_LINE_COLORS[
                                  index % ROUTE_LINE_COLORS.length
                                ],
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
                      <Text style={styles.metaText}>{durationLabel}</Text>
                      <Text style={styles.metaDot}>·</Text>
                      <Text style={styles.metaText}>{distanceKm} km</Text>
                      <Text style={styles.metaDot}>·</Text>
                      <Text style={styles.metaText}>
                        {travelMode === 'walking' ? 'walking' : 'driving'}
                      </Text>
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
                disabled={selectedId == null}
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