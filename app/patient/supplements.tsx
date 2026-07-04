import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import Icon from '../../components/Icon'

const DAY_MINI = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const REASONS = ['Maintenance', 'For fever', 'For pain', 'For allergy', 'As needed', 'Vitamins']

type Kind = 'supplement' | 'medication'
type Freq = 'daily' | 'specific_days'
type Meal = 'none' | 'before_meal' | 'after_meal'
type Source = 'patient' | 'doctor'

type Supplement = {
  id: string
  name: string
  dosage: string | null
  reminder_time: string
  kind: Kind
  frequency: Freq
  days_of_week: number[] | null
  meal_relation: Meal
  reason: string | null
  source: Source
  prescriber_name: string | null
}

function to12h(hhmm: string) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10))
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function dateToHHMM(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function hhmmToDate(hhmm: string) {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10))
  const d = new Date()
  d.setHours(h || 0, m || 0, 0, 0)
  return d
}

function dateTo12h(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function nowHHMM() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function mealText(m: Meal) {
  if (m === 'before_meal') return 'Before meal'
  if (m === 'after_meal') return 'After meal'
  return ''
}

function freqText(s: Supplement) {
  if (s.frequency === 'daily') return 'Daily'
  const days = (s.days_of_week || []).slice().sort((a, b) => a - b)
  if (days.length === 0) return 'No days set'
  if (days.length === 7) return 'Daily'
  return days.map((d) => DAY_SHORT[d]).join(', ')
}

export default function SupplementsScreen({ onBack }: { onBack: () => void }) {
  const session = useAuthStore((state) => state.session)
  const today = new Date().toISOString().split('T')[0]
  const todayDow = new Date().getDay()

  const [supplements, setSupplements] = useState<Supplement[]>([])
  const [takenMap, setTakenMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form (now shown inside a slide-up sheet)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Supplement | null>(null)
  const [kind, setKind] = useState<Kind>('supplement')
  const [name, setName] = useState('')
  const [dosage, setDosage] = useState('')
  const [timeDate, setTimeDate] = useState(() => { const d = new Date(); d.setHours(8, 0, 0, 0); return d })
  const [showPicker, setShowPicker] = useState(false)
  const [frequency, setFrequency] = useState<Freq>('daily')
  const [days, setDays] = useState<number[]>([])
  const [mealRelation, setMealRelation] = useState<Meal>('none')
  const [reason, setReason] = useState('')

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    const userId = session?.user.id
    if (!userId) return
    const [suppRes, checkRes] = await Promise.all([
      supabase
        .from('supplements')
        .select('*')
        .eq('patient_id', userId)
        .eq('active', true)
        .order('reminder_time', { ascending: true }),
      supabase
        .from('supplement_checkins')
        .select('id, supplement_id')
        .eq('patient_id', userId)
        .eq('log_date', today),
    ])
    if (suppRes.data) setSupplements(suppRes.data as Supplement[])
    const map: Record<string, string> = {}
    if (checkRes.data) checkRes.data.forEach((c: any) => { map[c.supplement_id] = c.id })
    setTakenMap(map)
    setLoading(false)
  }

  function scheduledToday(s: Supplement) {
    if (s.frequency === 'daily') return true
    return (s.days_of_week || []).includes(todayDow)
  }

  async function toggleTaken(s: Supplement) {
    const userId = session?.user.id
    if (!userId) return
    const existingId = takenMap[s.id]
    if (existingId) {
      setTakenMap((m) => { const n = { ...m }; delete n[s.id]; return n })
      await supabase.from('supplement_checkins').delete().eq('id', existingId)
    } else {
      const { data, error } = await supabase
        .from('supplement_checkins')
        .insert({ supplement_id: s.id, patient_id: userId, log_date: today })
        .select()
        .single()
      if (!error && data) setTakenMap((m) => ({ ...m, [s.id]: data.id }))
    }
  }

  function openAdd() {
    setEditing(null)
    setKind('supplement')
    setName('')
    setDosage('')
    const d = new Date(); d.setHours(8, 0, 0, 0); setTimeDate(d)
    setShowPicker(false)
    setFrequency('daily')
    setDays([])
    setMealRelation('none')
    setReason('')
    setShowForm(true)
  }

  function openEdit(s: Supplement) {
    if (s.source === 'doctor') return // doctor items are read-only
    setEditing(s)
    setKind(s.kind)
    setName(s.name)
    setDosage(s.dosage || '')
    setTimeDate(hhmmToDate(s.reminder_time))
    setShowPicker(false)
    setFrequency(s.frequency)
    setDays(s.days_of_week || [])
    setMealRelation(s.meal_relation)
    setReason(s.reason || '')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
    setShowPicker(false)
  }

  function toggleDay(d: number) {
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])
  }

  async function saveSupplement() {
    if (!name.trim()) { Alert.alert('Please enter a name'); return }
    if (frequency === 'specific_days' && days.length === 0) {
      Alert.alert('Pick at least one day', 'Or set the frequency to Every day.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        dosage: dosage.trim() || null,
        reminder_time: dateToHHMM(timeDate),
        kind,
        frequency,
        days_of_week: frequency === 'specific_days' ? days : [],
        meal_relation: mealRelation,
        reason: reason.trim() || null,
      }
      if (editing) {
        await supabase.from('supplements').update(payload).eq('id', editing.id)
      } else {
        await supabase.from('supplements').insert({ patient_id: session?.user.id, source: 'patient', ...payload })
      }
      closeForm()
      await fetchAll()
    } catch (e) {
      Alert.alert('Error', 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  function removeSupplement(s: Supplement) {
    if (s.source === 'doctor') return
    Alert.alert('Remove from your list?', `${s.name} will no longer appear or remind you.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await supabase.from('supplements').update({ active: false }).eq('id', s.id)
          await fetchAll()
        },
      },
    ])
  }

  const now = nowHHMM()
  const todayItems = supplements.filter(scheduledToday)
  const otherItems = supplements.filter((s) => !scheduledToday(s))
  const takenCount = todayItems.filter((s) => takenMap[s.id]).length
  const dueCount = todayItems.filter((s) => !takenMap[s.id] && s.reminder_time <= now).length
  const total = todayItems.length
  const pct = total > 0 ? Math.round((takenCount / total) * 100) : 0
  const allDone = total > 0 && takenCount === total

  function KindBadge({ k }: { k: Kind }) {
    const isMed = k === 'medication'
    return (
      <View style={[styles.kindBadge, isMed ? styles.kindMed : styles.kindSupp]}>
        <Text style={[styles.kindBadgeText, { color: isMed ? '#7B4B94' : '#5C7340' }]}>
          {isMed ? 'Medicine' : 'Supplement'}
        </Text>
      </View>
    )
  }

  function Row({ s, isToday }: { s: Supplement; isToday: boolean }) {
    const taken = !!takenMap[s.id]
    const due = isToday && !taken && s.reminder_time <= now
    const isDoctor = s.source === 'doctor'
    const hasSub = isDoctor || !!s.reason
    return (
      <View style={[styles.row, isDoctor && styles.rowDoctor]}>
        {isToday ? (
          <TouchableOpacity style={[styles.check, taken && styles.checkOn]} onPress={() => toggleTaken(s)}>
            {taken && <Icon name="ok" size={20} color="#fff" />}
          </TouchableOpacity>
        ) : (
          <View style={styles.checkMuted}>
            <Icon name="medication" size={18} color="#B8AEA0" />
          </View>
        )}

        <View style={styles.rowInfo}>
          <View style={styles.rowNameLine}>
            <Text style={[styles.rowName, taken && styles.rowNameTaken]}>{s.name}</Text>
            <KindBadge k={s.kind} />
            {isDoctor && <Icon name="lock" size={13} color="#7B4B94" />}
          </View>
          <View style={styles.rowMeta}>
            {s.dosage ? <Text style={styles.rowDosage}>{s.dosage}</Text> : null}
            <Text style={styles.rowTime}>{to12h(s.reminder_time)}</Text>
            {mealText(s.meal_relation) ? <Text style={styles.tagMeal}>{mealText(s.meal_relation)}</Text> : null}
            <Text style={styles.tagFreq}>{freqText(s)}</Text>
            {due && <Text style={styles.tagDue}>Due now</Text>}
            {isToday && taken && <Text style={styles.tagTaken}>Taken</Text>}
          </View>
          {hasSub && (
            <View style={[styles.rowMeta, { marginTop: 6 }]}>
              {isDoctor && (
                <View style={styles.rxTag}>
                  <Icon name="doctor" size={11} color="#7B4B94" />
                  <Text style={styles.rxTagText}>Prescribed by {s.prescriber_name || 'your doctor'}</Text>
                </View>
              )}
              {!!s.reason && <Text style={styles.tagReason}>{s.reason}</Text>}
            </View>
          )}
        </View>

        {isDoctor ? (
          <View style={styles.lockNote}>
            <Icon name="lock" size={14} color="#B8AEA0" />
          </View>
        ) : (
          <View style={styles.rowActions}>
            <TouchableOpacity onPress={() => openEdit(s)} style={styles.actionBtn}>
              <Icon name="edit" size={16} color="#8A7E72" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeSupplement(s)} style={styles.actionBtn}>
              <Icon name="delete" size={16} color="#B5451B" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }

  return (
    <ImageBackground source={require('../../assets/supplements-bg.jpg')} style={styles.container} resizeMode="cover">
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <View style={styles.backRow}>
            <Icon name="back" size={18} color="#5C7340" />
            <Text style={styles.backText}>Back</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>Supplements & Medicine</Text>
        <Text style={styles.subtitle}>Your daily doses. Tap the circle the moment you take each one.</Text>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <ActivityIndicator color="#5C7340" style={{ marginTop: 40 }} />
        ) : (
          <>
            {total > 0 && (
              <View style={styles.summary}>
                <View style={styles.summaryTopRow}>
                  <View>
                    <Text style={styles.summaryBig}>{takenCount} of {total}</Text>
                    <Text style={styles.summarySub}>taken today</Text>
                  </View>
                  {allDone ? (
                    <View style={styles.doneBadge}>
                      <Icon name="ok" size={14} color="#5C7340" />
                      <Text style={styles.doneBadgeText}>All caught up</Text>
                    </View>
                  ) : dueCount > 0 ? (
                    <View style={styles.dueBadge}>
                      <Icon name="bell" size={14} color="#B5451B" />
                      <Text style={styles.dueBadgeText}>{dueCount} due now</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.progressLabel}>{allDone ? 'Done for today. Nice work.' : `${pct}% taken today`}</Text>
              </View>
            )}

            {supplements.length === 0 && (
              <Animated.View entering={FadeInDown} style={styles.empty}>
                <Icon name="medication" size={28} color="#8A7E72" />
                <Text style={styles.emptyTitle}>Nothing on your list yet</Text>
                <Text style={styles.emptyText}>
                  Add the supplements and medicines you take. Set the time and how often, and they will remind you.
                </Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
                  <Text style={styles.emptyBtnText}>Add supplement or medicine</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {todayItems.length > 0 && (
              <>
                <Text style={styles.groupLabel}>Today</Text>
                {todayItems.map((s, i) => (
                  <Animated.View key={s.id} entering={FadeInDown.delay(i * 40)}>
                    <Row s={s} isToday={true} />
                  </Animated.View>
                ))}
              </>
            )}

            {otherItems.length > 0 && (
              <>
                <Text style={styles.groupLabel}>Other days</Text>
                {otherItems.map((s, i) => (
                  <Animated.View key={s.id} entering={FadeInDown.delay(i * 40)}>
                    <Row s={s} isToday={false} />
                  </Animated.View>
                ))}
              </>
            )}

            {supplements.length > 0 && (
              <TouchableOpacity style={styles.addRow} onPress={openAdd}>
                <Icon name="add" size={18} color="#5C7340" />
                <Text style={styles.addRowText}>Add supplement or medicine</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 60 }} />
          </>
        )}
      </ScrollView>

      {/* Slide-up form sheet */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={closeForm}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editing ? 'Edit' : 'Add supplement or medicine'}</Text>
              <TouchableOpacity onPress={closeForm} style={styles.sheetClose}>
                <Icon name="close" size={20} color="#8A7E72" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.segment}>
                <TouchableOpacity style={[styles.segBtn, kind === 'supplement' && styles.segBtnActive]} onPress={() => setKind('supplement')}>
                  <Text style={[styles.segText, kind === 'supplement' && styles.segTextActive]}>Supplement</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.segBtn, kind === 'medication' && styles.segBtnActive]} onPress={() => setKind('medication')}>
                  <Text style={[styles.segText, kind === 'medication' && styles.segTextActive]}>Medicine</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder={kind === 'medication' ? 'e.g. Metformin, Diane-35' : 'e.g. Vitamin D, Omega-3'}
                placeholderTextColor="#A89E90"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.fieldLabel}>Dosage (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 500mg, 1 tablet"
                placeholderTextColor="#A89E90"
                value={dosage}
                onChangeText={setDosage}
              />

              <Text style={styles.fieldLabel}>Time</Text>
              <TouchableOpacity style={styles.timeField} onPress={() => setShowPicker((v) => !v)}>
                <Text style={styles.timeValue}>{dateTo12h(timeDate)}</Text>
                <Text style={styles.timeHint}>{showPicker ? 'Done' : 'Tap to change'}</Text>
              </TouchableOpacity>
              {showPicker && (
                <View style={styles.pickerWrap}>
                  <DateTimePicker
                    value={timeDate}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selected) => {
                      if (Platform.OS === 'android') setShowPicker(false)
                      if (selected) setTimeDate(selected)
                    }}
                  />
                </View>
              )}

              <Text style={styles.fieldLabel}>How often</Text>
              <View style={styles.segment}>
                <TouchableOpacity style={[styles.segBtn, frequency === 'daily' && styles.segBtnActive]} onPress={() => setFrequency('daily')}>
                  <Text style={[styles.segText, frequency === 'daily' && styles.segTextActive]}>Every day</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.segBtn, frequency === 'specific_days' && styles.segBtnActive]} onPress={() => setFrequency('specific_days')}>
                  <Text style={[styles.segText, frequency === 'specific_days' && styles.segTextActive]}>Specific days</Text>
                </TouchableOpacity>
              </View>

              {frequency === 'specific_days' && (
                <View style={styles.daysRow}>
                  {DAY_MINI.map((label, i) => (
                    <TouchableOpacity key={i} style={[styles.dayBtn, days.includes(i) && styles.dayBtnActive]} onPress={() => toggleDay(i)}>
                      <Text style={[styles.dayText, days.includes(i) && styles.dayTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>With meals</Text>
              <View style={styles.chipRow}>
                {([['none', 'Anytime'], ['before_meal', 'Before meal'], ['after_meal', 'After meal']] as [Meal, string][]).map(([val, label]) => (
                  <TouchableOpacity key={val} style={[styles.chip, mealRelation === val && styles.chipActive]} onPress={() => setMealRelation(val)}>
                    <Text style={[styles.chipText, mealRelation === val && styles.chipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Reason (optional)</Text>
              <View style={styles.chipRow}>
                {REASONS.map((r) => (
                  <TouchableOpacity key={r} style={[styles.chip, reason === r && styles.chipActive]} onPress={() => setReason(r)}>
                    <Text style={[styles.chipText, reason === r && styles.chipTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                placeholder="Or type your own reason"
                placeholderTextColor="#A89E90"
                value={reason}
                onChangeText={setReason}
              />

              <View style={styles.formActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeForm}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveSupplement} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                    <Text style={styles.saveBtnText}>{editing ? 'Save' : 'Add to list'}</Text>
                  )}
                </TouchableOpacity>
              </View>
              <View style={{ height: 12 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F2EC' },
  header: {
    backgroundColor: 'rgba(245,242,236,0.92)', borderBottomWidth: 1, borderBottomColor: 'rgba(229,223,211,0.8)',
    paddingTop: 60, paddingBottom: 16, paddingHorizontal: 24,
  },
  backBtn: { marginBottom: 10 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 16, color: '#5C7340', fontWeight: '600' },
  title: { fontFamily: 'Georgia', fontSize: 22, color: '#3D3229', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#8A7E72', lineHeight: 18 },
  content: { flex: 1, padding: 16 },

  summary: {
    backgroundColor: 'rgba(245,242,236,0.9)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(229,223,211,0.7)',
    padding: 16, marginBottom: 14,
  },
  summaryTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  summaryBig: { fontFamily: 'Georgia', fontSize: 24, color: '#5C7340' },
  summarySub: { fontSize: 12, color: '#8A7E72', marginTop: 2 },
  dueBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F5E2D8', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  dueBadgeText: { fontSize: 12, fontWeight: '700', color: '#B5451B' },
  doneBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EBEFE3', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  doneBadgeText: { fontSize: 12, fontWeight: '700', color: '#5C7340' },
  progressTrack: { height: 10, borderRadius: 6, backgroundColor: '#EDE7DB', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 6, backgroundColor: '#5C7340' },
  progressLabel: { fontSize: 12, color: '#8A7E72', marginTop: 8, fontWeight: '600' },

  groupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#8A7E72', marginBottom: 10, marginTop: 6 },

  empty: { backgroundColor: 'rgba(245,242,236,0.9)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(229,223,211,0.7)', padding: 24, alignItems: 'center', marginTop: 10 },
  emptyTitle: { fontFamily: 'Georgia', fontSize: 17, color: '#3D3229', marginTop: 12, marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#8A7E72', textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  emptyBtn: { backgroundColor: '#5C7340', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 13 },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(245,242,236,0.9)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(229,223,211,0.7)',
    padding: 14, marginBottom: 10, gap: 12,
  },
  rowDoctor: { borderLeftWidth: 3, borderLeftColor: '#7B4B94' },
  check: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#C9C0B0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkOn: { backgroundColor: '#5C7340', borderColor: '#5C7340' },
  checkMuted: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0EBE1' },
  rowInfo: { flex: 1 },
  rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  rowName: { fontSize: 15, fontWeight: '600', color: '#3D3229' },
  rowNameTaken: { color: '#8A7E72', textDecorationLine: 'line-through' },
  kindBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  kindSupp: { backgroundColor: '#EBEFE3' },
  kindMed: { backgroundColor: '#EFE7F2' },
  kindBadgeText: { fontSize: 10, fontWeight: '700' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  rowDosage: { fontSize: 12, color: '#8A7E72' },
  rowTime: { fontSize: 12, color: '#5A4A38', fontWeight: '600' },
  tagMeal: { fontSize: 11, color: '#5A4A38', backgroundColor: '#F0EBE1', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tagFreq: { fontSize: 11, color: '#8A7E72', backgroundColor: '#F0EBE1', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tagDue: { fontSize: 11, fontWeight: '700', color: '#B5451B', backgroundColor: '#F5E2D8', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tagTaken: { fontSize: 11, fontWeight: '700', color: '#5C7340', backgroundColor: '#EBEFE3', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tagReason: { fontSize: 11, color: '#5A4A38', backgroundColor: '#F6EDDA', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  rxTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFE7F2', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  rxTagText: { fontSize: 11, fontWeight: '600', color: '#7B4B94' },
  rowActions: { flexDirection: 'column', gap: 6 },
  actionBtn: { padding: 6 },
  lockNote: { paddingHorizontal: 6, justifyContent: 'center' },

  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(229,223,211,0.8)', borderStyle: 'dashed', marginTop: 2, backgroundColor: 'rgba(245,242,236,0.55)' },
  addRowText: { fontSize: 14, fontWeight: '600', color: '#5C7340' },

  // Sheet
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#F5F2EC', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 10, maxHeight: '90%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D8D0C2', alignSelf: 'center', marginBottom: 10 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sheetTitle: { fontFamily: 'Georgia', fontSize: 18, color: '#3D3229' },
  sheetClose: { padding: 6 },
  sheetScroll: { paddingTop: 4 },

  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#8A7E72', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5DFD3', borderRadius: 10, padding: 13, fontSize: 15, color: '#3D3229' },

  segment: { flexDirection: 'row', backgroundColor: '#EAE3D6', borderRadius: 12, padding: 4, gap: 4 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segBtnActive: { backgroundColor: '#3D3229' },
  segText: { fontSize: 13, fontWeight: '600', color: '#8A7E72' },
  segTextActive: { color: '#fff' },

  timeField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E5DFD3', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff' },
  timeValue: { fontFamily: 'Georgia', fontSize: 22, color: '#5C7340' },
  timeHint: { fontSize: 12, color: '#8A7E72', fontWeight: '600' },
  pickerWrap: { marginTop: 6, alignItems: 'center' },

  daysRow: { flexDirection: 'row', gap: 6, marginTop: 10, justifyContent: 'space-between' },
  dayBtn: { flex: 1, aspectRatio: 1, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5DFD3', alignItems: 'center', justifyContent: 'center' },
  dayBtnActive: { backgroundColor: '#5C7340', borderColor: '#5C7340' },
  dayText: { fontSize: 12, fontWeight: '700', color: '#8A7E72' },
  dayTextActive: { color: '#fff' },

  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5DFD3' },
  chipActive: { backgroundColor: '#3D3229', borderColor: '#3D3229' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#8A7E72' },
  chipTextActive: { color: '#fff' },

  formActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E5DFD3', alignItems: 'center', backgroundColor: '#fff' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#8A7E72' },
  saveBtn: { flex: 2, backgroundColor: '#5C7340', padding: 14, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
})