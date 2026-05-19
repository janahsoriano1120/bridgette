import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native'

type Notification = {
  id: string
  type: 'appointment' | 'summary' | 'data_request'
  title: string
  body: string
  time: string
  read: boolean
  provider?: string
  date?: string
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'data_request',
    title: 'Data Request',
    body: 'Dr. David del Prado is requesting access to your recent health data.',
    time: '2 mins ago',
    read: false,
    provider: 'Dr. David del Prado',
  },
  {
    id: '2',
    type: 'summary',
    title: 'Your Daily Summary is Ready',
    body: 'Your health summary for today is ready to view.',
    time: '8:00 AM',
    read: false,
  },
  {
    id: '3',
    type: 'appointment',
    title: 'Upcoming Appointment',
    body: 'Your follow-up with Dr. David del Prado is scheduled for July 12, 2026. Finalize your booking with your provider to confirm the date.',
    time: 'Yesterday',
    read: true,
    provider: 'Dr. David del Prado',
    date: 'July 12, 2026',
  },
  {
    id: '4',
    type: 'summary',
    title: 'Your Daily Summary is Ready',
    body: 'Your health summary for yesterday is ready to view.',
    time: 'Yesterday',
    read: true,
  },
  {
    id: '5',
    type: 'data_request',
    title: 'Data Request',
    body: 'Beatrix Mercado, RND is requesting access to your recent health data.',
    time: '2 days ago',
    read: true,
    provider: 'Beatrix Mercado',
  },
]

const NOTIFICATION_ICONS: Record<string, string> = {
  appointment: '📅',
  summary: '📊',
  data_request: '🔗',
}

const NOTIFICATION_COLORS: Record<string, string> = {
  appointment: '#3D7A5E',
  summary: '#2C5FAB',
  data_request: '#B5720A',
}

type Props = {
  onBack: () => void
  onOpenSummary: () => void
  onOpenDataRequest: (provider: string) => void
}

export default function PatientNotificationsScreen({
  onBack,
  onOpenSummary,
  onOpenDataRequest,
}: Props) {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS)

  const unreadCount = notifications.filter(n => !n.read).length

  function markAllRead() {
    setNotifications(notifications.map(n => ({ ...n, read: true })))
  }

  function markRead(id: string) {
    setNotifications(notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    ))
  }

  function handleTap(notification: Notification) {
    markRead(notification.id)
    if (notification.type === 'summary') {
      onOpenSummary()
    } else if (notification.type === 'data_request' && notification.provider) {
      onOpenDataRequest(notification.provider)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
        {unreadCount > 0 && (
          <Text style={styles.unreadCount}>{unreadCount} unread</Text>
        )}
      </View>

      <ScrollView style={styles.content}>
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyDesc}>We'll notify you about appointments, health summaries, and data requests.</Text>
          </View>
        ) : (
          notifications.map(notification => (
            <TouchableOpacity
              key={notification.id}
              style={[
                styles.notifCard,
                !notification.read && styles.notifCardUnread,
              ]}
              onPress={() => handleTap(notification)}
            >
              <View style={[
                styles.notifIconBg,
                { backgroundColor: NOTIFICATION_COLORS[notification.type] + '20' }
              ]}>
                <Text style={styles.notifIcon}>
                  {NOTIFICATION_ICONS[notification.type]}
                </Text>
              </View>
              <View style={styles.notifBody}>
                <View style={styles.notifTitleRow}>
                  <Text style={styles.notifTitle}>{notification.title}</Text>
                  {!notification.read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.notifText}>{notification.body}</Text>
                <Text style={styles.notifTime}>{notification.time}</Text>
                {notification.type === 'data_request' && !notification.read && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.confirmBtn}
                      onPress={() => {
                        markRead(notification.id)
                        if (notification.provider) onOpenDataRequest(notification.provider)
                      }}
                    >
                      <Text style={styles.confirmBtnText}>Confirm</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.denyBtn}
                      onPress={() => markRead(notification.id)}
                    >
                      <Text style={styles.denyBtnText}>Deny</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F4' },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4DC',
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 13, color: '#C8524A', fontWeight: '600' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'serif', fontSize: 24, color: '#1A1A2E' },
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#F4F2EE', borderRadius: 8 },
  markAllText: { fontSize: 11, color: '#7A7A9A', fontWeight: '600' },
  unreadCount: { fontSize: 12, color: '#7A7A9A', marginTop: 4 },
  content: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontFamily: 'serif', fontSize: 20, color: '#1A1A2E', marginBottom: 8 },
  emptyDesc: { fontSize: 13, color: '#7A7A9A', textAlign: 'center', lineHeight: 20 },
  notifCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },
  notifCardUnread: {
    borderColor: '#C8524A',
    backgroundColor: '#FFFAF9',
  },
  notifIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifIcon: { fontSize: 20 },
  notifBody: { flex: 1 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  notifTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C8524A' },
  notifText: { fontSize: 12, color: '#4A4A6A', lineHeight: 18, marginBottom: 6 },
  notifTime: { fontSize: 10, color: '#7A7A9A' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#3D7A5E',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  denyBtn: {
    flex: 1,
    backgroundColor: '#F4F2EE',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },
  denyBtnText: { fontSize: 12, fontWeight: '700', color: '#7A7A9A' },
})