import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'
import Icon from './Icon'
import ChatThread from './ChatThread'

type Doctor = { provider_id: string; provider_name: string }

export default function DoctorMessages({
  patientId,
  myId,
  myRole,
  myName,
  accent = '#5C7340',
  headerTitle,
  onBack,
  onThreadActiveChange,
}: {
  patientId: string
  myId: string
  myRole: 'patient' | 'caregiver'
  myName: string
  accent?: string
  headerTitle: string
  onBack: () => void
  onThreadActiveChange?: (active: boolean) => void
}) {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Doctor | null>(null)

  useEffect(() => { load() }, [patientId])

  useEffect(() => { onThreadActiveChange?.(!!selected) }, [selected])
  useEffect(() => () => { onThreadActiveChange?.(false) }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.rpc('get_doctors_for_patient', { p_patient: patientId })
    setDoctors((data as Doctor[]) || [])
    setLoading(false)
  }

  if (selected) {
    return (
      <ChatThread
        patientId={patientId}
        providerId={selected.provider_id}
        myId={myId}
        myRole={myRole}
        myName={myName}
        accent={accent}
        title={selected.provider_name}
        onBack={() => setSelected(null)}
      />
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Icon name="back" size={22} color="#3D3229" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{headerTitle}</Text>
          <Text style={styles.subtitle}>{myRole === 'caregiver' ? 'Messaging as a caregiver' : 'Message your care team'}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }}>
        {loading ? (
          <ActivityIndicator color={accent} style={{ marginTop: 24 }} />
        ) : doctors.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No doctors connected yet. A doctor appears here once they are added to the care team.</Text>
          </View>
        ) : (
          doctors.map((d) => (
            <TouchableOpacity key={d.provider_id} style={styles.row} onPress={() => setSelected(d)}>
              <View style={[styles.avatar, { backgroundColor: '#EBEFE3' }]}><Icon name="careteam" size={20} color={accent} /></View>
              <Text style={styles.name}>{d.provider_name}</Text>
              <Icon name="forward" size={18} color="#B8AE9E" />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F2EC' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5DFD3', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Georgia', fontSize: 20, color: '#3D3229' },
  subtitle: { fontSize: 12, color: '#8A7E72', marginTop: 2 },
  content: { flex: 1, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5DFD3', padding: 14, marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 15, color: '#3D3229', fontWeight: '600' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5DFD3', padding: 24, alignItems: 'center', marginTop: 10 },
  emptyText: { fontSize: 13, color: '#8A7E72', textAlign: 'center', lineHeight: 19 },
})