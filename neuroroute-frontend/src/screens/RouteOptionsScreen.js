//routeOptionsscreen.js
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
// FIX (this version): route `id` values from the backend start at 0
// (assigned as array index before sorting by score), so the very
// first/recommended route can legitimately have id === 0. Any check
// like `!selectedId` or `disabled={!selectedId}` treats 0 as falsy
// and silently breaks — e.g. the "Start this route" button looked
// like it did nothing when the selected route's id was 0. Every such
// check below now explicitly compares against null/undefined instead.
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

function buildMapHtml(routes) {
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
    html,
body{
    width:100%;
    height:100%;
    margin:0;
    padding:0;
    overflow:hidden;
}

#map{
    width:100vw;
    height:100vh;
}
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const routesData = ${JSON.stringify(routesData)};
  const map = L.map('map', { zoomControl: false });
  window.map = map;

  map.setView([20.5937, 78.9629], 5); // safe fallback (India-wide view)

setTimeout(() => {
    map.invalidateSize();
}, 300);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19,
}).addTo(map);

    const lines = {};
    routesData.forEach((r) => {
      if (r.coords.length === 0) {
        console.log('Route has no coordinates, skipping draw:', r.id);
        return;
      }
      lines[r.id] = L.polyline(r.coords, { color: r.color, weight: 3, opacity: 0.55 }).addTo(map);
      console.log("coords", r.coords);
    });

    let startMarker = null;
    let endMarker = null;

    window.selectRoute = function (id) {
      Object.keys(lines).forEach((key) => {
        const isSelected = String(key) === String(id);
        lines[key].setStyle({ weight: isSelected ? 6 : 3, opacity: isSelected ? 1 : 0.45 });
        if (isSelected) lines[key].bringToFront();
      });

      const selected = routesData.find((r) => String(r.id) === String(id));
      if (!selected || selected.coords.length === 0 || !lines[id]) {
        console.log('No coordinates available for route', id, '- map stays at fallback view');
        return;
      }

      if (startMarker) map.removeLayer(startMarker);
      if (endMarker) map.removeLayer(endMarker);
      startMarker = L.marker(selected.coords[0]).addTo(map).bindPopup('Start');
      endMarker = L.marker(selected.coords[selected.coords.length - 1])
        .addTo(map)
        .bindPopup('Destination');

      map.fitBounds(lines[id].getBounds(), { padding: [60, 60] });
      setTimeout(() => {
    map.invalidateSize();
}, 100);
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

  const [routes, setRoutes] = useState([]); // combined [recommended, ...alternatives]
  const [topExplanation, setTopExplanation] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trafficInfo, setTrafficInfo] = useState(null); // NEW — live traffic near the recommended route
  
  // Display-only toggle — both durations already come back in one
  // response, so switching this never triggers a refetch.
  const [travelMode, setTravelMode] = useState('driving'); // 'driving' | 'walking'

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
            console.log("ROUTE RESPONSE");
console.log(JSON.stringify(data, null, 2));
      console.log("FULL RESPONSE:", JSON.stringify(data, null, 2));

console.log(
  "Recommended Geometry:",
  JSON.stringify(data.recommendedRoute?.geometry, null, 2)
);

console.log(
  "Coordinates:",
  data.recommendedRoute?.geometry?.coordinates
);
      if (!res.ok) throw new Error(data.error || 'Could not plan a route');

      const combined = [
        { ...data.recommendedRoute, isRecommended: true },
        ...(data.alternativeRoutes || []).map((r) => ({ ...r, isRecommended: false })),
      ];

          setRoutes(combined);
      setTopExplanation(data.explanation || '');
      if (combined.length > 0) setSelectedId(combined[0].id);
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
      const firstPoint = recommended.geometry?.coordinates?.[0]; // [lng, lat]
      if (!firstPoint) return;
  
      const [lng, lat] = firstPoint;
  
      fetch(`${API_URL}/api/traffic?lat=${lat}&lng=${lng}`)
        .then((res) => res.json())
        .then((data) => setTrafficInfo(data))
        .catch((err) => console.log('Traffic fetch failed:', err.message));
    }, [routes]);
  
  const mapHtml = useMemo(() => (routes.length > 0 ? buildMapHtml(routes) : null), [routes]);

  useEffect(() => {
    // Already correct: uses != null, not a truthy check, so id 0 works fine here.
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
    // FIX: was `routes.find((r) => r.id === selectedId)` guarded only by
    // the (buggy) `disabled={!selectedId}` below — if no route is found
    // (shouldn't normally happen once selectedId is set), fail safely
    // with an early return instead of navigating with undefined data.
    const selectedRoute = routes.find((r) => r.id === selectedId);
    if (!selectedRoute) return;
    // destination/profile/preferences are passed through so
    // NavigationScreen can call POST /api/routes/reevaluate during
    // live navigation (the "Agentic AI" monitoring/reroute loop).
    navigation?.navigate('Navigation', {
      selectedRoute,
      travelMode,
      destination,
      profile,
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
                if(window.map){
                    window.map.invalidateSize();
                }
            },300);
            true;
        `);
    }}
/>
            )}
          </View>

          <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.sheetHandle} />

            {/* Drive / Walk toggle — purely local state, both durations
                are already in `routes`, so this never refetches. */}
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
                {routes.length} route{routes.length !== 1 ? 's' : ''} found ·
                tap a route to preview it on the map
              </Text>

              {trafficInfo && (
               <Text style={[styles.metaText, { marginBottom: 12 }]}>
                  Live traffic near start: {Math.round(trafficInfo.congestion * 100)}% congested
                </Text>
             )}

              {routes.map((r, index) => {
                const isRecommended = r.isRecommended;
                const isSelected = r.id === selectedId;
                const distanceKm = Math.round((r.distanceMeters / 1000) * 10) / 10;
                const durationSeconds =
                  travelMode === 'walking' ? r.durationSecondsWalking : r.durationSecondsDriving;
                const durationLabel = formatDuration(durationSeconds, travelMode);

                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.routeCard, isSelected && styles.routeCardSelected]}
                    onPress={() => handleSelectCard(r)}
                  >
                    {isRecommended && (
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedBadgeText}>Recommended</Text>
                      </View>
                    )}

                    <View style={styles.routeTopRow}>
                      <View style={styles.routeNameRow}>
                        <View
                          style={[
                            styles.routeColorDot,
                            { backgroundColor: ROUTE_LINE_COLORS[index % ROUTE_LINE_COLORS.length] },
                          ]}
                        />
                        <Text style={styles.routeName}>
                          Route {String.fromCharCode(65 + index)}
                        </Text>
                      </View>
                      <View>
                        <Text style={[styles.scoreValue, { color: scoreColor(r.sensoryScore) }]}>
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
                      {isRecommended ? topExplanation : fallbackExplanation(r.sensoryScore)}
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