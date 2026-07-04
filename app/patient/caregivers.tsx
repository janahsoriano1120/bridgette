import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import Icon from '../../components/Icon'

const PAID_PLANS = ['basic', 'premium', 'couple', 'family']

type Tier = 'view_only' | 'elevated' | 'representative'
type Status = 'pending' | 'active' | 'revoked'

type CaregiverLink = {
  id: string
  caregiver_email: string
  caregiver_name: string | null
  tier: Tier
  can_chat_providers: boolean
  status: Status
}

const TIERS: { key: Tier; label: string; desc: string }[] = [
  { key: 'view_only', label: 'View only', desc: 'Can see your health record. Cannot make changes.' },
  { key: 'elevated', label: 'Can help log', desc: 'Can see your record and log for you. You get notified.' },
  { key: 'representative', label: 'Full representative', desc: 'Can manage your record for you, for when you cannot do it yourself.' },
]

function tierLabel(t: Tier) {
  if (t === 'elevated') return 'Can log'
  if (t === 'representative') return 'Representative'
  return 'View only'
}

export default function CaregiversScreen({ onBack }: { onBack: () => void }) {
  const session = useAuthStore((state) => state.session)

  const [plan, setPlan] = useState<string>('free')
  const [links, setLinks] = useState<CaregiverLink[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CaregiverLink | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [tier, setTier] = useState<Tier>('view_only')
  const [canChat, setCanChat] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    const userId = session?.user.id
    if (!userId) return
    try {
      const profRes = await supabase.from('profiles').select('plan').eq('id', userId).single()
      if (profRes.data?.plan) setPlan(profRes.data.plan)
    } catch (e) {
      setPlan('free')
    }
    const { data } = await supabase
      .from('caregiver_links')
      .select('id, caregiver_email, caregiver_name, tier, can_chat_providers, status')
      .eq('patient_id', userId)
      .neq('status', 'revoked')
      .order('created_at', { ascending: true })
    if (data) setLinks(data as CaregiverLink[])
    setLoading(false)
  }

  const isPaid = PAID_PLANS.includes(plan)

  function openAdd() {
    setEditing(null)
    setName('')
    setEmail('')
    setTier('view_only')
    setCanChat(false)
    setShowForm(true)
  }

  function openEdit(l: CaregiverLink) {
    setEditing(l)
    setName(l.caregiver_name || '')
    setEmail(l.caregiver_email)
    setTier(l.tier)
    setCanChat(l.can_chat_providers)
    setShowForm(true)
  }

  async function save() {
    const cleanEmail = email.trim().toLowerCase()
    if (!editing && !cleanEmail.includes('@')) {
      Alert.alert('Enter a valid email', 'We use this to connect their Bridgette account to yours.')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await supabase
          .from('caregiver_links')
          .update({ caregiver_name: name.trim() || null, tier, can_chat_providers: canChat })
          .eq('id', editing.id)
      } else {
        const { error } = await supabase.from('caregiver_links').insert({
          patient_id: session?.user.id,
          caregiver_email: cleanEmail,
          caregiver_name: name.trim() || null,
          tier,
          can_chat_providers: canChat,
          status: 'pending',
        })
        if (error) {
          if ((error as any).code === '23505') {
            Alert.alert('Already invited', 'You already have an invite or caregiver for that email.')
          } else {
            Alert.alert('Could not send invite', 'Please try again.')
          }
          setSaving(false)
          return
        }
      }
      setShowForm(false)
      setEditing(null)
      await fetchAll()
    } finally {
      setSaving(false)
    }
  }

  function revoke(l: CaregiverLink) {
    const who = l.caregiver_name || l.caregiver_email
    Alert.alert('Remove this caregiver?', `${who} will lose access to your record.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await supabase.from('caregiver_links').update({ status: 'revoked' }).eq('id', l.id)
          await fetchAll()
        },
      },
    ])
  }

  function TierBadge({ t }: { t: Tier }) {
    const map: Record<Tier, { bg: string; color: string }> = {
      view_only: { bg: '#EBEFE3', color: '#5C7340' },
      elevated: { bg: '#F6EDDA', color: '#C4922A' },
      representative: { bg: '#EFE7F2', color: '#7B4B94' },
    }
    const s = map[t]
    return (
      <View style={[styles.badge, { backgroundColor: s.bg }]}>
        <Text style={[styles.badgeText, { color: s.color }]}>{tierLabel(t)}</Text>
      </View>
    )
  }

  function Row({ l }: { l: CaregiverLink }) {
    return (
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Icon name="careteam" size={18} color="#8A7E72" />
        </View>
        <View style={styles.rowInfo}>
          <View style={styles.rowNameLine}>
            <Text style={styles.rowName}>{l.caregiver_name || l.caregiver_email}</Text>
            <TierBadge t={l.tier} />
          </View>
          <View style={styles.rowMeta}>
            {l.caregiver_name ? <Text style={styles.rowEmail}>{l.caregiver_email}</Text> : null}
            {l.can_chat_providers && (
              <View style={styles.chatTag}>
                <Icon name="doctor" size={11} color="#5C7340" />
                <Text style={styles.chatTagText}>Can message doctors</Text>
              </View>
            )}
            {l.status === 'pending' && <Text style={styles.pendingTag}>Invite sent</Text>}
          </View>
        </View>
        <View style={styles.rowActions}>
          <TouchableOpacity onPress={() => openEdit(l)} style={styles.actionBtn}>
            <Icon name="edit" size={16} color="#8A7E72" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => revoke(l)} style={styles.actionBtn}>
            <Icon name="delete" size={16} color="#B5451B" />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const activeLinks = links.filter((l) => l.status === 'active')
  const pendingLinks = links.filter((l) => l.status === 'pending')

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <View style={styles.backRow}>
            <Icon name="back" size={18} color="#5C7340" />
            <Text style={styles.backText}>Back</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>Caregivers</Text>
        <Text style={styles.subtitle}>Your tagapag-alaga. You choose what each one can see and do.</Text>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <ActivityIndicator color="#5C7340" style={{ marginTop: 40 }} />
        ) : !isPaid ? (
          <Animated.View entering={FadeInDown} style={styles.gate}>
            <Icon name="lock" size={26} color="#8A7E72" />
            <Text style={styles.gateTitle}>Caregivers need a paid plan</Text>
            <Text style={styles.gateText}>
              Adding a caregiver is an add-on of 99 pesos a month each, available on Basic and up. Upgrade your plan to invite someone to help manage your health.
            </Text>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={FadeInDown} style={styles.explainer}>
              <Text style={styles.explainerText}>
                A caregiver helps you manage your health. You decide their access, and you can change or remove it anytime. Everything they do is shown as from them, not you.
              </Text>
            </Animated.View>

            {activeLinks.length > 0 && (
              <>
                <Text style={styles.groupLabel}>Caregivers</Text>
                {activeLinks.map((l, i) => (
                  <Animated.View key={l.id} entering={FadeInDown.delay(i * 40)}>
                    <Row l={l} />
                  </Animated.View>
                ))}
              </>
            )}

            {pendingLinks.length > 0 && (
              <>
                <Text style={styles.groupLabel}>Pending invites</Text>
                {pendingLinks.map((l, i) => (
                  <Animated.View key={l.id} entering={FadeInDown.delay(i * 40)}>
                    <Row l={l} />
                  </Animated.View>
                ))}
              </>
            )}

            {links.length === 0 && !showForm && (
              <Animated.View entering={FadeInDown} style={styles.empty}>
                <Icon name="careteam" size={28} color="#8A7E72" />
                <Text style={styles.emptyTitle}>No caregivers yet</Text>
                <Text style={styles.emptyText}>
                  Invite a family member or helper. They accept from their own Bridgette account, then see your record at the level you choose.
                </Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
                  <Text style={styles.emptyBtnText}>Invite a caregiver</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {links.length > 0 && !showForm && (
              <TouchableOpacity style={styles.addRow} onPress={openAdd}>
                <Icon name="add" size={18} color="#5C7340" />
                <Text style={styles.addRowText}>Invite another</Text>
              </TouchableOpacity>
            )}

            {!showForm && <Text style={styles.priceNote}>Each caregiver is 99 pesos a month, added to your plan.</Text>}

            {showForm && (
              <Animated.View entering={FadeInDown} style={styles.form}>
                <Text style={styles.formTitle}>{editing ? 'Edit caregiver' : 'Invite a caregiver'}</Text>

                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Mama, Ate Joy"
                  placeholderTextColor="#A89E90"
                  value={name}
                  onChangeText={setName}
                />

                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  style={[styles.input, editing && styles.inputDisabled]}
                  placeholder="their@email.com"
                  placeholderTextColor="#A89E90"
                  value={email}
                  onChangeText={setEmail}
                  editable={!editing}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {editing ? <Text style={styles.hint}>Email cannot be changed on an existing invite.</Text> : null}

                <Text style={styles.fieldLabel}>What they can do</Text>
                {TIERS.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.tierCard, tier === t.key && styles.tierCardActive]}
                    onPress={() => setTier(t.key)}
                  >
                    <View style={[styles.radio, tier === t.key && styles.radioOn]}>
                      {tier === t.key && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tierName}>{t.label}</Text>
                      <Text style={styles.tierDesc}>{t.desc}</Text>
                    </View>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity style={styles.chatToggle} onPress={() => setCanChat((v) => !v)}>
                  <View style={[styles.checkbox, canChat && styles.checkboxOn]}>
                    {canChat && <Icon name="ok" size={12} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.chatToggleText}>Let them message your doctors</Text>
                    <Text style={styles.chatToggleSub}>Their messages show as from them, not you.</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(false); setEditing(null) }}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                      <Text style={styles.saveBtnText}>{editing ? 'Save' : 'Send invite'}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}

            <View style={{ height: 60 }} />
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F2EC' },
  header: {
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5DFD3',
    paddingTop: 60, paddingBottom: 16, paddingHorizontal: 24,
  },
  backBtn: { marginBottom: 10 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 16, color: '#5C7340', fontWeight: '600' },
  title: { fontFamily: 'Georgia', fontSize: 22, color: '#3D3229', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#8A7E72', lineHeight: 18 },
  content: { flex: 1, padding: 16 },

  gate: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5DFD3', padding: 24, alignItems: 'center', marginTop: 10 },
  gateTitle: { fontFamily: 'Georgia', fontSize: 17, color: '#3D3229', marginTop: 12, marginBottom: 6 },
  gateText: { fontSize: 13, color: '#8A7E72', textAlign: 'center', lineHeight: 20 },

  explainer: { backgroundColor: '#F0EBE1', borderRadius: 12, padding: 14, marginBottom: 14 },
  explainerText: { fontSize: 13, color: '#5A4A38', lineHeight: 20 },

  groupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#8A7E72', marginBottom: 10, marginTop: 6 },

  empty: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5DFD3', padding: 24, alignItems: 'center', marginTop: 6 },
  emptyTitle: { fontFamily: 'Georgia', fontSize: 17, color: '#3D3229', marginTop: 12, marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#8A7E72', textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  emptyBtn: { backgroundColor: '#5C7340', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 13 },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5DFD3',
    padding: 14, marginBottom: 10, gap: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0EBE1', alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1 },
  rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  rowName: { fontSize: 15, fontWeight: '600', color: '#3D3229' },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  rowEmail: { fontSize: 12, color: '#8A7E72' },
  chatTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EBEFE3', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  chatTagText: { fontSize: 11, fontWeight: '600', color: '#5C7340' },
  pendingTag: { fontSize: 11, fontWeight: '700', color: '#C4922A', backgroundColor: '#F6EDDA', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  rowActions: { flexDirection: 'column', gap: 6 },
  actionBtn: { padding: 6 },

  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5DFD3', borderStyle: 'dashed', marginTop: 2 },
  addRowText: { fontSize: 14, fontWeight: '600', color: '#5C7340' },
  priceNote: { fontSize: 12, color: '#8A7E72', textAlign: 'center', marginTop: 12 },

  form: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5DFD3', padding: 18, marginTop: 4 },
  formTitle: { fontFamily: 'Georgia', fontSize: 18, color: '#3D3229', marginBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#8A7E72', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5DFD3', borderRadius: 10, padding: 13, fontSize: 15, color: '#3D3229' },
  inputDisabled: { backgroundColor: '#F0EBE1', color: '#8A7E72' },
  hint: { fontSize: 11, color: '#A89E90', marginTop: 6 },

  tierCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderColor: '#E5DFD3', borderRadius: 12, padding: 14, marginBottom: 8 },
  tierCardActive: { borderColor: '#5C7340', backgroundColor: '#F7F9F4' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#C9C0B0', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioOn: { borderColor: '#5C7340' },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#5C7340' },
  tierName: { fontSize: 15, fontWeight: '600', color: '#3D3229', marginBottom: 2 },
  tierDesc: { fontSize: 12, color: '#8A7E72', lineHeight: 17 },

  chatToggle: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 18 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#C9C0B0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', marginTop: 1 },
  checkboxOn: { backgroundColor: '#5C7340', borderColor: '#5C7340' },
  chatToggleText: { fontSize: 14, color: '#3D3229', fontWeight: '600' },
  chatToggleSub: { fontSize: 12, color: '#8A7E72', marginTop: 2, lineHeight: 17 },

  formActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E5DFD3', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#8A7E72' },
  saveBtn: { flex: 2, backgroundColor: '#5C7340', padding: 14, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
})
