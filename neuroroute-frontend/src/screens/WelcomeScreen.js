import React from 'react';
import { View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme';
import styles from './WelcomeScreen.styles';

export default function WelcomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.heroTop }}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.heroTop} />

      {/* Hero band: no fixed/percentage height, no negative margin on the
          card below — paddingTop simply pushes the logo down below the
          status bar, and the band naturally sizes to its content. */}
      <View style={[styles.heroBand, { paddingTop: insets.top + 60 }]}>
        <View style={styles.logoCircle}>
          <View style={styles.logoMark} />
        </View>
      </View>

      <View style={styles.lowerBand}>
        <View style={styles.card}>
          <Text style={styles.title}>Welcome to NeuroRoute</Text>
          <Text style={styles.subtitle}>
            Sensory-friendly navigation, built for you
          </Text>

          <View style={styles.spacer} />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation?.navigate('Signup')}
          >
            <Text style={styles.primaryButtonText}>Sign up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation?.navigate('Login')}
          >
            <Text style={styles.secondaryButtonText}>Log in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}