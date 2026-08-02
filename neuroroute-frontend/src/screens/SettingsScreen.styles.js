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
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },

  lowerBand: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 32,
  },

  profileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '600',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  profileEmail: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  profileTag: {
    fontSize: 12,
    color: COLORS.primaryDark,
    fontWeight: '500',
    marginTop: 4,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 28,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  menuCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuRowLast: {
    borderBottomWidth: 0,
  },
  menuLabel: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  menuArrow: {
    fontSize: 18,
    color: COLORS.textMuted,
  },

  logoutButton: {
    marginTop: 32,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.button,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.error,
  },

  versionText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 20,
  },
});