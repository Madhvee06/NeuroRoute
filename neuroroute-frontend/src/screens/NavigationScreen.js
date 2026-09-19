//NavigationScreen.js

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Animated } from 'react-native';
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

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors, Tiles style by Humanitarian OSM Team',
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
    }).addTo(map);

    if (routeCoords.length > 0) {
      const line = L.polyline(routeCoords, {
        color: '${COLORS.primary}',
        weight: 6,
        opacity: 0.95,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [50, 50] });

      // Flat dot markers for source/destination — same style as
      // RouteOptionsScreen, so the two screens read as one system.
      function flatDot(label, color) {
        return L.divIcon({
          className: '',
          html:
            '<div style="width:26px;height:26px;border-radius:13px;' +
            'background:' + color + ';border:3px solid #FFFFFF;' +
            'box-shadow:0 1px 4px rgba(0,0,0,0.25);' +
            'display:flex;align-items:center;justify-content:center;' +
            'font-size:11px;font-weight:700;color:#FFFFFF;">' +
            label + '</div>',
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });
      }

      L.marker(routeCoords[0], {
        icon: flatDot('S', '${COLORS.primary}')
      }).addTo(map).bindPopup('Start');

      L.marker(routeCoords[routeCoords.length - 1], {
        icon: flatDot('D', '${COLORS.accent}')
      }).addTo(map).bindPopup('Destination');
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

  // --- Motion: banners fade + slide in on change instead of
  // popping instantly. A hard-appearing/disappearing instruction
  // every ~30s reads as an interruption; an eased transition reads
  // as an update. Kept simple (mount-in only, no exit animation)
  // since these banners are conditionally rendered.
  const turnAnim = useRef(new Animated.Value(0)).current;
  const rerouteAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    turnAnim.setValue(0);
    Animated.timing(turnAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIndex]);

  useEffect(() => {
    if (rerouteSuggestion) {
      rerouteAnim.setValue(0);
      Animated.timing(rerouteAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [rerouteSuggestion]);

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

  // Single banner slot: the reroute prompt is a DECISION, the turn
  // banner is GUIDANCE. Showing both at once is exactly the kind of
  // visual noise this pass is removing, so the turn banner is
  // suppressed whenever a reroute suggestion is up. Both share the
  // same top offset, which also removes the old manual
  // "turnBannerTop" stacking arithmetic entirely.
  const bannerTop = insets.top + 12 + 52;

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
        <Animated.View
          style={[
            styles.rerouteBanner,
            {
              top: bannerTop,
              opacity: rerouteAnim,
              transform: [
                {
                  translateY: rerouteAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0],
                  }),
                },
              ],
            },
          ]}
        >
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
        </Animated.View>
      )}

      {!arrived && currentStep && !rerouteSuggestion && (
        <Animated.View
          style={[
            styles.banner,
            {
              top: bannerTop,
              opacity: turnAnim,
              transform: [
                {
                  translateY: turnAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0],
                  }),
                },
              ],
            },
          ]}
        >
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
        </Animated.View>
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
          {/* Consolidated: one primary figure (ETA, large) with
              distance as a quiet secondary line beneath it, instead
              of three equally-weighted stat blocks competing for
              attention. "End" demoted to a plain text link since
              it's a rare action, not a frequent one. */}
          <View style={styles.bottomPrimary}>
            <Text style={styles.bottomPrimaryValue}>{etaLabel}</Text>
            <Text style={styles.bottomSecondaryText}>
              {distanceKmRemaining} km remaining
            </Text>
          </View>

          <TouchableOpacity style={styles.endLink} onPress={handleEndNavigation}>
            <Text style={styles.endLinkText}>End</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}