import { StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../theme';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  mapWrap: {
    flex: 1,
  },
  map: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  bannerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  bannerIconText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  bannerTextWrap: {
    flex: 1,
  },
  bannerInstruction: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  bannerDistance: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  backButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.text,
  },

  bottomBar: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
    paddingHorizontal: 20,
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 6,
  },
  bottomStat: {
    alignItems: 'center',
  },
  bottomStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  bottomStatLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  endButton: {
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.button,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  endButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  arrivedWrap: {
    padding: 20,
    alignItems: 'center',
  },
  arrivedTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primary,
  },
  arrivedSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  permissionWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  permissionText: {
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionButton: {
    marginTop: 18,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.button,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // --- NEW: "Better route found" reroute suggestion banner ---
  // Matches the synopsis flowchart's "Suggest New Route -> Ask user
  // to switch" step. Sits above the turn instruction banner.
  rerouteBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  rerouteBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  rerouteBannerSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 3,
    lineHeight: 16,
  },
  rerouteBannerButtons: {
    flexDirection: 'row',
    marginTop: 12,
  },
  rerouteAcceptButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.input,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 8,
  },
  rerouteAcceptText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  rerouteDismissButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.input,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rerouteDismissText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
});