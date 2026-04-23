import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useAuthStore } from '../../store/authStore'

export default function PatientHome() {
  const signOut = useAuthStore((state) => state.signOut)

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>bridgette</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Health Wallet</Text>
        <Text style={styles.sectionSub}>Upload and track your lab results over time</Text>
      </View>

      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🧪</Text>
        <Text style={styles.emptyTitle}>No records yet</Text>
        <Text style={styles.emptyText}>
          Upload your first lab result to get started
        </Text>
      </View>

      <TouchableOpacity style={styles.uploadBtn}>
        <Text style={styles.uploadBtnText}>+ Scan a Lab Result</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F4',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4DC',
  },
  logo: {
    fontFamily: 'serif',
    fontSize: 24,
    color: '#C8524A',
  },
  signOut: {
    fontSize: 14,
    color: '#7A7A9A',
  },
  section: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'serif',
    fontSize: 26,
    color: '#1A1A2E',
    marginBottom: 6,
  },
  sectionSub: {
    fontSize: 14,
    color: '#7A7A9A',
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: 'serif',
    fontSize: 20,
    color: '#1A1A2E',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#7A7A9A',
    textAlign: 'center',
    lineHeight: 20,
  },
  uploadBtn: {
    backgroundColor: '#C8524A',
    marginHorizontal: 24,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  uploadBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})