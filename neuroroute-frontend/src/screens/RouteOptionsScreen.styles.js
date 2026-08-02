import { StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../theme';

export default StyleSheet.create({
  heroBand: {
    backgroundColor: COLORS.heroTop,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 14,
  },
  backLink: {
    position: 'absolute',
    left: 20,
  },
  backLinkText: {
    fontSize: 14,
    color: COLORS.text,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },

  mapWrap: {
    flex: 1,
  },
  map: {
    flex: 1,
  },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 12,
  },

  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.button,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // --- Bottom sheet with route cards, sits over the map ---
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
    paddingTop: 14,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 6,
    maxHeight: '46%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetSummary: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 12,
  },

  routeCard: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.input,
    padding: 14,
    marginBottom: 12,
  },
  routeCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.background,
  },

  recommendedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginBottom: 8,
  },
  recommendedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },

  routeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  routeName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    textAlign: 'right',
  },

  metaRow: {
    flexDirection: 'row',
    marginTop: 6,
    marginLeft: 18,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  metaDot: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginHorizontal: 6,
  },

  explanationText: {
    fontSize: 12,
    color: COLORS.text,
    marginTop: 8,
    marginLeft: 18,
    lineHeight: 16,
  },

  startButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.button,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});