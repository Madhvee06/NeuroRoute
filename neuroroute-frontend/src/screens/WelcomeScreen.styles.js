import { StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../theme';

export default StyleSheet.create({
  heroBand: {
    backgroundColor: COLORS.heroTop,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 30,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    transform: [{ rotate: '45deg' }],
  },

  lowerBand: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: 28,
    marginTop: 20,
    flex: 1,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
  },

  spacer: {
    flex: 1,
  },

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.button,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.button,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
});