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

  optionsList: {
    marginTop: 24,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.input,
    padding: 16,
    marginBottom: 14,
  },
  optionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.background,
  },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionIconWrapSelected: {
    backgroundColor: COLORS.primary,
  },
  optionIconDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  optionIconDotSelected: {
    backgroundColor: '#FFFFFF',
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  optionDescription: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    lineHeight: 17,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: COLORS.primary,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: COLORS.primary,
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
  primaryButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});