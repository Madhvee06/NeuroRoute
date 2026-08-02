import { StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../theme';

export default StyleSheet.create({
  heroBand: {
    backgroundColor: COLORS.heroTop,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
  },
  backLink: {
    position: 'absolute',
    left: 20,
  },
  backLinkText: {
    fontSize: 14,
    color: COLORS.text,
  },
  logoCircleSmall: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkSmall: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    transform: [{ rotate: '45deg' }],
  },

  lowerBand: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },
  scrollContent: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: 26,
    marginTop: 20,
    marginBottom: 24,
    flex: 1,
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
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 6,
    lineHeight: 19,
  },

  toggleList: {
    marginTop: 22,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  toggleTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  toggleDescription: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },

  spacer: {
    flex: 1,
  },

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.button,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  skipLink: {
    alignItems: 'center',
    marginTop: 14,
  },
  skipLinkText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
});