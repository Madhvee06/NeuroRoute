import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../theme';
import styles from './NavigationScreen.styles';
import { API_URL } from '../config/api';

// ---------------------------------------------------------------
// NeuroRoute — Navigation Screen (live GPS turn-by-turn + reroute)
//
// Expects route.params:
//   selectedRoute: { geometry, distanceMeters,
//     durationSecondsDriving, durationSecondsWalking,
//     sensoryScore, steps: [{ label, roadName, distanceMeters,
//     coordinates: [lng, lat] }] }
//   travelMode: 'driving' | 'walking'
//   destination, profile, preferences  <- needed for /reevaluate calls
//
// LIVE REROUTE (Agentic AI loop from the synopsis flowchart):
// Every REEVALUATE_INTERVAL_MS, calls POST /api/routes/reevaluate
// with the user's current position. If the freshly-computed best
// route's sensoryScore is meaningfully lower than the route
// currently being followed, a non-intrusive banner offers to
// switch — never auto-switches, matching the flowchart's
// "Suggest New Route -> Ask user to switch" step.
// ---------------------------------------------------------------

const REEVALUATE_INTERVAL_MS = 45000; // check every 45s
const REROUTE_SCORE_IMPROVEMENT_THRESHOLD = 0.85; // must be <=85% of current score to suggest
const DISMISS_COOLDOWN_MS = 3 * 60 * 1000; // don't re-suggest for 3 min after a dismiss

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDuration(seconds, mode) {
  const totalMinutes = Math.round(seconds / 60);
  if (mode === 'walking' && totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${totalMinutes} min`;
}

function buildMapHtml(routeCoords) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const routeCoords = ${JSON.stringify(routeCoords)};
    const map = L.map('map', { zoomControl: false }).setView(
      routeCoords[0] || [20.5937, 78.9629], 16
    );
    window.map = map;

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    if (routeCoords.length > 0) {
      const line = L.polyline(routeCoords, { color: '${COLORS.primary}', weight: 5, opacity: 0.9 }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [50, 50] });
    }

    let userMarker = null;
    const userIcon = L.divIcon({
      className: '',
      html: '<div style="width:18px;height:18px;border-radius:9px;background:${COLORS.primary};border:3px solid white;box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>',
      iconSize: [18, 18],
    });

    window.updateUserPosition = function (lat, lng, recenter) {
      const latlng = [lat, lng];
      if (userMarker) {
        userMarker.setLatLng(latlng);
      } else {
        userMarker = L.marker(latlng, { icon: userIcon }).addTo(map);
      }
      if (recenter) {
        map.panTo(latlng);
      }
    };

    setTimeout(() => { map.invalidateSize(); }, 300);
  </script>
</body>
</html>
`;
}

export default function NavigationScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);
  const watchSubscription = useRef(null);
  const reevaluateTimer = useRef(null);
  const lastPositionRef = useRef(null); // avoids stale-closure issues in the interval
  const lastDismissedAtRef = useRef(0);
  const reevaluatingRef = useRef(false); // prevents overlapping fetches

  const {
    selectedRoute: initialRoute,
    travelMode = 'driving',
    destination,
    profile,
    preferences,
  } = route?.params || {};

  // The route currently being followed. Starts as whatever was picked
  // on RouteOptionsScreen, but can be replaced if the user accepts a
  // reroute suggestion — everything downstream (map, steps, ETA)
  // reacts to THIS, not the original param, once navigation begins.
  const [activeRoute, setActiveRoute] = useState(initialRoute);
  const steps = activeRoute?.steps || [];

  const initialDurationSeconds =
    travelMode === 'walking'
      ? activeRoute?.durationSecondsWalking
      : activeRoute?.durationSecondsDriving;

  const [permissionDenied, setPermissionDenied] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [remainingMeters, setRemainingMeters] = useState(
    activeRoute?.distanceMeters || 0
  );
  const [remainingSeconds, setRemainingSeconds] = useState(
    initialDurationSeconds || 0
  );
  const [arrived, setArrived] = useState(false);

  // Reroute suggestion state
  const [rerouteSuggestion, setRerouteSuggestion] = useState(null); // the candidate route object, or null

  const routeCoords = useMemo(() => {
    if (!activeRoute?.geometry?.coordinates) return [];
    return activeRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  }, [activeRoute]);

  const mapHtml = useMemo(() => buildMapHtml(routeCoords), [routeCoords]);

  // --- GPS tracking ---
  useEffect(() => {
    let isMounted = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (isMounted) setPermissionDenied(true);
        return;
      }

      watchSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (position) => {
          if (!isMounted) return;
          const { latitude, longitude } = position.coords;
          lastPositionRef.current = { lat: latitude, lng: longitude };
          handlePositionUpdate(latitude, longitude);
        }
      );
    })();

    return () => {
      isMounted = false;
      watchSubscription.current?.remove();
      if (reevaluateTimer.current) clearInterval(reevaluateTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Live re-evaluation loop (Agentic AI monitoring) ---
  useEffect(() => {
    if (!destination) return; // can't reevaluate without a destination string

    reevaluateTimer.current = setInterval(() => {
      checkForBetterRoute();
    }, REEVALUATE_INTERVAL_MS);

    return () => {
      if (reevaluateTimer.current) clearInterval(reevaluateTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, activeRoute]);

  const checkForBetterRoute = async () => {
    if (reevaluatingRef.current) return; // don't overlap requests
    if (arrived) return;
    if (Date.now() - lastDismissedAtRef.current < DISMISS_COOLDOWN_MS) return;
    if (!lastPositionRef.current) return;

    reevaluatingRef.current = true;
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/routes/reevaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          currentLat: lastPositionRef.current.lat,
          currentLng: lastPositionRef.current.lng,
          destination,
          profile,
          preferences,
        }),
      });

      if (!res.ok) return; // fail silently — this is a background check, not user-facing
      const data = await res.json();
      const candidate = data.updatedRoute;
      if (!candidate) return;

      const currentScore = activeRoute?.sensoryScore ?? Infinity;
      const isMeaningfullyBetter =
        candidate.sensoryScore <= currentScore * REROUTE_SCORE_IMPROVEMENT_THRESHOLD;

      if (isMeaningfullyBetter) {
        setRerouteSuggestion(candidate);
      }
    } catch (err) {
      // Silent — background reevaluation shouldn't interrupt navigation
      // with error UI. Logged for debugging only.
      console.warn('Reevaluate check failed:', err.message);
    } finally {
      reevaluatingRef.current = false;
    }
  };

  const handleAcceptReroute = () => {
    if (!rerouteSuggestion) return;
    setActiveRoute(rerouteSuggestion);
    setCurrentStepIndex(0);
    const newDuration =
      travelMode === 'walking'
        ? rerouteSuggestion.durationSecondsWalking
        : rerouteSuggestion.durationSecondsDriving;
    setRemainingSeconds(newDuration || 0);
    setRerouteSuggestion(null);
  };

  const handleDismissReroute = () => {
    lastDismissedAtRef.current = Date.now();
    setRerouteSuggestion(null);
  };

  const handlePositionUpdate = (lat, lng) => {
    webViewRef.current?.injectJavaScript(
      `window.updateUserPosition(${lat}, ${lng}, true); true;`
    );

    if (steps.length > 0) {
      const step = steps[currentStepIndex];
      if (step?.coordinates) {
        const [stepLng, stepLat] = step.coordinates;
        const distToStep = haversineMeters(lat, lng, stepLat, stepLng);
        if (distToStep < 30 && currentStepIndex < steps.length - 1) {
          setCurrentStepIndex((i) => i + 1);
        }
      }
    }

    if (routeCoords.length > 0) {
      const [destLat, destLng] = routeCoords[routeCoords.length - 1];
      const distToDest = haversineMeters(lat, lng, destLat, destLng);
      setRemainingMeters(Math.round(distToDest));

      if (distToDest < 25) {
        setArrived(true);
        watchSubscription.current?.remove();
        if (reevaluateTimer.current) clearInterval(reevaluateTimer.current);
      }
    }
  };

  const handleEndNavigation = () => {
    Alert.alert('End navigation?', 'You can restart this route anytime from Home.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End',
        style: 'destructive',
        onPress: () => {
          watchSubscription.current?.remove();
          if (reevaluateTimer.current) clearInterval(reevaluateTimer.current);
          navigation?.navigate('Home');
        },
      },
    ]);
  };

  if (permissionDenied) {
    return (
      <View style={styles.permissionWrap}>
        <Text style={styles.permissionText}>
          NeuroRoute needs location access to guide you turn-by-turn during
          navigation.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={() => navigation?.goBack()}
        >
          <Text style={styles.permissionButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStep = steps[currentStepIndex];
  const distanceKmRemaining = Math.round((remainingMeters / 1000) * 10) / 10;
  const etaLabel = formatDuration(Math.max(60, remainingSeconds), travelMode);

  // Vertical stacking: reroute banner sits above the turn instruction
  // banner when both are visible, so they don't overlap.
  const turnBannerTop = insets.top + 12 + 52 + (rerouteSuggestion ? 100 : 0);

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          source={{ html: mapHtml }}
          style={styles.map}
        />
      </View>

      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 12 }]}
        onPress={handleEndNavigation}
      >
        <Text style={styles.backButtonText}>‹</Text>
      </TouchableOpacity>

      {rerouteSuggestion && (
        <View style={[styles.rerouteBanner, { top: insets.top + 12 + 52 }]}>
          <Text style={styles.rerouteBannerTitle}>
            Calmer route available
          </Text>
          <Text style={styles.rerouteBannerSubtitle}>
            Sensory score {rerouteSuggestion.sensoryScore} vs your current{' '}
            {activeRoute?.sensoryScore ?? '—'} — conditions ahead may have
            changed.
          </Text>
          <View style={styles.rerouteBannerButtons}>
            <TouchableOpacity
              style={styles.rerouteAcceptButton}
              onPress={handleAcceptReroute}
            >
              <Text style={styles.rerouteAcceptText}>Switch route</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rerouteDismissButton}
              onPress={handleDismissReroute}
            >
              <Text style={styles.rerouteDismissText}>Keep current</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!arrived && currentStep && (
        <View style={[styles.banner, { top: turnBannerTop }]}>
          <View style={styles.bannerIconWrap}>
            <Text style={styles.bannerIconText}>
              {travelMode === 'walking' ? '🚶' : '→'}
            </Text>
          </View>
          <View style={styles.bannerTextWrap}>
            <Text style={styles.bannerInstruction} numberOfLines={2}>
              {currentStep.label || 'Continue straight'}
            </Text>
            <Text style={styles.bannerDistance}>
              in {Math.round(currentStep.distanceMeters)} m
            </Text>
          </View>
        </View>
      )}

      {arrived ? (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.arrivedWrap}>
            <Text style={styles.arrivedTitle}>You've arrived 🎉</Text>
            <Text style={styles.arrivedSubtitle}>
              Hope this was a comfortable journey
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.bottomStat}>
            <Text style={styles.bottomStatValue}>{etaLabel}</Text>
            <Text style={styles.bottomStatLabel}>ETA</Text>
          </View>
          <View style={styles.bottomStat}>
            <Text style={styles.bottomStatValue}>{distanceKmRemaining} km</Text>
            <Text style={styles.bottomStatLabel}>remaining</Text>
          </View>
          <TouchableOpacity style={styles.endButton} onPress={handleEndNavigation}>
            <Text style={styles.endButtonText}>End</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}