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
// Same backend contract as before:
//   POST /api/routes/plan
//   body: { source, destination, profile, preferences }
//   response: { recommendedRoute, alternativeRoutes, explanation,
//               nearbyQuietPlaces, journeyId }
//
// Map layer changed: react-native-maps (Google Maps) -> WebView
// running Leaflet.js against real OpenStreetMap tiles. No API key,
// no native map SDK — matches the rest of the OSM stack already
// used on the backend (Nominatim, Overpass, OSRM).
//
// Because a WebView's HTML only loads once, route selection after
// the initial load is handled by calling a JS function already
// defined inside the page (`selectRoute`) via injectJavaScript,
// rather than re-rendering native map components.
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

// OSRM/GeoJSON gives coordinates as [lng, lat]. Leaflet wants [lat, lng].
function toLatLngs(geometry) {
  if (!geometry?.coordinates) return [];
  return geometry.coordinates.map(([lng, lat]) => [lat, lng]);
}

// Builds the full HTML page loaded into the WebView, once, on first
// render. Route geometries + colors are baked in at build time;
// which route is "selected" afterwards is controlled at runtime via
// injectJavaScript calling window.selectRoute(id).
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
    html, body, #map { height: 100%; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const routesData = ${JSON.stringify(routesData)};
    const map = L.map('map', { zoomControl: false });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Draw every route, dim by default; keep references so we can
    // restyle the selected one later without redrawing everything.
    const lines = {};
    routesData.forEach((r) => {
      lines[r.id] = L.polyline(r.coords, { color: r.color, weight: 3, opacity: 0.55 }).addTo(map);
    });

    let startMarker = null;
    let endMarker = null;

    // Called from React Native via injectJavaScript whenever the
    // user taps a different route card.
    window.selectRoute = function (id) {
      Object.keys(lines).forEach((key) => {
        const isSelected = String(key) === String(id);
        lines[key].setStyle({ weight: isSelected ? 6 : 3, opacity: isSelected ? 1 : 0.45 });
        if (isSelected) lines[key].bringToFront();
      });

      const selected = routesData.find((r) => String(r.id) === String(id));
      if (!selected || selected.coords.length === 0) return;

      if (startMarker) map.removeLayer(startMarker);
      if (endMarker) map.removeLayer(endMarker);
      startMarker = L.marker(selected.coords[0]).addTo(map).bindPopup('Start');
      endMarker = L.marker(selected.coords[selected.coords.length - 1])
        .addTo(map)
        .bindPopup('Destination');

      map.fitBounds(lines[id].getBounds(), { padding: [60, 60] });
    };

    // Select the first route (recommended) as soon as the page loads
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

  // Map HTML only needs to be rebuilt when the route list itself
  // changes (i.e. after a fresh fetch) — NOT on every selection tap.
  const mapHtml = useMemo(() => (routes.length > 0 ? buildMapHtml(routes) : null), [routes]);

  // Tell the already-loaded map which route to highlight, without
  // reloading the whole WebView.
  useEffect(() => {
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
            {mapHtml && (
              <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: mapHtml }}
                style={styles.map}
              />
            )}
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
                      <Text style={styles.metaText}>{durationMin} min</Text>
                      <Text style={styles.metaDot}>·</Text>
                      <Text style={styles.metaText}>{distanceKm} km</Text>
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