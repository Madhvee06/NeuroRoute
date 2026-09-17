//NavigationScreen.js

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
//
// FOCUS MODE (new — sensory decluttering of the map itself):
// The map is rendered as TWO stacked Leaflet panes of the same
// label-free basemap:
//   - 'nrBlurred' : blurred + desaturated, the whole viewport
//   - 'nrSharp'   : identical tiles, masked to a soft circle
//                   around the user, so only the road ahead is
//                   in focus
// The route polyline and the user puck live in a third pane
// ABOVE both, so they are never blurred.
//
// Three modes, cycled by the on-map chip and initialised from the
// user's saved `blurSurroundings` preference:
//   'spotlight' -> blurred surroundings + sharp circle (default)
//   'calm'      -> everything softened, no circle
//   'off'       -> plain map, no filtering at all
//
// CAUTION — flex:1 WebView sizing (kept here to match the existing
// NavigationScreen.styles.js, where mapWrap/map are both flex:1):
// a flex:1 WebView can measure as zero height on Android, which
// stops Leaflet requesting any tiles at all (the blank grey box bug
// already hit once on RouteOptionsScreen). CSS `filter`, used below
// for the blur, creates a new stacking context, which makes that
// failure mode MORE likely — not less — than on a plain map. If the
// map renders blank on a real Android device, switch mapWrap to
// measure itself via onLayout and pass explicit pixel dimensions to
// the WebView's style, the same fix already applied on
// RouteOptionsScreen.js.
// ---------------------------------------------------------------

const REEVALUATE_INTERVAL_MS = 45000; // check every 45s
const REROUTE_SCORE_IMPROVEMENT_THRESHOLD = 0.85; // must be <=85% of current score to suggest
const DISMISS_COOLDOWN_MS = 3 * 60 * 1000; // don't re-suggest for 3 min after a dismiss

const FOCUS_MODES = ['spotlight', 'calm', 'off'];

const FOCUS_LABELS = {
  spotlight: 'Focus: road ahead',
  calm: 'Focus: all soft',
  off: 'Focus: off',
};

function nextFocusMode(mode) {
  const i = FOCUS_MODES.indexOf(mode);
  return FOCUS_MODES[(i + 1) % FOCUS_MODES.length];
}

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

function buildMapHtml(routeCoords, initialFocusMode) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; }

    body { background: #FCF8F5; }

    /* Bottom layer — everything out of focus */
    .nr-blurred {
      filter: blur(4px) saturate(0.35) brightness(1.04);
      transform: translateZ(0);   /* keeps the blur on the GPU on Android */
    }

    /* Slightly gentler blur for 'calm' (no sharp window to contrast with) */
    body.nr-mode-calm .nr-blurred {
      filter: blur(3px) saturate(0.4) brightness(1.05);
    }

    /* Top layer — identical tiles, visible only inside the spotlight.
       The soft gradient edge is what makes it read as "focus"
       rather than "a hole cut in the map". */
    .nr-sharp {
      -webkit-mask-image: radial-gradient(circle 165px at 50% 62%,
                          #000 0%, #000 55%, transparent 100%);
              mask-image: radial-gradient(circle 165px at 50% 62%,
                          #000 0%, #000 55%, transparent 100%);
    }

    /* 'calm' and 'off' don't use the sharp window at all */
    body.nr-mode-calm .nr-sharp,
    body.nr-mode-off  .nr-sharp { display: none; }

    body.nr-mode-off .nr-blurred { filter: none; }

    .leaflet-control-attribution {
      font-size: 9px;
      background: rgba(255, 255, 255, 0.55);
      color: #948AA0;
    }
  </style>
</head>
<body class="nr-mode-${initialFocusMode}">
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const routeCoords = ${JSON.stringify(routeCoords)};

    const map = L.map('map', {
      zoomControl: false,
      dragging: false,        // navigation follows GPS, not fingers
      touchZoom: false,
      doubleClickZoom: false,
      scrollWheelZoom: false,
      keyboard: false,
      attributionControl: true
    }).setView(routeCoords[0] || [20.5937, 78.9629], 17);

    window.map = map;

    // --- panes: blurred base, sharp window, then route/puck on top ---
    map.createPane('nrBlurred');
    map.createPane('nrSharp');
    map.createPane('nrRoute');
    map.getPane('nrBlurred').style.zIndex = 200;
    map.getPane('nrSharp').style.zIndex   = 250;
    map.getPane('nrRoute').style.zIndex   = 400;

    map.getPane('nrBlurred').classList.add('nr-blurred');
    map.getPane('nrSharp').classList.add('nr-sharp');

    // Label-free basemap. This alone removes most of the visual
    // noise (every shop name, every POI icon) before any blur.
    const TILE_URL =
      'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';
    const ATTR = '&copy; OpenStreetMap contributors &copy; CARTO';

    L.tileLayer(TILE_URL, {
      pane: 'nrBlurred', attribution: ATTR, maxZoom: 19
    }).addTo(map);

    L.tileLayer(TILE_URL, {
      pane: 'nrSharp', attribution: '', maxZoom: 19
    }).addTo(map);

    let routeLine = null;

    window.drawRoute = function (coords) {
      if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
      }
      if (!coords || coords.length === 0) return;

      routeLine = L.polyline(coords, {
        pane: 'nrRoute',
        color: '${COLORS.primary}',
        weight: 7,
        opacity: 0.95,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(map);
    };

    window.drawRoute(routeCoords);

    let userMarker = null;
    const userIcon = L.divIcon({
      className: '',
      html: '<div style="width:18px;height:18px;border-radius:9px;background:${COLORS.primary};border:3px solid white;box-shadow:0 0 6px rgba(0,0,0,0.35);"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    window.updateUserPosition = function (lat, lng, recenter) {
      const latlng = [lat, lng];

      if (userMarker) {
        userMarker.setLatLng(latlng);
      } else {
        userMarker = L.marker(latlng, { icon: userIcon, pane: 'nrRoute' }).addTo(map);
      }

      // setView, not panTo: panTo animates across long distances when
      // GPS jumps, which is disorienting against a fixed spotlight.
      if (recenter) {
        map.setView(latlng, map.getZoom(), { animate: true, duration: 0.5 });
      }
    };

    // 'spotlight' | 'calm' | 'off'
    window.setFocusMode = function (mode) {
      document.body.className = 'nr-mode-' + mode;
      setTimeout(function () { map.invalidateSize(); }, 50);
    };

    setTimeout(function () { map.invalidateSize(); }, 300);
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

  // --- Focus mode (map blur) ---
  // Initialised from the saved preference. Explicit === false check so
  // that a missing/undefined preference still defaults to spotlight.
  const [focusMode, setFocusMode] = useState(
    preferences?.blurSurroundings === false ? 'off' : 'spotlight'
  );

  // The mode the WebView HTML was FIRST built with. Kept in a ref so
  // that later mode changes are pushed via injectJavaScript instead of
  // rebuilding the HTML — rebuilding would remount the whole map and
  // lose the user puck mid-journey.
  const initialFocusModeRef = useRef(focusMode);

  const routeCoords = useMemo(() => {
    if (!activeRoute?.geometry?.coordinates) return [];
    return activeRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  }, [activeRoute]);

  // Deliberately does NOT depend on focusMode or routeCoords changes
  // after first build — both are pushed into the live map instead.
  const mapHtml = useMemo(
    () => buildMapHtml(routeCoords, initialFocusModeRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Redraw the polyline in place when the active route changes
  // (i.e. after the user accepts a reroute) — no remount.
  useEffect(() => {
    if (routeCoords.length === 0) return;
    webViewRef.current?.injectJavaScript(
      `window.drawRoute(${JSON.stringify(routeCoords)}); true;`
    );
  }, [routeCoords]);

  // Push focus-mode changes into the live map
  useEffect(() => {
    webViewRef.current?.injectJavaScript(
      `window.setFocusMode(${JSON.stringify(focusMode)}); true;`
    );
  }, [focusMode]);

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

  const handleCycleFocus = () => {
    setFocusMode((m) => nextFocusMode(m));
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

  // Decluttering rule: the reroute prompt is a DECISION, the turn
  // banner is GUIDANCE. Never show both — one banner slot, always.
  // (This is what removed the old manual `turnBannerTop` arithmetic.)
  const bannerTop = insets.top + 12 + 52;

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
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
      </View>

      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 12 }]}
        onPress={handleEndNavigation}
      >
        <Text style={styles.backButtonText}>‹</Text>
      </TouchableOpacity>

      {/* Focus-mode chip — lets the user soften or un-soften the map
          mid-journey without digging into Settings. Some users find
          blur itself disorienting, so this must stay reachable. */}
      <TouchableOpacity
        style={[styles.focusChip, { top: insets.top + 12 }]}
        onPress={handleCycleFocus}
      >
        <Text style={styles.focusChipText}>{FOCUS_LABELS[focusMode]}</Text>
      </TouchableOpacity>

      {rerouteSuggestion && (
        <View style={[styles.rerouteBanner, { top: bannerTop }]}>
          <Text style={styles.rerouteBannerTitle}>Calmer route available</Text>
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

      {!arrived && currentStep && !rerouteSuggestion && (
        <View style={[styles.banner, { top: bannerTop }]}>
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