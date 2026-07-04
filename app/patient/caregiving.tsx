import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import Icon from '../../components/Icon'
import DoctorMessages from '../../components/DoctorMessages'

type Patient = { patient_id: string; patient_email: string; tier: string; can_chat_providers: boolean }
type Lab = { test_name: string; value: number; unit: string | null; reference_high: number | null; reference_low: number | null; record_date: string }

function tierLabel(t: string) {
  if (t === 'elevated') return 'Can help log'
  if (t === 'representative') return 'Full representative'
  return 'View only'
}

function outOfRange(r: Lab) {
  if (r.reference_high != null && r.value > r.reference_high) return true
  if (r.reference_low != null && r.value < r.reference_low) return true
  return false
}

export default function CaregivingScreen({ onBack }: { onBack: () => void }) {
  const session = useAuthStore((state) => state.session)
  const profile = useAuthStore((state) => state.profile)
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Patient | null>(null)
  const [labs, setLabs] = useState<Lab[]>([])
  const [labsLoading, setLabsLoading] = useState(false)
  const [showMessages, setShowMessages] = useState(false)

  useEffect(() => { loadPatients() }, [])

  async function loadPatients() {
    setLoading(true)
    const { data } = await supabase.rpc('get_patients_i_care_for')
    setPatients((data as Patient[]) || [])
    setLoading(false)
  }

  async function openPatient(p: Patient) {
    setSelected(p)
    setLabs([])
    setLabsLoading(true)
    const { data } = await supabase
      .from('lab_values')
      .select('test_name, value, unit, reference_high, reference_low, record_date')
      .eq('patient_id', p.patient_id)
      .order('record_date', { ascending: false })
    const latest: Record<string, Lab> = {}
    for (const r of (data as Lab[]) || []) { if (!latest[r.test_name]) latest[r.test_name] = r }
    setLabs(Object.values(latest))
    setLabsLoading(false)
  }

  // -------- Read-only patient viewer --------
  if (selected) {
    if (showMessages) {
      return (
        <DoctorMessages
          patientId={selected.patient_id}
          myId={session?.user.id || ''}
          myRole="caregiver"
          myName={profile?.full_name || session?.user.email || 'Caregiver'}
          accent="#5C7340"
          headerTitle={selected.patient_email}
          onBack={() => setShowMessages(false)}
        />
      )
    }
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.backBtn}>
            <Icon name="back" size={22} color="#3D3229" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{selected.patient_email}</Text>
            <Text style={styles.subtitle}>You are caring for this person, {tierLabel(selected.tier).toLowerCase()}</Text>
          </View>
          <View style={styles.tierBadge}><Text style={styles.tierBadgeText}>{tierLabel(selected.tier)}</Text></View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }}>
          <View style={styles.readOnlyNote}>
            <Icon name="back" size={14} color="#8A7E72" />
            <Text style={styles.readOnlyNoteText}>Read only. You can see this record but not change it.</Text>
          </View>

          {selected.can_chat_providers && (
            <TouchableOpacity style={styles.msgBtn} onPress={() => setShowMessages(true)}>
              <Icon name="message" size={18} color="#fff" />
              <Text style={styles.msgBtnText}>Message their doctors</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.sectionLabel}>Lab results</Text>
          {labsLoading ? (
            <ActivityIndicator color="#5C7340" style={{ marginTop: 16 }} />
          ) : labs.length === 0 ? (
            <View style={styles.emptyCard}><Text style={styles.emptyText}>No lab results in their record yet.</Text></View>
          ) : (
            labs.map((r) => {
              const flagged = outOfRange(r)
              return (
                <View key={r.test_name} style={styles.labRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.labName}>{r.test_name}</Text>
                    <Text style={styles.labDate}>{r.record_date}</Text>
                  </View>
                  <Text style={[styles.labValue, flagged && styles.labValueFlagged]}>
                    {r.value}{r.unit ? ` ${r.unit}` : ''}
                  </Text>
                </View>
              )
            })
          )}
        </ScrollView>
      </View>
    )
  }

  // -------- People I care for list --------
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Icon name="back" size={22} color="#3D3229" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>People you care for</Text>
          <Text style={styles.subtitle}>Records shared with you as a caregiver</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }}>
        {loading ? (
          <ActivityIndicator color="#5C7340" style={{ marginTop: 24 }} />
        ) : patients.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Icon name="careteam" size={22} color="#5C7340" /></View>
            <Text style={styles.emptyTitle}>No one yet</Text>
            <Text style={styles.emptyText}>When someone adds you as their caregiver and you accept the invite, their record appears here.</Text>
          </View>
        ) : (
          patients.map((p) => (
            <TouchableOpacity key={p.patient_id} style={styles.patientRow} onPress={() => openPatient(p)}>
              <View style={styles.patientAvatar}><Icon name="careteam" size={20} color="#5C7340" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.patientName} numberOfLines={1}>{p.patient_email}</Text>
                <Text style={styles.patientTier}>{tierLabel(p.tier)}</Text>
              </View>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5DFD3', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 16 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Georgia', fontSize: 20, color: '#3D3229' },
  subtitle: { fontSize: 12, color: '#8A7E72', marginTop: 2 },
  tierBadge: { backgroundColor: '#EBEFE3', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  tierBadgeText: { fontSize: 11, fontWeight: '700', color: '#5C7340' },
  content: { flex: 1, padding: 16 },
  readOnlyNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(138,126,114,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 18 },
  readOnlyNoteText: { fontSize: 12, color: '#8A7E72', flex: 1 },
  msgBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#5C7340', borderRadius: 12, paddingVertical: 13, marginBottom: 18 },
  msgBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  sectionLabel: { fontFamily: 'Georgia', fontSize: 16, color: '#3D3229', marginBottom: 10 },
  labRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5DFD3', padding: 14, marginBottom: 8 },
  labName: { fontSize: 15, color: '#3D3229', fontWeight: '600' },
  labDate: { fontSize: 12, color: '#8A7E72', marginTop: 2 },
  labValue: { fontSize: 16, fontWeight: '700', color: '#5C7340' },
  labValueFlagged: { color: '#C4611A' },
  patientRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5DFD3', padding: 14, marginBottom: 10 },
  patientAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EBEFE3', alignItems: 'center', justifyContent: 'center' },
  patientName: { fontSize: 15, color: '#3D3229', fontWeight: '600' },
  patientTier: { fontSize: 12, color: '#8A7E72', marginTop: 2 },
  emptyCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5DFD3', padding: 24, alignItems: 'center', marginTop: 10 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EBEFE3', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontFamily: 'Georgia', fontSize: 17, color: '#3D3229', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#8A7E72', textAlign: 'center', lineHeight: 19 },
})