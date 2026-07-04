import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import Icon from './Icon'

type TabKey = 'dashboard' | 'messages' | 'records' | 'share' | 'notifications'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Home', icon: 'home' },
  { key: 'messages', label: 'Messages', icon: 'message' },
  { key: 'records', label: 'Vault', icon: 'vault' },
  { key: 'share', label: 'Care Team', icon: 'careteam' },
  { key: 'notifications', label: 'Notifications', icon: 'bell' },
]

export default function PatientTabBar({
  active,
  onNavigate,
  unread = 0,
}: {
  active: string
  onNavigate: (key: TabKey) => void
  unread?: number
}) {
  return (
    <View style={styles.bar}>
      {TABS.map((t) => {
        const on = active === t.key
        const color = on ? '#5C7340' : '#9B9486'
        return (
          <TouchableOpacity key={t.key} style={styles.tab} activeOpacity={0.7} onPress={() => onNavigate(t.key)}>
            <View style={styles.iconWrap}>
              {on && <View style={styles.activePip} />}
              <Icon name={t.icon as any} size={22} color={color} />
              {t.key === 'notifications' && unread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>{t.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5DFD3',
    paddingTop: 9,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    paddingHorizontal: 2,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 1 },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  activePip: { position: 'absolute', top: -9, width: 16, height: 3, borderRadius: 2, backgroundColor: '#5C7340' },
  label: { fontSize: 9.5, fontWeight: '600', color: '#9B9486' },
  labelOn: { color: '#5C7340' },
  badge: {
    position: 'absolute', top: -5, right: -9, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#C4611A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },
})