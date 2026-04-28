import { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import Svg, { Path, Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

const SCREEN_WIDTH = Dimensions.get('window').width
const SIDEBAR_WIDTH = 90

const TRACKED_TESTS = ['LDL Cholesterol', 'Total Cholesterol', 'HDL Cholesterol', 'Triglycerides', 'Glucose (Fasting)']

const SECTIONS = ['Overview', 'Medications', 'Lab Results', 'Trends', 'Hormones', 'Lifestyle', 'Care Team Dx']
type Patient = {
  id: string
  full_name: string
  date_of_birth: string | null
  city: string | null
  flagged_count: number
  last_record_date: string | null
}

type LabValue = {
  test_name: string
  value: number
  unit: string
  is_flagged: boolean
  record_date: string
  reference_high: number | null
  reference_low: number | null
}

type FoodLog = {
  id: string
  meal_type: string
  description: string
  cooking_method: string | null
  oil_type: string | null
  is_fast_food: boolean
  health_flag: string
  ai_notes: string | null
  log_date: string
}

type SleepLog = {
  id: string
  hours_slept: number
  quality_rating: number
  log_date: string
}

type ActivityLog = {
  id: string
  activity_type: string
  duration_minutes: number
  log_date: string
}

const MOCK_CONSULTATION = {
  date: 'January 12, 2026',
  summary: 'Follow-up on dyslipidemia management. LDL still elevated at 154 mg/dL but trending down from December peak of 175 mg/dL. Blood pressure normal. Weight down 2kg.',
  notes: 'Patient tolerating lifestyle changes well. MCH slightly low, monitoring for iron deficiency. Referred to nutritionist.',
  prescriptions: [
    { name: 'Rosuvastatin', dosage: '10mg', instructions: 'Once daily at bedtime.' },
    { name: 'Omega-3 Fish Oil', dosage: '1000mg', instructions: 'Twice daily with meals.' },
  ],
  actionItems: [
    'Repeat lipid panel April 2026',
    'Continue low-saturated-fat diet',
    'Iron-rich food supplementation',
    'Follow up with nutritionist',
  ],
  hormones: [
    { name: 'Testosterone (Total)', value: 34.03, unit: 'ng/dL', ref: '13.84–53.35', normal: true },
    { name: 'DHEA-Sulfate', value: 6.5, unit: 'umol/L', ref: '2.6–13.9', normal: true },
  ],
  clinicalStory: 'Started Diane-35 April 2025 for hormonal acne. Lipids worsened over 9 months. Stopped pill and changed diet January 2026. Cholesterol improving but still above target.',
  nutritionPlan: {
    provider: 'Beatrix Mercado, RND',
    goals: ['25g fiber/day', 'Olive oil over palm oil', 'Lean protein each meal', 'Reduce processed meat', 'Brown rice over white'],
    notes: 'Mediterranean-style meal plan. Patient to log all meals in Bridgette.',
  },
  diagnosis: [
    { provider: 'Dr. David Lemuel del Prado', specialty: 'Family Medicine', items: ['Dyslipidemia (E78.5)', 'Iron Deficiency — subclinical (D50.9)'] },
    { provider: 'OB-GYN', specialty: 'Obstetrics & Gynecology', items: ['PCOS (E28.2)'] },
    { provider: 'Dr. Jan Tan', specialty: 'Ophthalmology', items: ['Mild Dry Eye Syndrome (H04.123)'] },
  ],
}

const QUALITY_LABELS: Record<number, string> = { 1: 'Very poor', 2: 'Poor', 3: 'Okay', 4: 'Good', 5: 'Great' }

function LabGroup({ date, labs, formatDate }: { date: string; labs: LabValue[]; formatDate: (d: string) => string }) {
  const [collapsed, setCollapsed] = useState(true)
  const flaggedCount = labs.filter(l => l.is_flagged).length
  return (
    <View style={styles.labGroup}>
      <TouchableOpacity style={styles.labGroupHeader} onPress={() => setCollapsed(!collapsed)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.labGroupDate}>{formatDate(date)}</Text>
          {flaggedCount > 0 && <View style={styles.labFlagBadge}><Text style={styles.labFlagBadgeText}>⚠️ {flaggedCount}</Text></View>}
        </View>
        <Text style={styles.collapseIcon}>{collapsed ? '▼' : '▲'}</Text>
      </TouchableOpacity>
      {!collapsed && labs.map((lab, i) => (
        <View key={i} style={styles.labRowCompact}>
          <Text style={styles.labNameCompact} numberOfLines={1}>{lab.test_name}</Text>
          <Text style={[styles.labValueCompact, lab.is_flagged && { color: '#C8524A' }]}>{lab.value} {lab.unit}</Text>
          {lab.is_flagged && <View style={styles.flagDotSmall} />}
        </View>
      ))}
    </View>
  )
}

export default function ProviderDashboard() {
  const signOut = useAuthStore((state) => state.signOut)
  const session = useAuthStore((state) => state.session)
  const profile = useAuthStore((state) => state.profile)

  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [activeSection, setActiveSection] = useState('Overview')
  const [activeLifestyleTab, setActiveLifestyleTab] = useState('Food')
  const [patientLabs, setPatientLabs] = useState<LabValue[]>([])
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([])
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [labsLoading, setLabsLoading] = useState(false)
  const [diagnosisUnlocked, setDiagnosisUnlocked] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [selectedTrendTest, setSelectedTrendTest] = useState('LDL Cholesterol')
  const scrollRef = useRef<ScrollView>(null)
  const sectionOffsets = useRef<Record<string, number>>({})

  useEffect(() => { fetchPatients() }, [])

  async function fetchPatients() {
    setLoading(true)
    try {
      const { data: links } = await supabase.from('provider_patients').select('patient_id').eq('provider_id', session?.user.id).eq('is_active', true)
      if (!links || links.length === 0) { setLoading(false); return }
      const patientIds = links.map(l => l.patient_id)
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, date_of_birth, city').in('id', patientIds)
      if (!profiles) { setLoading(false); return }
      const patientsWithData = await Promise.all(profiles.map(async (p) => {
        const { data: flagged } = await supabase.from('lab_values').select('id').eq('patient_id', p.id).eq('is_flagged', true)
        const { data: records } = await supabase.from('medical_records').select('record_date').eq('patient_id', p.id).order('record_date', { ascending: false }).limit(1)
        return { id: p.id, full_name: p.full_name || 'Unknown', date_of_birth: p.date_of_birth || null, city: p.city || null, flagged_count: flagged?.length || 0, last_record_date: records?.[0]?.record_date || null }
      }))
      setPatients(patientsWithData)
    } finally { setLoading(false) }
  }

  async function fetchPatientData(patientId: string) {
    setLabsLoading(true)
    const [labsRes, foodRes, sleepRes, actRes] = await Promise.all([
      supabase.from('lab_values').select('*').eq('patient_id', patientId).order('record_date', { ascending: false }),
      supabase.from('food_logs').select('*').eq('patient_id', patientId).order('log_date', { ascending: false }).limit(15),
      supabase.from('sleep_logs').select('*').eq('patient_id', patientId).order('log_date', { ascending: false }).limit(14),
      supabase.from('activity_logs').select('*').eq('patient_id', patientId).order('log_date', { ascending: false }).limit(14),
    ])
    if (labsRes.data) setPatientLabs(labsRes.data)
    if (foodRes.data) setFoodLogs(foodRes.data)
    if (sleepRes.data) setSleepLogs(sleepRes.data)
    if (actRes.data) setActivityLogs(actRes.data)
    setLabsLoading(false)
  }

  async function unlockDiagnosis() {
    setUnlocking(true)
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync()
      const isEnrolled = await LocalAuthentication.isEnrolledAsync()
      if (!hasHardware || !isEnrolled) {
        Alert.alert('Biometrics not available', 'View without authentication?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View anyway', onPress: () => setDiagnosisUnlocked(true) }
        ])
        setUnlocking(false)
        return
      }
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Authenticate to view diagnosis' })
      if (result.success) setDiagnosisUnlocked(true)
      else Alert.alert('Authentication failed')
    } catch { Alert.alert('Error', 'Authentication failed.') }
    finally { setUnlocking(false) }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function formatDOB(date: string) {
    const d = new Date(date)
    const age = new Date().getFullYear() - d.getFullYear()
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${age} yrs`
  }

  function jumpToSection(section: string) {
    setActiveSection(section)
    const offset = sectionOffsets.current[section]
    if (offset !== undefined) scrollRef.current?.scrollTo({ y: offset, animated: true })
  }

  const labsByDate = patientLabs.reduce((acc, lab) => {
    if (!acc[lab.record_date]) acc[lab.record_date] = []
    acc[lab.record_date].push(lab)
    return acc
  }, {} as Record<string, LabValue[]>)

  const flaggedLabs = patientLabs.filter(l => l.is_flagged).reduce((acc, lab) => {
    if (!acc.find(l => l.test_name === lab.test_name)) acc.push(lab)
    return acc
  }, [] as LabValue[])

  // Trend chart
  function renderTrendChart() {
    const series = patientLabs.filter(l => l.test_name === selectedTrendTest)
    const unique = series.reduce((acc, row) => {
      const label = new Date(row.record_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      if (!acc.find(p => p.label === label)) acc.push({ label, value: row.value })
      return acc
    }, [] as { label: string; value: number }[]).reverse()

    if (unique.length < 2) return <Text style={styles.emptyText}>Not enough data points</Text>

    const chartW = SCREEN_WIDTH - SIDEBAR_WIDTH - 32
    const chartH = 120
    const padTop = 20, padBottom = 24, padLeft = 8, padRight = 8
    const innerW = chartW - padLeft - padRight
    const innerH = chartH - padTop - padBottom
    const values = unique.map(d => d.value)
    const minVal = Math.min(...values) * 0.9
    const maxVal = Math.max(...values) * 1.08
    const toX = (i: number) => padLeft + (i / (unique.length - 1)) * innerW
    const toY = (val: number) => padTop + ((maxVal - val) / (maxVal - minVal)) * innerH
    const linePath = unique.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.value).toFixed(1)}`).join(' ')
    const areaPath = linePath + ` L${toX(unique.length - 1).toFixed(1)},${(chartH - padBottom).toFixed(1)} L${toX(0).toFixed(1)},${(chartH - padBottom).toFixed(1)} Z`
    const latest = unique[unique.length - 1]
    const prev = unique[unique.length - 2]
    const color = latest.value <= prev.value ? '#3D7A5E' : '#C8524A'

    return (
      <Svg width={chartW} height={chartH}>
        <Defs>
          <LinearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.12" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#tg)" />
        <Path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {unique.map((d, i) => (
          <View key={i}>
            <Circle cx={toX(i)} cy={toY(d.value)} r={4} fill="#fff" stroke={color} strokeWidth="2.5" />
            <SvgText x={toX(i)} y={toY(d.value) - 8} textAnchor="middle" fontSize="9" fontWeight="bold" fill={color}>{d.value}</SvgText>
            <SvgText x={toX(i)} y={chartH - 4} textAnchor="middle" fontSize="8" fill="#7A7A9A">{d.label}</SvgText>
          </View>
        ))}
      </Svg>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>bridgette</Text>
          <View style={styles.providerBadge}><Text style={styles.providerBadgeText}>Provider</Text></View>
        </View>
        <TouchableOpacity onPress={signOut}><Text style={styles.signOut}>Sign out</Text></TouchableOpacity>
      </View>

      <View style={styles.welcome}>
      <Text style={styles.welcomeName}>Good morning, Dr. {profile?.full_name?.split(' ').slice(-2).join(' ')} 👋</Text>
        <Text style={styles.welcomeSub}>{profile?.specialty} · {profile?.clinic}</Text>
      </View>

      {selectedPatient ? (
        <View style={styles.flex}>
          {/* Patient header */}
          <View style={styles.patientHeader}>
            <TouchableOpacity onPress={() => { setSelectedPatient(null); setPatientLabs([]); setDiagnosisUnlocked(false) }}>
              <Text style={styles.backText}>← Patients</Text>
            </TouchableOpacity>
            <View style={styles.patientHeaderInfo}>
              <View style={styles.patientAvatarSmall}>
                <Text style={styles.patientAvatarSmallText}>{selectedPatient.full_name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.patientHeaderName}>{selectedPatient.full_name}</Text>
                <Text style={styles.patientHeaderMeta}>
                  {selectedPatient.date_of_birth ? formatDOB(selectedPatient.date_of_birth) : ''}
                  {selectedPatient.city ? ` · ${selectedPatient.city}` : ''}
                </Text>
              </View>
              {selectedPatient.flagged_count > 0 && (
                <View style={styles.flagPill}>
                  <Text style={styles.flagPillText}>⚠️ {selectedPatient.flagged_count}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Sidebar + Content */}
          <View style={styles.sidebarLayout}>

            {/* LEFT SIDEBAR */}
            <View style={styles.sidebar}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {SECTIONS.map(section => (
                  <TouchableOpacity
                    key={section}
                    style={[styles.sidebarItem, activeSection === section && styles.sidebarItemActive]}
                    onPress={() => jumpToSection(section)}
                  >
                    <Text style={[styles.sidebarText, activeSection === section && styles.sidebarTextActive]} numberOfLines={2}>
                      {section}
                    </Text>
                    {activeSection === section && <View style={styles.sidebarActiveBar} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* RIGHT CONTENT */}
            <ScrollView
              ref={scrollRef}
              style={styles.mainContent}
              showsVerticalScrollIndicator={false}
              onScroll={(e) => {
                const y = e.nativeEvent.contentOffset.y
                let current = SECTIONS[0]
                for (const section of SECTIONS) {
                  const offset = sectionOffsets.current[section]
                  if (offset !== undefined && y >= offset - 40) current = section
                }
                setActiveSection(current)
              }}
              scrollEventThrottle={16}
            >

              {/* OVERVIEW */}
              <View onLayout={(e) => { sectionOffsets.current['Overview'] = e.nativeEvent.layout.y }}>
                <Text style={styles.sectionHeading}>Overview</Text>
                <View style={styles.miniCard}>
                  <Text style={styles.miniCardText}>{MOCK_CONSULTATION.clinicalStory}</Text>
                </View>
                {flaggedLabs.length > 0 && (
                  <View style={styles.miniCard}>
                    <Text style={styles.miniCardTitle}>⚠️ Flagged ({flaggedLabs.length})</Text>
                    {flaggedLabs.slice(0, 5).map((lab, i) => (
                      <View key={i} style={styles.flaggedRowCompact}>
                        <Text style={styles.flaggedNameCompact} numberOfLines={1}>{lab.test_name}</Text>
                        <Text style={styles.flaggedValueCompact}>{lab.value} {lab.unit}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.visitRowCard}>
                  <View style={styles.visitItem}>
                    <Text style={styles.visitLabel}>Last Visit</Text>
                    <Text style={styles.visitValue}>{selectedPatient.last_record_date ? formatDate(selectedPatient.last_record_date) : 'N/A'}</Text>
                  </View>
                  <View style={styles.visitDivider} />
                  <View style={styles.visitItem}>
                    <Text style={styles.visitLabel}>Next Visit</Text>
                    <Text style={[styles.visitValue, { color: '#3D7A5E' }]}>Jul 12, 2026</Text>
                  </View>
                </View>
                <View style={styles.miniCard}>
                  <Text style={styles.miniCardTitle}>📝 Last Consultation · {MOCK_CONSULTATION.date}</Text>
                  <Text style={styles.miniCardText}>{MOCK_CONSULTATION.summary}</Text>
                </View>
                <View style={styles.miniCard}>
                  <Text style={styles.miniCardTitle}>✅ Action Items</Text>
                  {MOCK_CONSULTATION.actionItems.map((item, i) => (
                    <View key={i} style={styles.actionItem}>
                      <View style={styles.actionDot} />
                      <Text style={styles.actionText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* MEDICATIONS */}
              <View onLayout={(e) => { sectionOffsets.current['Medications'] = e.nativeEvent.layout.y }}>
                <Text style={styles.sectionHeading}>Medications</Text>
                {MOCK_CONSULTATION.prescriptions.map((rx, i) => (
                  <View key={i} style={styles.miniCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={styles.rxName}>{rx.name}</Text>
                      <View style={styles.rxBadge}><Text style={styles.rxBadgeText}>{rx.dosage}</Text></View>
                    </View>
                    <Text style={styles.miniCardText}>{rx.instructions}</Text>
                  </View>
                ))}
              </View>

              {/* LAB RESULTS */}
              <View onLayout={(e) => { sectionOffsets.current['Lab Results'] = e.nativeEvent.layout.y }}>
                <Text style={styles.sectionHeading}>Lab Results</Text>
                {labsLoading ? <ActivityIndicator color="#C8524A" /> :
                  Object.keys(labsByDate).length === 0 ?
                    <View style={styles.miniCard}><Text style={styles.emptyText}>No lab results found.</Text></View> :
                    Object.entries(labsByDate).map(([date, labs]) => (
                      <LabGroup key={date} date={date} labs={labs} formatDate={formatDate} />
                    ))
                }
              </View>

              {/* TRENDS */}
              <View onLayout={(e) => { sectionOffsets.current['Trends'] = e.nativeEvent.layout.y }}>
                <Text style={styles.sectionHeading}>Trends</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
                  {TRACKED_TESTS.map(test => (
                    <TouchableOpacity
                      key={test}
                      style={[styles.trendChip, selectedTrendTest === test && styles.trendChipActive]}
                      onPress={() => setSelectedTrendTest(test)}
                    >
                      <Text style={[styles.trendChipText, selectedTrendTest === test && styles.trendChipTextActive]}>
                        {test.replace(' Cholesterol', '').replace(' (Fasting)', '')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.miniCard}>
                  <Text style={styles.miniCardTitle}>{selectedTrendTest}</Text>
                  {renderTrendChart()}
                </View>
              </View>

              {/* HORMONES */}
              <View onLayout={(e) => { sectionOffsets.current['Hormones'] = e.nativeEvent.layout.y }}>
                <Text style={styles.sectionHeading}>Hormones & Story</Text>
                {MOCK_CONSULTATION.hormones.map((h, i) => (
                  <View key={i} style={styles.hormoneRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hormoneName}>{h.name}</Text>
                      <Text style={styles.hormoneRef}>Ref: {h.ref} {h.unit}</Text>
                    </View>
                    <Text style={[styles.hormoneValue, !h.normal && { color: '#C8524A' }]}>{h.value} {h.unit}</Text>
                    <View style={[styles.hormoneStatus, h.normal ? styles.hormoneStatusNormal : styles.hormoneStatusFlagged]}>
                      <Text style={{ fontSize: 11 }}>{h.normal ? '✓' : '⚠'}</Text>
                    </View>
                  </View>
                ))}
                <View style={[styles.miniCard, { borderLeftWidth: 3, borderLeftColor: '#9B59B6', backgroundColor: '#F3EFFA' }]}>
                  <Text style={[styles.miniCardText, { color: '#4A3A6A' }]}>{MOCK_CONSULTATION.clinicalStory}</Text>
                </View>
              </View>

              {/* LIFESTYLE */}
              <View onLayout={(e) => { sectionOffsets.current['Lifestyle'] = e.nativeEvent.layout.y }}>
                <Text style={styles.sectionHeading}>Lifestyle Log</Text>
                <View style={styles.lifestyleTabRow}>
                  {['Food', 'Sleep', 'Workouts', 'Nutrition'].map(tab => (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.lifestyleTab, activeLifestyleTab === tab && styles.lifestyleTabActive]}
                      onPress={() => setActiveLifestyleTab(tab)}
                    >
                      <Text style={[styles.lifestyleTabText, activeLifestyleTab === tab && styles.lifestyleTabTextActive]}>{tab}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {activeLifestyleTab === 'Food' && (
                  foodLogs.length === 0 ?
                    <View style={styles.miniCard}><Text style={styles.emptyText}>No food logs yet.</Text></View> :
                    foodLogs.map(log => (
                      <View key={log.id} style={styles.miniCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Text style={styles.logMealType}>{log.meal_type}</Text>
                          <Text style={styles.logDate}>{formatDate(log.log_date)}</Text>
                        </View>
                        <Text style={styles.miniCardText}>{log.description}</Text>
                        {log.ai_notes && <Text style={styles.aiNote}>{log.ai_notes}</Text>}
                      </View>
                    ))
                )}

                {activeLifestyleTab === 'Sleep' && (
                  sleepLogs.length === 0 ?
                    <View style={styles.miniCard}><Text style={styles.emptyText}>No sleep logs yet.</Text></View> :
                    sleepLogs.map(log => (
                      <View key={log.id} style={styles.miniCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={styles.miniCardTitle}>{formatDate(log.log_date)}</Text>
                          <Text style={[styles.miniCardTitle, { color: log.hours_slept >= 7 ? '#3D7A5E' : '#C8524A' }]}>{log.hours_slept} hrs · {QUALITY_LABELS[log.quality_rating]}</Text>
                        </View>
                        <View style={styles.sleepBar}>
                          <View style={[styles.sleepBarFill, { width: `${Math.min((log.hours_slept / 9) * 100, 100)}%`, backgroundColor: log.hours_slept >= 7 ? '#3D7A5E' : '#C8524A' }]} />
                        </View>
                      </View>
                    ))
                )}

                {activeLifestyleTab === 'Workouts' && (
                  activityLogs.length === 0 ?
                    <View style={styles.miniCard}><Text style={styles.emptyText}>No workouts logged yet.</Text></View> :
                    activityLogs.map(log => (
                      <View key={log.id} style={styles.miniCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={styles.miniCardTitle}>{log.activity_type}</Text>
                          <Text style={styles.miniCardText}>{log.duration_minutes} min · {formatDate(log.log_date)}</Text>
                        </View>
                      </View>
                    ))
                )}

                {activeLifestyleTab === 'Nutrition' && (
                  <>
                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardTitle}>By {MOCK_CONSULTATION.nutritionPlan.provider}</Text>
                      <Text style={styles.miniCardText}>{MOCK_CONSULTATION.nutritionPlan.notes}</Text>
                    </View>
                    <View style={styles.miniCard}>
                      <Text style={styles.miniCardTitle}>Goals</Text>
                      {MOCK_CONSULTATION.nutritionPlan.goals.map((g, i) => (
                        <View key={i} style={styles.actionItem}>
                          <View style={[styles.actionDot, { backgroundColor: '#3D7A5E' }]} />
                          <Text style={styles.actionText}>{g}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>

              {/* CARE TEAM DX */}
              <View onLayout={(e) => { sectionOffsets.current['Care Team Dx'] = e.nativeEvent.layout.y }}>
                <Text style={styles.sectionHeading}>Care Team Diagnoses</Text>
                {diagnosisUnlocked ? (
                  MOCK_CONSULTATION.diagnosis.map((d, i) => (
                    <View key={i} style={styles.miniCard}>
                      <Text style={styles.miniCardTitle}>{d.provider}</Text>
                      <Text style={[styles.miniCardText, { marginBottom: 8 }]}>{d.specialty}</Text>
                      {d.items.map((item, j) => (
                        <View key={j} style={styles.actionItem}>
                          <View style={styles.actionDot} />
                          <Text style={styles.actionText}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  ))
                ) : (
                  <TouchableOpacity style={styles.lockedCard} onPress={unlockDiagnosis} disabled={unlocking}>
                    <Text style={styles.lockIcon}>🔒</Text>
                    <Text style={styles.lockedTitle}>Diagnoses locked</Text>
                    <Text style={styles.lockedSub}>Tap to unlock with Face ID</Text>
                    {unlocking && <ActivityIndicator color="#C8524A" style={{ marginTop: 6 }} />}
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ height: 60 }} />
            </ScrollView>
          </View>
        </View>

      ) : (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionLabel}>Your Patients · {patients.length}</Text>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#C8524A" />
          ) : patients.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>No patients yet</Text>
              <Text style={styles.emptyStateText}>Patients will appear here when they share their data with you.</Text>
            </View>
          ) : (
            patients.map((patient) => (
              <TouchableOpacity
                key={patient.id}
                style={styles.patientCard}
                onPress={() => { setSelectedPatient(patient); fetchPatientData(patient.id) }}
              >
                <View style={styles.patientAvatar}>
                  <Text style={styles.patientAvatarText}>{patient.full_name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.patientInfo}>
                  <Text style={styles.patientName}>{patient.full_name}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.patientMeta}>Last Visit: {patient.last_record_date ? formatDate(patient.last_record_date) : 'N/A'}</Text>
                    <Text style={styles.patientMeta}>·</Text>
                    <Text style={[styles.patientMeta, { color: '#3D7A5E' }]}>Next: Jul 12, 2026</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {patient.flagged_count > 0 && (
                    <View style={styles.flagCount}>
                      <Text style={styles.flagCountText}>{patient.flagged_count}</Text>
                    </View>
                  )}
                  <Text style={styles.patientArrow}>→</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F4' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8E4DC',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { fontFamily: 'serif', fontSize: 22, color: '#C8524A' },
  providerBadge: { backgroundColor: '#1A1A2E', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  providerBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  signOut: { fontSize: 13, color: '#7A7A9A' },
  welcome: {
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8E4DC',
  },
  welcomeName: { fontFamily: 'serif', fontSize: 20, color: '#1A1A2E', marginBottom: 2 },
  welcomeSub: { fontSize: 12, color: '#7A7A9A' },
  content: { flex: 1, padding: 16 },

  // Patient list
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#7A7A9A', marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontFamily: 'serif', fontSize: 18, color: '#1A1A2E', marginBottom: 6 },
  emptyStateText: { fontSize: 13, color: '#7A7A9A', textAlign: 'center', lineHeight: 20 },
  patientCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E8E4DC', gap: 12,
  },
  patientAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FCEEED', alignItems: 'center', justifyContent: 'center' },
  patientAvatarText: { fontSize: 17, fontWeight: '700', color: '#C8524A' },
  patientInfo: { flex: 1 },
  patientName: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 4 },
  patientMeta: { fontSize: 11, color: '#7A7A9A' },
  flagCount: { backgroundColor: '#FCEEED', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  flagCountText: { fontSize: 10, fontWeight: '700', color: '#C8524A' },
  patientArrow: { fontSize: 15, color: '#7A7A9A' },

  // Patient header
  patientHeader: {
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8E4DC',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
  },
  backText: { fontSize: 13, color: '#C8524A', fontWeight: '600', marginBottom: 8 },
  patientHeaderInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  patientAvatarSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FCEEED', alignItems: 'center', justifyContent: 'center' },
  patientAvatarSmallText: { fontSize: 15, fontWeight: '700', color: '#C8524A' },
  patientHeaderName: { fontFamily: 'serif', fontSize: 15, color: '#1A1A2E', marginBottom: 1 },
  patientHeaderMeta: { fontSize: 10, color: '#7A7A9A' },
  flagPill: { backgroundColor: '#FDF3E3', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  flagPillText: { fontSize: 11, fontWeight: '600', color: '#B5720A' },

  // Sidebar layout
  sidebarLayout: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#E8E4DC',
    paddingTop: 8,
  },
  sidebarItem: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    position: 'relative',
  },
  sidebarItemActive: { backgroundColor: '#FAF8F4' },
  sidebarText: { fontSize: 10, fontWeight: '600', color: '#7A7A9A', lineHeight: 14 },
  sidebarTextActive: { color: '#C8524A', fontWeight: '700' },
  sidebarActiveBar: {
    position: 'absolute',
    left: 0, top: 6, bottom: 6,
    width: 3,
    backgroundColor: '#C8524A',
    borderRadius: 2,
  },

  // Main content
  mainContent: { flex: 1, paddingHorizontal: 12, paddingTop: 8 },
  sectionHeading: {
    fontFamily: 'serif', fontSize: 16, color: '#1A1A2E',
    marginBottom: 10, marginTop: 16,
    paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#E8E4DC',
  },

  // Mini cards
  miniCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#E8E4DC',
  },
  miniCardTitle: { fontSize: 12, fontWeight: '700', color: '#1A1A2E', marginBottom: 5 },
  miniCardText: { fontSize: 12, color: '#4A4A6A', lineHeight: 18, fontWeight: '300' },
  emptyText: { fontSize: 12, color: '#7A7A9A', fontStyle: 'italic' },

  // Flagged compact
  flaggedRowCompact: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#F4F2EE' },
  flaggedNameCompact: { fontSize: 11, color: '#1A1A2E', flex: 1 },
  flaggedValueCompact: { fontSize: 11, fontWeight: '700', color: '#C8524A' },

  // Visit row
  visitRowCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E8E4DC' },
  visitItem: { flex: 1, alignItems: 'center' },
  visitLabel: { fontSize: 9, color: '#7A7A9A', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  visitValue: { fontSize: 11, fontWeight: '600', color: '#1A1A2E', textAlign: 'center' },
  visitDivider: { width: 1, backgroundColor: '#E8E4DC', marginHorizontal: 6 },

  // Action items
  actionItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  actionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C8524A', marginTop: 6, flexShrink: 0 },
  actionText: { fontSize: 12, color: '#4A4A6A', lineHeight: 18, flex: 1, fontWeight: '300' },

  // Medications
  rxName: { fontSize: 13, fontWeight: '600', color: '#1A1A2E', flex: 1 },
  rxBadge: { backgroundColor: '#EAF4EE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  rxBadgeText: { fontSize: 11, fontWeight: '600', color: '#3D7A5E' },

  // Lab groups compact
  labGroup: { backgroundColor: '#fff', borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: '#E8E4DC', overflow: 'hidden' },
  labGroupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  labGroupDate: { fontSize: 12, fontWeight: '600', color: '#1A1A2E' },
  labFlagBadge: { backgroundColor: '#FDF3E3', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  labFlagBadgeText: { fontSize: 10, fontWeight: '600', color: '#B5720A' },
  collapseIcon: { fontSize: 10, color: '#7A7A9A' },
  labRowCompact: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, borderTopWidth: 1, borderTopColor: '#F4F2EE' },
  labNameCompact: { flex: 1, fontSize: 11, color: '#1A1A2E' },
  labValueCompact: { fontSize: 11, fontWeight: '600', color: '#1A1A2E', marginRight: 6 },
  flagDotSmall: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C8524A' },

  // Trends
  trendChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8E4DC' },
  trendChipActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  trendChipText: { fontSize: 10, fontWeight: '600', color: '#7A7A9A' },
  trendChipTextActive: { color: '#fff' },

  // Hormones
  hormoneRow: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E8E4DC' },
  hormoneName: { fontSize: 12, fontWeight: '600', color: '#1A1A2E', marginBottom: 2 },
  hormoneRef: { fontSize: 10, color: '#7A7A9A' },
  hormoneValue: { fontSize: 12, fontWeight: '700', color: '#1A1A2E', marginRight: 8 },
  hormoneStatus: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  hormoneStatusNormal: { backgroundColor: '#EAF4EE' },
  hormoneStatusFlagged: { backgroundColor: '#FCEEED' },

  // Lifestyle
  lifestyleTabRow: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  lifestyleTab: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8E4DC' },
  lifestyleTabActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  lifestyleTabText: { fontSize: 11, fontWeight: '600', color: '#7A7A9A' },
  lifestyleTabTextActive: { color: '#fff' },
  logMealType: { fontSize: 10, fontWeight: '700', color: '#7A7A9A', textTransform: 'uppercase' },
  logDate: { fontSize: 10, color: '#7A7A9A' },
  aiNote: { fontSize: 11, color: '#3D7A5E', fontStyle: 'italic', marginTop: 4 },
  sleepBar: { height: 5, backgroundColor: '#E8E4DC', borderRadius: 3, overflow: 'hidden' },
  sleepBarFill: { height: '100%', borderRadius: 3 },

  // Locked
  lockedCard: { backgroundColor: '#fff', borderRadius: 10, padding: 20, borderWidth: 1, borderColor: '#E8E4DC', borderStyle: 'dashed', alignItems: 'center' },
  lockIcon: { fontSize: 24, marginBottom: 6 },
  lockedTitle: { fontSize: 13, fontWeight: '600', color: '#1A1A2E', marginBottom: 3 },
  lockedSub: { fontSize: 11, color: '#7A7A9A' },
})