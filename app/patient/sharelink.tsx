import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
  Switch,
  Modal,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

type ShareLink = {
  id: string
  token: string
  label: string
  includes_lifestyle: boolean
  expires_at: string
  created_at: string
  is_active: boolean
}

type Doctor = {
  role: string
  name: string
  isMD: boolean
  recentConsult: string
  nextConsult: string
  emoji: string
  color: string
  bg: string
  consultations: Consultation[]
}

type Consultation = {
  date: string
  summary: string
  notes: string
  actionItems: string[]
}

const CARE_TEAM: Doctor[] = [
  {
    role: 'Family Doctor',
    name: 'Dr. David Lemuel del Prado',
    isMD: true,
    recentConsult: 'January 12, 2026',
    nextConsult: 'July 12, 2026',
    emoji: '🩺',
    color: '#3D7A5E',
    bg: '#EAF4EE',
    consultations: [
      {
        date: 'January 12, 2026',
        summary: 'Follow-up on dyslipidemia management. Patient reports improved dietary habits since stopping Diane-35. LDL still elevated at 154 mg/dL but trending down from December peak of 175 mg/dL. Blood pressure normal. Weight down 2kg.',
        notes: 'Patient tolerating lifestyle changes well. No new complaints. Discussed importance of continued low-saturated-fat diet. Reviewed latest CBC — MCH slightly low, monitoring for iron deficiency. Referred to nutritionist for meal planning.',
        actionItems: [
          'Repeat lipid panel in 3 months (April 2026)',
          'Continue low-saturated-fat diet',
          'Start iron-rich food supplementation',
          'Follow up with Beatrix Mercado (Nutritionist)',
          'Return if chest pain, palpitations, or severe headache',
        ],
      },
      {
        date: 'October 5, 2025',
        summary: 'Routine check-up. Patient on Diane-35 for 6 months. Lipids worsening — Total Cholesterol 218, LDL 148. Discussed pill-related dyslipidemia risk. Patient advised to consider stopping Diane-35.',
        notes: 'Patient reluctant to stop Diane-35 due to acne control. Educated on cardiovascular risk. Advised to consult OB-GYN for alternative contraception. Diet counseling initiated.',
        actionItems: [
          'Consult OB-GYN regarding Diane-35 alternatives',
          'Repeat lipid panel in 3 months',
          'Reduce fried food and processed meat intake',
          'Start regular aerobic exercise 3x per week',
        ],
      },
    ],
  },
  {
    role: 'Nutritionist',
    name: 'Beatrix Mercado',
    isMD: false,
    recentConsult: 'April 21, 2026',
    nextConsult: 'July 21, 2026',
    emoji: '🥗',
    color: '#B5720A',
    bg: '#FDF3E3',
    consultations: [
      {
        date: 'April 21, 2026',
        summary: 'Initial nutrition consultation. Reviewed food logs from Bridgette app. Patient eating high saturated fat diet — frequent fried foods, processed meats. Carb intake elevated. Protein and fiber low.',
        notes: 'Patient motivated to change. Set realistic meal plan targeting 25g fiber/day, lean protein at each meal, olive oil over palm oil. Discussed Filipino food alternatives — grilled liempo instead of lechon, brown rice, more vegetables.',
        actionItems: [
          'Follow Mediterranean-style meal plan provided',
          'Target 25g fiber per day',
          'Replace palm oil with olive oil for cooking',
          'Log all meals in Bridgette app daily',
          'Return in 3 months with food log summary',
        ],
      },
    ],
  },
  {
    role: 'Ophthalmologist',
    name: 'Dr. Jan Tan',
    isMD: true,
    recentConsult: 'December 6, 2025',
    nextConsult: 'June 6, 2026',
    emoji: '👁',
    color: '#2C5FAB',
    bg: '#EBF1FB',
    consultations: [
      {
        date: 'December 6, 2025',
        summary: 'Annual eye exam. Visual acuity 20/20 bilaterally. No diabetic retinopathy noted. Mild dry eye syndrome. Intraocular pressure normal. Fundus exam unremarkable.',
        notes: 'No concerning findings. Patient reports occasional eye strain from screen time. Discussed 20-20-20 rule. Prescribed lubricating eye drops. Noted that patient has borderline glucose — will monitor for early diabetic eye changes in future visits.',
        actionItems: [
          'Use lubricating eye drops twice daily',
          'Apply 20-20-20 rule during screen use',
          'Return in 6 months for routine follow-up',
          'Alert if sudden vision changes or eye pain',
        ],
      },
    ],
  },
]

type FilterType = 'all' | 'md' | 'nonmd'

export default function ShareLinkScreen({ onBack }: { onBack: () => void }) {
  const session = useAuthStore((state) => state.session)
  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')

  // View consultation modal
  const [showConsultModal, setShowConsultModal] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [selectedConsult, setSelectedConsult] = useState<Consultation | null>(null)

  // Bridgette share modal
  const [showBridgetteModal, setShowBridgetteModal] = useState(false)
  const [shareDoctor, setShareDoctor] = useState<Doctor | null>(null)
  const [includeLifestyle, setIncludeLifestyle] = useState(false)

  // External share modals
  const [showExternalModal, setShowExternalModal] = useState(false)
  const [showExternalLifestyleModal, setShowExternalLifestyleModal] = useState(false)
  const [consentChecked, setConsentChecked] = useState(false)
  const [includeLifestyleExternal, setIncludeLifestyleExternal] = useState(false)

  useEffect(() => {
    fetchLinks()
  }, [])

  async function fetchLinks() {
    const { data } = await supabase
      .from('share_links')
      .select('*')
      .eq('patient_id', session?.user.id)
      .order('created_at', { ascending: false })
    if (data) setLinks(data)
    setLoading(false)
  }

  function openConsultation(doctor: Doctor) {
    setSelectedDoctor(doctor)
    setSelectedConsult(doctor.consultations[0])
    setShowConsultModal(true)
  }

  function openBridgetteShare(doctor: Doctor) {
    setShareDoctor(doctor)
    setIncludeLifestyle(false)
    setShowBridgetteModal(true)
  }

  function openExternalShare() {
    setConsentChecked(false)
    setIncludeLifestyleExternal(false)
    setShowExternalModal(true)
  }

  async function handleBridgetteShare() {
    if (!shareDoctor) return
    setCreating(shareDoctor.name)
    setShowBridgetteModal(false)
    try {
      const existing = links.find(l => l.label === shareDoctor.name && l.is_active)
      let token = existing?.token
      if (!existing) {
        const { data, error } = await supabase
          .from('share_links')
          .insert({
            patient_id: session?.user.id,
            label: shareDoctor.name,
            includes_lifestyle: includeLifestyle,
            includes_diagnoses: false,
          })
          .select()
          .single()
        if (error) { Alert.alert('Error', error.message); return }
        token = data.token
        await fetchLinks()
      }
      const url = `https://bridgette.app/shared/${token}`
      await Share.share({
        message: `Here is my Bridgette health summary for your review — ${url}`,
        url,
        title: 'Bridgette Health Summary',
      })
    } catch (e) {
      Alert.alert('Error', 'Could not share link.')
    } finally {
      setCreating(null)
    }
  }

  function handleConsentProceed() {
    if (!consentChecked) {
      Alert.alert('Please check the box to confirm you understand and consent.')
      return
    }
    setShowExternalModal(false)
    setTimeout(() => setShowExternalLifestyleModal(true), 300)
  }

  async function handleExternalShare() {
    setCreating('external')
    setShowExternalLifestyleModal(false)
    try {
      const { data, error } = await supabase
        .from('share_links')
        .insert({
          patient_id: session?.user.id,
          label: 'External Provider',
          includes_lifestyle: includeLifestyleExternal,
          includes_diagnoses: false,
        })
        .select()
        .single()
      if (error) { Alert.alert('Error', error.message); return }
      await fetchLinks()
      const url = `https://bridgette.app/shared/${data.token}`
      await Share.share({
        message: `My health summary from Bridgette — ${url}\n\nThis link expires in 30 days.`,
        url,
        title: 'Bridgette Health Summary (External)',
      })
    } catch (e) {
      Alert.alert('Error', 'Could not share link.')
    } finally {
      setCreating(null)
    }
  }

  async function deactivateLink(id: string) {
    Alert.alert('Revoke access?', 'The doctor will no longer be able to view your records.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke', style: 'destructive',
        onPress: async () => {
          await supabase.from('share_links').update({ is_active: false }).eq('id', id)
          fetchLinks()
        }
      }
    ])
  }

  function formatExpiry(date: string) {
    const d = new Date(date)
    const now = new Date()
    const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft < 0) return 'Expired'
    if (daysLeft === 0) return 'Expires today'
    return `Expires in ${daysLeft} days`
  }

  function getLinkForDoctor(name: string) {
    return links.find(l => l.label === name && l.is_active)
  }

  const filteredTeam = CARE_TEAM.filter(d => {
    if (filter === 'md') return d.isMD
    if (filter === 'nonmd') return !d.isMD
    return true
  })

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Care Team</Text>
        <Text style={styles.subtitle}>Your doctors and health providers</Text>
      </View>

      <ScrollView style={styles.content}>

        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoIcon}>🔒</Text>
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>Secure read-only access</Text>
            <Text style={styles.infoDesc}>
              Links expire in 30 days and can be revoked anytime. Your doctor gets read-only access to your lab results and trends.
            </Text>
          </View>
        </View>

        {/* External share banner */}
        <View style={styles.externalSection}>
          <View style={styles.externalSectionLeft}>
            <Text style={styles.externalSectionTitle}>Consulting with a non-Bridgette user?</Text>
            <Text style={styles.externalSectionSub}>Generate a link that works outside the app</Text>
          </View>
          <TouchableOpacity style={styles.externalShareBtn} onPress={openExternalShare}>
            <Text style={styles.externalShareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        <View style={styles.filterRow}>
          {([['all', 'All'], ['md', 'MDs'], ['nonmd', 'Non-MDs']] as [FilterType, string][]).map(([val, label]) => (
            <TouchableOpacity
              key={val}
              style={[styles.filterChip, filter === val && styles.filterChipActive]}
              onPress={() => setFilter(val)}
            >
              <Text style={[styles.filterChipText, filter === val && styles.filterChipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>
          {filter === 'all' ? 'Your Doctors' : filter === 'md' ? 'Medical Doctors' : 'Non-Medical Providers'}
          {' '}· {filteredTeam.length}
        </Text>

        {filteredTeam.map((doctor) => {
          const activeLink = getLinkForDoctor(doctor.name)
          const isCreating = creating === doctor.name

          return (
            <View key={doctor.name} style={styles.doctorCard}>
              <View style={styles.doctorHeader}>
                <View style={[styles.doctorIconBg, { backgroundColor: doctor.bg }]}>
                  <Text style={styles.doctorEmoji}>{doctor.emoji}</Text>
                </View>
                <View style={styles.doctorInfo}>
                  <View style={styles.doctorRoleRow}>
                    <Text style={styles.doctorRole}>{doctor.role}</Text>
                    <View style={[styles.mdBadge, doctor.isMD ? styles.mdBadgeMD : styles.mdBadgeNonMD]}>
                      <Text style={styles.mdBadgeText}>{doctor.isMD ? 'MD' : 'Non-MD'}</Text>
                    </View>
                  </View>
                  <Text style={styles.doctorName}>{doctor.name}</Text>
                </View>
              </View>

              <View style={styles.consultRow}>
                <View style={styles.consultItem}>
                  <Text style={styles.consultLabel}>Last visit</Text>
                  <Text style={styles.consultDate}>{doctor.recentConsult}</Text>
                </View>
                <View style={styles.consultDivider} />
                <View style={styles.consultItem}>
                  <Text style={styles.consultLabel}>Next visit</Text>
                  <Text style={[styles.consultDate, { color: doctor.color }]}>{doctor.nextConsult}</Text>
                </View>
              </View>

              {activeLink && (
                <View style={styles.activeLinkBanner}>
                  <Text style={styles.activeLinkText}>🔗 Active · {formatExpiry(activeLink.expires_at)}</Text>
                  <TouchableOpacity onPress={() => deactivateLink(activeLink.id)}>
                    <Text style={styles.revokeText}>Revoke</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={styles.viewBtn}
                  onPress={() => openConsultation(doctor)}
                >
                  <Text style={styles.viewBtnText}>📋 View</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.shareBtn, { backgroundColor: doctor.color }, isCreating && styles.shareBtnDisabled]}
                  onPress={() => openBridgetteShare(doctor)}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.shareBtnText}>
                      {activeLink ? '📤 Share Again' : '📤 Share via App'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )
        })}

        {/* Active links summary */}
        {links.filter(l => l.is_active).length > 0 && (
          <View style={styles.linksSection}>
            <Text style={styles.sectionLabel}>Active Links</Text>
            {links.filter(l => l.is_active).map(link => (
              <View key={link.id} style={styles.linkRow}>
                <View style={styles.linkRowInfo}>
                  <Text style={styles.linkRowLabel}>{link.label}</Text>
                  <Text style={styles.linkRowExpiry}>{formatExpiry(link.expires_at)}</Text>
                </View>
                <TouchableOpacity onPress={() => deactivateLink(link.id)} style={styles.revokePill}>
                  <Text style={styles.revokePillText}>Revoke</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── CONSULTATION VIEW MODAL ── */}
      <Modal visible={showConsultModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.consultModalCard}>
            <View style={styles.consultModalHeader}>
              <View>
                <Text style={styles.consultModalDoctor}>{selectedDoctor?.name}</Text>
                <Text style={styles.consultModalRole}>{selectedDoctor?.role}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowConsultModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Consultation selector */}
            {selectedDoctor && selectedDoctor.consultations.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.consultPicker}>
                {selectedDoctor.consultations.map((c, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.consultPickerChip, selectedConsult === c && styles.consultPickerChipActive]}
                    onPress={() => setSelectedConsult(c)}
                  >
                    <Text style={[styles.consultPickerText, selectedConsult === c && styles.consultPickerTextActive]}>
                      {c.date}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <ScrollView style={styles.consultModalContent} showsVerticalScrollIndicator={false}>
              {selectedConsult && (
                <>
                  <View style={styles.consultSection}>
                    <Text style={styles.consultSectionTitle}>📝 Consultation Summary</Text>
                    <Text style={styles.consultSectionText}>{selectedConsult.summary}</Text>
                  </View>

                  <View style={styles.consultSection}>
                    <Text style={styles.consultSectionTitle}>🩺 Doctor's Notes</Text>
                    <Text style={styles.consultSectionText}>{selectedConsult.notes}</Text>
                  </View>

                  <View style={styles.consultSection}>
                    <Text style={styles.consultSectionTitle}>✅ Action Items</Text>
                    {selectedConsult.actionItems.map((item, i) => (
                      <View key={i} style={styles.actionItem}>
                        <View style={styles.actionDot} />
                        <Text style={styles.actionItemText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
              <View style={{ height: 20 }} />
            </ScrollView>

            <TouchableOpacity
              style={styles.shareConsultBtn}
              onPress={() => {
                setShowConsultModal(false)
                if (selectedDoctor) openBridgetteShare(selectedDoctor)
              }}
            >
              <Text style={styles.shareConsultBtnText}>📤 Share Records with {selectedDoctor?.name}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── BRIDGETTE SHARE MODAL ── */}
      <Modal visible={showBridgetteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Share with {shareDoctor?.name}</Text>
            <Text style={styles.modalSub}>
              This generates a secure link for a Bridgette provider. They will have read-only access to your lab results and trends.
            </Text>
            <View style={styles.modalToggle}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Include lifestyle data</Text>
                <Text style={styles.toggleDesc}>Food logs, sleep, and workouts</Text>
              </View>
              <Switch
                value={includeLifestyle}
                onValueChange={setIncludeLifestyle}
                trackColor={{ false: '#E8E4DC', true: '#3D7A5E' }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowBridgetteModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleBridgetteShare}>
                <Text style={styles.modalConfirmText}>Generate & Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── EXTERNAL CONSENT MODAL ── */}
      <Modal visible={showExternalModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Share with External Provider</Text>
            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerText}>By generating this link, you agree to the following:</Text>
              <Text style={styles.disclaimerPoint}>• This link will be shared with a non-Bridgette user and can be viewed in any web browser.</Text>
              <Text style={styles.disclaimerPoint}>• The link can be printed as a PDF and used externally by your doctor.</Text>
              <Text style={styles.disclaimerPoint}>• You consent to invite this provider to join Bridgette as a registered provider.</Text>
              <Text style={styles.disclaimerPoint}>• This link expires in 30 days and can be revoked at any time.</Text>
            </View>
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setConsentChecked(!consentChecked)}>
              <View style={[styles.checkbox, consentChecked && styles.checkboxChecked]}>
                {consentChecked && <Text style={styles.checkboxTick}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>I understand and consent to the above</Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowExternalModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, !consentChecked && styles.modalConfirmDisabled]}
                onPress={handleConsentProceed}
              >
                <Text style={styles.modalConfirmText}>Proceed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── EXTERNAL LIFESTYLE MODAL ── */}
      <Modal visible={showExternalLifestyleModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>What to include?</Text>
            <Text style={styles.modalSub}>Choose what data to share in the external link.</Text>
            <View style={styles.modalToggle}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Include lifestyle data</Text>
                <Text style={styles.toggleDesc}>Food logs, sleep, and workouts</Text>
              </View>
              <Switch
                value={includeLifestyleExternal}
                onValueChange={setIncludeLifestyleExternal}
                trackColor={{ false: '#E8E4DC', true: '#3D7A5E' }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowExternalLifestyleModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleExternalShare}>
                {creating === 'external' ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Generate & Share</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F4' },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4DC',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 24,
  },
  backBtn: { marginBottom: 12 },
  backText: { fontSize: 16, color: '#C8524A', fontWeight: '600' },
  title: { fontFamily: 'serif', fontSize: 22, color: '#1A1A2E', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#7A7A9A' },
  content: { flex: 1, padding: 16 },
  infoBanner: {
    backgroundColor: '#EAF4EE',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#C5E0D0',
  },
  infoIcon: { fontSize: 22 },
  infoText: { flex: 1 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#3D7A5E', marginBottom: 4 },
  infoDesc: { fontSize: 12, color: '#4A7A5E', lineHeight: 18 },
  externalSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  externalSectionLeft: { flex: 1 },
  externalSectionTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 4 },
  externalSectionSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  externalShareBtn: { backgroundColor: '#C8524A', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  externalShareBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },
  filterChipActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#7A7A9A' },
  filterChipTextActive: { color: '#fff' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#7A7A9A',
    marginBottom: 12,
  },
  doctorCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },
  doctorHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  doctorIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  doctorEmoji: { fontSize: 22 },
  doctorInfo: { flex: 1 },
  doctorRoleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  doctorRole: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: '#7A7A9A' },
  mdBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  mdBadgeMD: { backgroundColor: '#EAF4EE' },
  mdBadgeNonMD: { backgroundColor: '#FDF3E3' },
  mdBadgeText: { fontSize: 10, fontWeight: '700', color: '#3D7A5E' },
  doctorName: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  consultRow: {
    flexDirection: 'row',
    backgroundColor: '#F4F2EE',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  consultItem: { flex: 1, alignItems: 'center' },
  consultLabel: { fontSize: 10, color: '#7A7A9A', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  consultDate: { fontSize: 12, fontWeight: '600', color: '#1A1A2E', textAlign: 'center' },
  consultDivider: { width: 1, backgroundColor: '#E8E4DC', marginHorizontal: 8 },
  activeLinkBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EAF4EE',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  activeLinkText: { fontSize: 12, color: '#3D7A5E', fontWeight: '600' },
  revokeText: { fontSize: 12, color: '#C8524A', fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 10 },
  viewBtn: {
    flex: 1,
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E4DC',
    backgroundColor: '#fff',
  },
  viewBtnText: { fontSize: 13, fontWeight: '600', color: '#1A1A2E' },
  shareBtn: { flex: 2, borderRadius: 10, padding: 13, alignItems: 'center' },
  shareBtnDisabled: { opacity: 0.6 },
  shareBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  linksSection: { marginTop: 4 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },
  linkRowInfo: { flex: 1 },
  linkRowLabel: { fontSize: 13, fontWeight: '600', color: '#1A1A2E', marginBottom: 2 },
  linkRowExpiry: { fontSize: 11, color: '#7A7A9A' },
  revokePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E8E4DC' },
  revokePillText: { fontSize: 12, color: '#C8524A', fontWeight: '600' },

  // Consultation modal
  consultModalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 0,
    maxHeight: '90%',
  },
  consultModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  consultModalDoctor: { fontFamily: 'serif', fontSize: 18, color: '#1A1A2E', marginBottom: 2 },
  consultModalRole: { fontSize: 12, color: '#7A7A9A' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F4F2EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 14, color: '#7A7A9A', fontWeight: '600' },
  consultPicker: { marginBottom: 16 },
  consultPickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F4F2EE',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },
  consultPickerChipActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  consultPickerText: { fontSize: 12, fontWeight: '600', color: '#7A7A9A' },
  consultPickerTextActive: { color: '#fff' },
  consultModalContent: { flex: 1 },
  consultSection: {
    backgroundColor: '#F4F2EE',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  consultSectionTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  consultSectionText: { fontSize: 13, color: '#4A4A6A', lineHeight: 20 },
  actionItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  actionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C8524A', marginTop: 6 },
  actionItemText: { fontSize: 13, color: '#4A4A6A', lineHeight: 20, flex: 1 },
  shareConsultBtn: {
    backgroundColor: '#C8524A',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 32,
  },
  shareConsultBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontFamily: 'serif', fontSize: 20, color: '#1A1A2E', marginBottom: 8 },
  modalSub: { fontSize: 13, color: '#7A7A9A', lineHeight: 19, marginBottom: 20 },
  modalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F4F2EE',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 2 },
  toggleDesc: { fontSize: 12, color: '#7A7A9A' },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E8E4DC', alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#7A7A9A' },
  modalConfirmBtn: { flex: 2, backgroundColor: '#C8524A', padding: 14, borderRadius: 10, alignItems: 'center' },
  modalConfirmDisabled: { opacity: 0.4 },
  modalConfirmText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  disclaimerBox: { backgroundColor: '#F4F2EE', borderRadius: 12, padding: 16, marginBottom: 16 },
  disclaimerText: { fontSize: 13, fontWeight: '600', color: '#1A1A2E', marginBottom: 10 },
  disclaimerPoint: { fontSize: 12, color: '#7A7A9A', lineHeight: 20, marginBottom: 6 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#E8E4DC', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkboxChecked: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  checkboxTick: { fontSize: 13, color: '#fff', fontWeight: '700' },
  checkboxLabel: { fontSize: 13, color: '#1A1A2E', flex: 1, lineHeight: 18 },
})