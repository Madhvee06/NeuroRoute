import { StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../theme';

export default StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  greeting: {
    fontSize: 15,
    color: COLORS.textMuted,
  },
  userName: {
    fontSize: 26,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 2,
  },
  profileBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBadgeText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  profileTag: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.primaryDark,
    fontWeight: '500',
  },

  comfortCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  comfortDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginRight: 14,
  },
  comfortLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  comfortValue: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
    marginTop: 2,
  },

  searchCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    paddingVertical: 10,
  },
  inputDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 20,
  },
  findButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.button,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 18,
  },
  findButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  findButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  preferencesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    paddingHorizontal: 4,
  },
  preferencesText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  preferencesArrow: {
    fontSize: 18,
    color: COLORS.textMuted,
  },

  sectionHeaderRow: {
    marginTop: 32,
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  placeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  placeIconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  placeName: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
  placeType: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 1,
  },

  emergencyButton: {
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  emergencyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
});