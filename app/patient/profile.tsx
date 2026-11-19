import { useContext } from 'react'
import { EmbeddedCtx } from '../../lib/embedded'
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import Icon from '../../components/Icon'
import ScreenBackground from '../../components/ScreenBackground'

const GREEN = '#2F4A1E'
const INK = '#383A33'
const MUTED = '#5B6650'

type Form = {
  full_name: string
  date_of_birth: string
  sex_assigned_at_birth: '' | 'male' | 'female'
  city: string
  phone: string
  emergency_contact_name: string
  emergency_contact_phone: string
}

type FamilyItem = { condition: string; relative: string }
type YesNo = 'yes' | 'no' | ''

type Health = {
  no_allergies: boolean
  family_history: FamilyItem[]
  family_none: boolean
  ob_g: string
  ob_p: string
  ob_t: string
  ob_pt: string
  ob_a: string
  ob_l: string
  pregnant: YesNo
  lmp: string
  lactating: YesNo
  periods: string[]
}

const EMPTY: Form = { full_name: '', date_of_birth: '', sex_assigned_at_birth: '', city: '', phone: '', emergency_contact_name: '', emergency_contact_phone: '' }
const EMPTY_HEALTH: Health = { no_allergies: false, family_history: [], family_none: false, ob_g: '', ob_p: '', ob_t: '', ob_pt: '', ob_a: '', ob_l: '', pregnant: '', lmp: '', lactating: '', periods: [] }

const FAMILY_CONDITIONS = ['Diabetes', 'Hypertension', 'Heart disease', 'Stroke', 'Cancer', 'Asthma', 'Kidney disease', 'Thyroid disease']
const RELATIVES = ['Mother', 'Father', 'Sibling', 'Grandparent']

function initialsOf(name: string) {
  return name.replace(/^(dr\.?|doc)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'B'
}

function validDate(s: string) {
  if (!s) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00')
  return !isNaN(d.getTime()) && d.getTime() <= Date.now() && d.getFullYear() > 1900
}

function daysBetween(from: string, to: Date) {
  const a = new Date(from + 'T00:00:00').getTime()
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime()
  return Math.round((b - a) / 86400000)
}

function niceDate(s: string) {
  const d = new Date(s + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function numOrNull(s: string) {
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

function strOf(v: any) {
  return v === null || v === undefined ? '' : String(v)
}

export default function ProfileScreen({ onBack, onOpen }: { onBack: () => void; onOpen?: (t: 'allergies') => void }) {
  const embedded = useContext(EmbeddedCtx)
  const session = useAuthStore((s) => s.session)
  const profile = useAuthStore((s) => s.profile)
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const userId = session?.user.id
  const [form, setForm] = useState<Form>(EMPTY)
  const [health, setHealth] = useState<Health>(EMPTY_HEALTH)
  const [allergyCount, setAllergyCount] = useState(0)
  const [famCondition, setFamCondition] = useState('')
  const [famRelative, setFamRelative] = useState('')
  const [periodInput, setPeriodInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      if (!userId) { setLoading(false); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      if (!alive) return
      const d: any = data || {}
      setForm({
        full_name: d.full_name || '',
        date_of_birth: d.date_of_birth || '',
        sex_assigned_at_birth: d.sex_assigned_at_birth || '',
        city: d.city || '',
        phone: d.phone || '',
        emergency_contact_name: d.emergency_contact_name || '',
        emergency_contact_phone: d.emergency_contact_phone || '',
      })
      const st = d.settings || {}
      const h = st.health || {}
      const ob = h.ob_score || {}
      setHealth({
        no_allergies: !!h.no_allergies,
        family_history: Array.isArray(h.family_history) ? h.family_history : [],
        family_none: !!h.family_none,
        ob_g: strOf(ob.g), ob_p: strOf(ob.p), ob_t: strOf(ob.t), ob_pt: strOf(ob.pt), ob_a: strOf(ob.a), ob_l: strOf(ob.l),
        pregnant: h.pregnant === true ? 'yes' : h.pregnant === false ? 'no' : '',
        lmp: h.lmp || '',
        lactating: h.lactating === true ? 'yes' : h.lactating === false ? 'no' : '',
        periods: Array.isArray(h.periods) ? h.periods : [],
      })
      const a = Array.isArray(st.allergies) ? st.allergies.length : 0
      const m = Array.isArray(st.med_allergies) ? st.med_allergies.length : 0
      setAllergyCount(a + m)
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [userId])

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }))
    setDirty(true)
  }

  function setH<K extends keyof Health>(k: K, v: Health[K]) {
    setHealth((h) => ({ ...h, [k]: v }))
    setDirty(true)
  }

  function addFamily() {
    const condition = famCondition.trim()
    if (!condition) { Alert.alert('Add a condition', 'For example: Diabetes.'); return }
    setHealth((h) => ({ ...h, family_none: false, family_history: [...h.family_history, { condition, relative: famRelative.trim() }] }))
    setFamCondition('')
    setFamRelative('')
    setDirty(true)
  }

  function removeFamily(i: number) {
    setHealth((h) => ({ ...h, family_history: h.family_history.filter((_, j) => j !== i) }))
    setDirty(true)
  }

  function addPeriod() {
    const v = periodInput.trim()
    if (!v || !validDate(v)) { Alert.alert('Check the date', 'Use the format YYYY-MM-DD, for example 2026-11-02.'); return }
    if (health.periods.includes(v)) { setPeriodInput(''); return }
    setHealth((h) => ({ ...h, periods: [...h.periods, v].sort().reverse() }))
    setPeriodInput('')
    setDirty(true)
  }

  function removePeriod(v: string) {
    setHealth((h) => ({ ...h, periods: h.periods.filter((p) => p !== v) }))
    setDirty(true)
  }

  const isFemale = form.sex_assigned_at_birth === 'female'

  // Completion: one point per item, women's health items only for female profiles
  const checks: { label: string; done: boolean }[] = [
    { label: 'Full name', done: !!form.full_name.trim() },
    { label: 'Birthday', done: !!form.date_of_birth.trim() },
    { label: 'Sex assigned at birth', done: !!form.sex_assigned_at_birth },
    { label: 'City', done: !!form.city.trim() },
    { label: 'Mobile number', done: !!form.phone.trim() },
    { label: 'Emergency contact', done: !!form.emergency_contact_name.trim() && !!form.emergency_contact_phone.trim() },
    { label: 'Allergies', done: allergyCount > 0 || health.no_allergies },
    { label: 'Family history', done: health.family_history.length > 0 || health.family_none },
  ]
  if (isFemale) {
    checks.push(
      { label: 'Obstetrics score', done: health.ob_g !== '' && health.ob_p !== '' },
      { label: 'Pregnancy', done: health.pregnant === 'no' || (health.pregnant === 'yes' && !!health.lmp) },
      { label: 'Lactating', done: health.lactating !== '' },
      { label: 'Period tracking', done: health.pregnant === 'yes' || health.periods.length > 0 },
    )
  }
  const doneCount = checks.filter((c) => c.done).length
  const percent = Math.round((doneCount / checks.length) * 100)
  const missing = checks.filter((c) => !c.done).map((c) => c.label)

  // Pregnancy age, counted from the first day of the last period
  let aogText = ''
  if (health.pregnant === 'yes' && health.lmp && validDate(health.lmp)) {
    const days = daysBetween(health.lmp, new Date())
    if (days >= 0 && days <= 300) {
      const w = Math.floor(days / 7)
      const d = days % 7
      const due = new Date(new Date(health.lmp + 'T00:00:00').getTime() + 280 * 86400000)
      aogText = `${w} week${w === 1 ? '' : 's'}${d ? ` ${d} day${d === 1 ? '' : 's'}` : ''} along. Due around ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`
    }
  }

  // Average cycle length from logged period starts
  let cycleText = ''
  if (health.periods.length >= 2) {
    const sorted = [...health.periods].sort()
    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i++) gaps.push(daysBetween(sorted[i - 1], new Date(sorted[i] + 'T00:00:00')))
    const avg = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
    cycleText = `Average cycle: ${avg} days, from ${sorted.length} periods logged.`
  }

  async function save() {
    if (!userId) return
    if (!form.full_name.trim()) { Alert.alert('Name needed', 'Please add your full name.'); return }
    if (!validDate(form.date_of_birth.trim())) { Alert.alert('Check your birthday', 'Use the format YYYY-MM-DD, for example 1995-03-24.'); return }
    if (health.pregnant === 'yes' && health.lmp && !validDate(health.lmp.trim())) { Alert.alert('Check the date', 'First day of your last period: use YYYY-MM-DD.'); return }
    setSaving(true)
    const { data: cur } = await supabase.from('profiles').select('settings').eq('id', userId).maybeSingle()
    const currentSettings = ((cur as any)?.settings || {}) as Record<string, any>
    const healthPayload = {
      no_allergies: health.no_allergies,
      family_history: health.family_history,
      family_none: health.family_none,
      ob_score: {
        g: numOrNull(health.ob_g), p: numOrNull(health.ob_p), t: numOrNull(health.ob_t),
        pt: numOrNull(health.ob_pt), a: numOrNull(health.ob_a), l: numOrNull(health.ob_l),
      },
      pregnant: health.pregnant === '' ? null : health.pregnant === 'yes',
      lmp: health.pregnant === 'yes' ? (health.lmp.trim() || null) : null,
      lactating: health.lactating === '' ? null : health.lactating === 'yes',
      periods: health.periods,
      updated_at: new Date().toISOString(),
    }
    const payload: any = {
      full_name: form.full_name.trim(),
      date_of_birth: form.date_of_birth.trim() || null,
      sex_assigned_at_birth: form.sex_assigned_at_birth || null,
      city: form.city.trim() || null,
      phone: form.phone.trim() || null,
      emergency_contact_name: form.emergency_contact_name.trim() || null,
      emergency_contact_phone: form.emergency_contact_phone.trim() || null,
      onboarding_completion_percent: percent,
      settings: { ...currentSettings, health: healthPayload },
    }
    const { error } = await supabase.from('profiles').update(payload).eq('id', userId)
    setSaving(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    setDirty(false)
    fetchProfile(userId)
    Alert.alert('Saved', 'Your profile is up to date.')
  }

  const name = form.full_name || profile?.full_name || ''
  const plan = (profile?.subscription_tier || 'free').toString()
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1)

  return (
    <View style={s.root}>
      <ScreenBackground />
      <View style={[s.header, embedded && { display: 'none' }]}>
        <TouchableOpacity onPress={onBack} style={s.roundBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="back" size={20} color={GREEN} />
        </TouchableOpacity>
        <Text style={s.title}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={GREEN} style={{ marginTop: 40 }} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={s.hero}>
              <View style={s.avatar}><Text style={s.avatarText}>{initialsOf(name)}</Text></View>
              <Text style={s.heroName} numberOfLines={1}>{name || 'Your name'}</Text>
              <Text style={s.heroSub} numberOfLines={1}>{session?.user.email}</Text>
              <View style={s.planPill}><Text style={s.planText}>{planLabel} plan</Text></View>
            </View>

            <View style={[s.card, { marginTop: 12 }]}>
              <View style={s.meterRow}>
                <Text style={s.meterTitle}>Profile {percent}% complete</Text>
                <Text style={s.meterCount}>{doneCount} of {checks.length}</Text>
              </View>
              <View style={s.meterTrack}><View style={[s.meterFill, { width: `${percent}%` }]} /></View>
              {missing.length > 0 ? (
                <Text style={s.hint}>Still to add: {missing.join(', ')}. A complete profile gives your doctors the full story when you share.</Text>
              ) : (
                <Text style={s.hint}>All set. Your doctors see the full story when you share.</Text>
              )}
            </View>

            <Text style={s.section}>About you</Text>
            <View style={s.card}>
              <Field label="Full name" value={form.full_name} onChangeText={(v) => set('full_name', v)} placeholder="Juan Dela Cruz" autoCapitalize="words" />
              <Field label="Birthday" value={form.date_of_birth} onChangeText={(v) => set('date_of_birth', v)} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} />
              <Text style={s.label}>Sex assigned at birth</Text>
              <View style={s.chips}>
                {(['female', 'male'] as const).map((v) => (
                  <TouchableOpacity key={v} style={[s.chip, form.sex_assigned_at_birth === v && s.chipOn]} onPress={() => set('sex_assigned_at_birth', form.sex_assigned_at_birth === v ? '' : v)}>
                    <Text style={[s.chipText, form.sex_assigned_at_birth === v && s.chipTextOn]}>{v === 'female' ? 'Female' : 'Male'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Field label="City" value={form.city} onChangeText={(v) => set('city', v)} placeholder="Pasig" autoCapitalize="words" last />
            </View>

            <Text style={s.section}>Contact</Text>
            <View style={s.card}>
              <Field label="Mobile number" value={form.phone} onChangeText={(v) => set('phone', v)} placeholder="09XX XXX XXXX" keyboardType="phone-pad" last />
            </View>

            <Text style={s.section}>Emergency contact</Text>
            <View style={s.card}>
              <Text style={s.hint}>Someone your care team can reach if you cannot respond. Only you and the doctors you connect with can see this.</Text>
              <Field label="Name" value={form.emergency_contact_name} onChangeText={(v) => set('emergency_contact_name', v)} placeholder="Maria Dela Cruz" autoCapitalize="words" />
              <Field label="Mobile number" value={form.emergency_contact_phone} onChangeText={(v) => set('emergency_contact_phone', v)} placeholder="09XX XXX XXXX" keyboardType="phone-pad" last />
            </View>

            <Text style={s.section}>Allergies</Text>
            <View style={s.card}>
              <TouchableOpacity style={s.linkRow} onPress={() => onOpen?.('allergies')} accessibilityRole="button">
                <View style={{ flex: 1 }}>
                  <Text style={s.linkTitle}>{allergyCount > 0 ? `${allergyCount} allerg${allergyCount === 1 ? 'y' : 'ies'} saved` : 'Add your allergies'}</Text>
                  <Text style={s.linkSub}>Food and medicine allergies</Text>
                </View>
                <Icon name="forward" size={18} color={GREEN} />
              </TouchableOpacity>
              {allergyCount === 0 && (
                <TouchableOpacity style={[s.chip, { alignSelf: 'flex-start', marginTop: 12 }, health.no_allergies && s.chipOn]} onPress={() => setH('no_allergies', !health.no_allergies)}>
                  <Text style={[s.chipText, health.no_allergies && s.chipTextOn]}>No known allergies</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={s.section}>Family history</Text>
            <View style={s.card}>
              <Text style={s.hint}>Conditions that run in your family, like diabetes or high blood pressure.</Text>
              {health.family_history.map((f, i) => (
                <View key={`${f.condition}-${i}`} style={s.listRow}>
                  <Text style={s.listText}>{f.condition}{f.relative ? `, ${f.relative}` : ''}</Text>
                  <TouchableOpacity onPress={() => removeFamily(i)} accessibilityRole="button" accessibilityLabel={`Remove ${f.condition}`}>
                    <Icon name="close" size={18} color={MUTED} />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={[s.chips, { flexWrap: 'wrap' }]}>
                {FAMILY_CONDITIONS.map((c) => (
                  <TouchableOpacity key={c} style={[s.chipSm, famCondition === c && s.chipOn]} onPress={() => setFamCondition(famCondition === c ? '' : c)}>
                    <Text style={[s.chipSmText, famCondition === c && s.chipTextOn]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Field label="Condition" value={famCondition} onChangeText={setFamCondition} placeholder="Diabetes" autoCapitalize="sentences" />
              <Text style={s.label}>Who in your family</Text>
              <View style={[s.chips, { flexWrap: 'wrap' }]}>
                {RELATIVES.map((r) => (
                  <TouchableOpacity key={r} style={[s.chipSm, famRelative === r && s.chipOn]} onPress={() => setFamRelative(famRelative === r ? '' : r)}>
                    <Text style={[s.chipSmText, famRelative === r && s.chipTextOn]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={s.addBtn} onPress={addFamily}>
                <Icon name="add" size={16} color={GREEN} />
                <Text style={s.addText}>Add to family history</Text>
              </TouchableOpacity>
              {health.family_history.length === 0 && (
                <TouchableOpacity style={[s.chip, { alignSelf: 'flex-start', marginTop: 12 }, health.family_none && s.chipOn]} onPress={() => setH('family_none', !health.family_none)}>
                  <Text style={[s.chipText, health.family_none && s.chipTextOn]}>None that I know of</Text>
                </TouchableOpacity>
              )}
            </View>

            {isFemale && (
              <>
                <Text style={s.section}>Women's health</Text>
                <View style={s.card}>
                  <Text style={s.label}>Obstetrics score</Text>
                  <Text style={s.hint}>G is the number of pregnancies, P the number of births. T, P, A, L are term births, preterm births, miscarriages or abortions, and living children. Put 0 if none.</Text>
                  <View style={s.obRow}>
                    <ObField label="G" value={health.ob_g} onChange={(v) => setH('ob_g', v)} />
                    <ObField label="P" value={health.ob_p} onChange={(v) => setH('ob_p', v)} />
                  </View>
                  <View style={s.obRow}>
                    <ObField label="T" value={health.ob_t} onChange={(v) => setH('ob_t', v)} />
                    <ObField label="P" value={health.ob_pt} onChange={(v) => setH('ob_pt', v)} />
                    <ObField label="A" value={health.ob_a} onChange={(v) => setH('ob_a', v)} />
                    <ObField label="L" value={health.ob_l} onChange={(v) => setH('ob_l', v)} />
                  </View>

                  <Text style={[s.label, { marginTop: 8 }]}>Are you pregnant now?</Text>
                  <YesNoChips value={health.pregnant} onChange={(v) => setH('pregnant', v)} />
                  {health.pregnant === 'yes' && (
                    <>
                      <Field label="First day of your last period" value={health.lmp} onChangeText={(v) => setH('lmp', v)} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} />
                      {!!aogText && <Text style={s.calc}>{aogText}</Text>}
                    </>
                  )}

                  <Text style={s.label}>Are you breastfeeding now?</Text>
                  <YesNoChips value={health.lactating} onChange={(v) => setH('lactating', v)} />

                  {health.pregnant !== 'yes' && (
                    <>
                      <Text style={s.label}>Period tracking</Text>
                      <Text style={s.hint}>Log the first day of each period.</Text>
                      {health.periods.slice(0, 6).map((p) => (
                        <View key={p} style={s.listRow}>
                          <Text style={s.listText}>{niceDate(p)}</Text>
                          <TouchableOpacity onPress={() => removePeriod(p)} accessibilityRole="button" accessibilityLabel={`Remove ${p}`}>
                            <Icon name="close" size={18} color={MUTED} />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {!!cycleText && <Text style={s.calc}>{cycleText}</Text>}
                      <View style={s.periodRow}>
                        <TextInput value={periodInput} onChangeText={setPeriodInput} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} style={[s.input, { flex: 1 }]} placeholderTextColor="#9AA48E" />
                        <TouchableOpacity style={s.periodBtn} onPress={addPeriod}>
                          <Text style={s.periodBtnText}>Log</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              </>
            )}

            <TouchableOpacity style={[s.saveBtn, (!dirty || saving) && { opacity: 0.5 }]} disabled={!dirty || saving} onPress={save}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save changes</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  )
}

function Field({ label, last, ...props }: { label: string; last?: boolean } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: last ? 0 : 14 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput {...props} style={s.input} placeholderTextColor="#9AA48E" />
    </View>
  )
}

function ObField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[s.label, { textAlign: 'center' }]}>{label}</Text>
      <TextInput value={value} onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={2} style={[s.input, { textAlign: 'center' }]} placeholder="0" placeholderTextColor="#9AA48E" />
    </View>
  )
}

function YesNoChips({ value, onChange }: { value: YesNo; onChange: (v: YesNo) => void }) {
  return (
    <View style={s.chips}>
      {(['yes', 'no'] as const).map((v) => (
        <TouchableOpacity key={v} style={[s.chip, value === v && s.chipOn]} onPress={() => onChange(value === v ? '' : v)}>
          <Text style={[s.chipText, value === v && s.chipTextOn]}>{v === 'yes' ? 'Yes' : 'No'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F4EC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 10, paddingHorizontal: 16 },
  roundBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1, borderColor: 'rgba(47,74,30,0.12)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontFamily: 'DMSans-Medium', color: INK },
  hero: { alignItems: 'center', paddingVertical: 12 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#EEF3E6', borderWidth: 3, borderColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 28, fontFamily: 'DMSans-Medium', color: GREEN },
  heroName: { fontSize: 20, fontFamily: 'DMSans-Medium', color: INK, marginTop: 10 },
  heroSub: { fontSize: 13, color: MUTED, marginTop: 2 },
  planPill: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: '#EEF3E6', borderWidth: 1, borderColor: 'rgba(47,74,30,0.25)' },
  planText: { fontSize: 12, fontFamily: 'DMSans-Bold', color: GREEN },
  meterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  meterTitle: { fontSize: 16, fontFamily: 'DMSans-Medium', color: INK },
  meterCount: { fontSize: 12, fontFamily: 'DMSans-Bold', color: MUTED },
  meterTrack: { height: 8, borderRadius: 4, backgroundColor: '#E6EBDD', overflow: 'hidden', marginBottom: 12 },
  meterFill: { height: 8, borderRadius: 4, backgroundColor: GREEN },
  section: { fontSize: 13, fontFamily: 'DMSans-Bold', color: MUTED, marginTop: 18, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: 'rgba(255,255,255,0.78)', borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(47,74,30,0.35)', padding: 16 },
  hint: { fontSize: 12, color: MUTED, lineHeight: 18, marginBottom: 14 },
  label: { fontSize: 12, fontFamily: 'DMSans-Bold', color: MUTED, marginBottom: 6 },
  input: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(47,74,30,0.2)', backgroundColor: '#FFFFFF', paddingHorizontal: 12, fontSize: 15, color: INK },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(47,74,30,0.25)', backgroundColor: '#FFFFFF' },
  chipOn: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { fontSize: 14, fontFamily: 'DMSans-Bold', color: GREEN },
  chipTextOn: { color: '#FFFFFF' },
  chipSm: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(47,74,30,0.25)', backgroundColor: '#FFFFFF' },
  chipSmText: { fontSize: 13, fontFamily: 'DMSans-Bold', color: GREEN },
  linkRow: { flexDirection: 'row', alignItems: 'center' },
  linkTitle: { fontSize: 15, fontFamily: 'DMSans-Medium', color: INK },
  linkSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(47,74,30,0.1)', marginBottom: 8 },
  listText: { fontSize: 15, color: INK, flex: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: GREEN },
  addText: { fontSize: 14, fontFamily: 'DMSans-Bold', color: GREEN },
  obRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  calc: { fontSize: 14, fontFamily: 'DMSans-Medium', color: GREEN, marginBottom: 14 },
  periodRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  periodBtn: { height: 46, paddingHorizontal: 18, borderRadius: 12, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  periodBtnText: { fontSize: 14, fontFamily: 'DMSans-Medium', color: '#FFFFFF' },
  saveBtn: { marginTop: 22, height: 50, borderRadius: 14, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 15, fontFamily: 'DMSans-Medium', color: '#FFFFFF' },
})
