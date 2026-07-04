import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Icon from '../../components/Icon'

type IconKey = 'doctor' | 'eye' | 'diet' | 'trainer' | 'careteam'

type Provider = {
  provider: string
  specialty: string
  isMD: boolean
  icon: IconKey
  color: string
  bg: string
  items: string[]
  summary: string
  prescriptions: { name: string; dosage: string; instructions: string }[]
  nextVisit: string
  lastVisit: string
}

const CARE_TEAM: Provider[] = [
  {
    provider: 'Dr. David Lemuel del Prado',
    specialty: 'Family Medicine',
    isMD: true,
    icon: 'doctor',
    color: '#5C7340',
    bg: '#EBEFE3',
    items: ['Dyslipidemia (E78.5)', 'Iron Deficiency — subclinical (D50.9)'],
    summary: 'Follow-up on dyslipidemia management. LDL trending down from 175 to 154 mg/dL. Patient off Diane-35, diet improving. Referred to nutritionist and ophthalmologist. MCH slightly low — monitoring for iron deficiency.',
    prescriptions: [
      { name: 'Rosuvastatin', dosage: '10mg', instructions: 'Once daily at bedtime. Monitor for muscle pain.' },
      { name: 'Omega-3 Fish Oil', dosage: '1000mg', instructions: 'Twice daily with meals.' },
    ],
    lastVisit: 'January 12, 2026',
    nextVisit: 'July 12, 2026',
  },
  {
    provider: 'Dr. OB-GYN',
    specialty: 'Obstetrics & Gynecology',
    isMD: true,
    icon: 'doctor',
    color: '#C4611A',
    bg: '#F6E8DD',
    items: ['PCOS (E28.2)'],
    summary: 'Patient counseled on PCOS management post Diane-35. Hormonal levels improving. Monitoring cycle regularity. Advised on lifestyle changes to support hormonal balance.',
    prescriptions: [],
    lastVisit: 'November 3, 2025',
    nextVisit: 'May 3, 2026',
  },
  {
    provider: 'Dr. Jan Tan',
    specialty: 'Ophthalmology',
    isMD: true,
    icon: 'eye',
    color: '#7B4B94',
    bg: '#EFE7F2',
    items: ['Mild Dry Eye Syndrome (H04.123)'],
    summary: 'Annual eye exam. Visual acuity 20/20 bilaterally. No diabetic retinopathy noted. Mild dry eye — prescribed lubricating drops. Will monitor for early diabetic eye changes given borderline glucose.',
    prescriptions: [
      { name: 'Systane Ultra Eye Drops', dosage: '1-2 drops', instructions: 'Apply to both eyes twice daily or as needed.' },
    ],
    lastVisit: 'December 6, 2025',
    nextVisit: 'June 6, 2026',
  },
  {
    provider: 'Beatrix Mercado',
    specialty: 'Nutritionist',
    isMD: false,
    icon: 'diet',
    color: '#C4922A',
    bg: '#F6EDDA',
    items: ['High saturated fat diet', 'Low fiber intake', 'Elevated carbohydrate consumption'],
    summary: 'Initial nutrition consultation. Reviewed Bridgette food logs. Mediterranean-style meal plan prescribed. Goals: 25g fiber/day, olive oil over palm oil, lean protein at each meal.',
    prescriptions: [],
    lastVisit: 'April 21, 2026',
    nextVisit: 'July 21, 2026',
  },
  {
    provider: 'Jesse Virata',
    specialty: 'Personal Trainer',
    isMD: false,
    icon: 'trainer',
    color: '#B5451B',
    bg: '#F5E2D8',
    items: ['Sedentary lifestyle', 'Low cardiovascular endurance'],
    summary: 'Initial fitness assessment. Patient has been mostly sedentary. Program designed around 3x/week cardio and 2x/week strength training. Focus on sustainable fat loss and cardiovascular health.',
    prescriptions: [],
    lastVisit: 'April 15, 2026',
    nextVisit: 'May 15, 2026',
  },
]

type FilterType = 'all' | 'md' | 'nonmd'

export default function CareTeamScreen({
  patientName,
  onBack,
}: {
  patientName: string
  onBack: () => void
}) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)

  const filteredTeam = CARE_TEAM.filter(p => {
    if (filter === 'md') return p.isMD
    if (filter === 'nonmd') return !p.isMD
    return true
  })

  // Provider detail page
  if (selectedProvider) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedProvider(null)} style={styles.backBtn}>
            <View style={styles.backRow}>
              <Icon name="back" size={16} color="#C4611A" />
              <Text style={styles.backText}>{patientName}'s Care Team</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.providerHeaderInfo}>
            <View style={[styles.providerIconBig, { backgroundColor: selectedProvider.bg }]}>
              <Icon name={selectedProvider.icon} size={24} color={selectedProvider.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.providerDetailName}>{selectedProvider.provider}</Text>
              <View style={styles.providerDetailMeta}>
                <Text style={styles.providerDetailSpecialty}>{selectedProvider.specialty}</Text>
                <View style={[styles.mdBadge, selectedProvider.isMD ? styles.mdBadgeMD : styles.mdBadgeNonMD]}>
                  <Text style={[styles.mdBadgeText, selectedProvider.isMD ? styles.mdBadgeTextMD : styles.mdBadgeTextNonMD]}>{selectedProvider.isMD ? 'MD' : 'Non-MD'}</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.visitRow}>
            <View style={styles.visitItem}>
              <Text style={styles.visitLabel}>Last Visit</Text>
              <Text style={styles.visitValue}>{selectedProvider.lastVisit}</Text>
            </View>
            <View style={styles.visitDivider} />
            <View style={styles.visitItem}>
              <Text style={styles.visitLabel}>Next Visit</Text>
              <Text style={[styles.visitValue, { color: selectedProvider.color }]}>{selectedProvider.nextVisit}</Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.content}>
          <Animated.View entering={FadeInDown.delay(0)} style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Icon name="diagnosis" size={15} color="#3D3229" />
              <Text style={styles.sectionTitle}>Diagnoses</Text>
            </View>
            <View style={styles.card}>
              {selectedProvider.items.map((item, i) => (
                <View key={i} style={styles.diagnosisItem}>
                  <View style={[styles.diagnosisDot, { backgroundColor: selectedProvider.color }]} />
                  <Text style={styles.diagnosisText}>{item}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80)} style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Icon name="notes" size={15} color="#3D3229" />
              <Text style={styles.sectionTitle}>Consultation Summary</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardDate}>Last visit: {selectedProvider.lastVisit}</Text>
              <Text style={styles.cardText}>{selectedProvider.summary}</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160)} style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Icon name="medication" size={15} color="#3D3229" />
              <Text style={styles.sectionTitle}>Prescriptions</Text>
            </View>
            {selectedProvider.prescriptions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No prescriptions from this provider.</Text>
              </View>
            ) : (
              selectedProvider.prescriptions.map((rx, i) => (
                <View key={i} style={styles.rxCard}>
                  <View style={styles.rxTop}>
                    <Text style={styles.rxName}>{rx.name}</Text>
                    <View style={[styles.rxBadge, { backgroundColor: selectedProvider.bg }]}>
                      <Text style={[styles.rxBadgeText, { color: selectedProvider.color }]}>{rx.dosage}</Text>
                    </View>
                  </View>
                  <Text style={styles.rxInstructions}>{rx.instructions}</Text>
                </View>
              ))
            )}
          </Animated.View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    )
  }

  // Provider list
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <View style={styles.backRow}>
            <Icon name="back" size={16} color="#C4611A" />
            <Text style={styles.backText}>Back to Patient</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>{patientName}'s Care Team</Text>
        <Text style={styles.subtitle}>{CARE_TEAM.length} providers · {CARE_TEAM.filter(p => p.isMD).length} MDs · {CARE_TEAM.filter(p => !p.isMD).length} Non-MDs</Text>
        <View style={styles.filterRow}>
          {(['all', 'md', 'nonmd'] as FilterType[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {f === 'all' ? 'All' : f === 'md' ? 'MDs' : 'Non-MDs'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {filteredTeam.map((provider, index) => (
          <Animated.View key={provider.provider} entering={FadeInDown.delay(index * 60)}>
            <TouchableOpacity
              style={styles.providerCard}
              onPress={() => setSelectedProvider(provider)}
            >
              <View style={styles.providerCardTop}>
                <View style={[styles.providerIcon, { backgroundColor: provider.bg }]}>
                  <Icon name={provider.icon} size={20} color={provider.color} />
                </View>
                <View style={styles.providerInfo}>
                  <View style={styles.providerNameRow}>
                    <Text style={styles.providerName}>{provider.provider}</Text>
                    <View style={[styles.mdBadge, provider.isMD ? styles.mdBadgeMD : styles.mdBadgeNonMD]}>
                      <Text style={[styles.mdBadgeText, provider.isMD ? styles.mdBadgeTextMD : styles.mdBadgeTextNonMD]}>{provider.isMD ? 'MD' : 'Non-MD'}</Text>
                    </View>
                  </View>
                  <Text style={styles.providerSpecialty}>{provider.specialty}</Text>
                </View>
                <Icon name="forward" size={18} color="#8A7E72" />
              </View>
              <View style={styles.dxPreview}>
                {provider.items.slice(0, 2).map((item, i) => (
                  <View key={i} style={styles.dxPreviewItem}>
                    <View style={[styles.dxPreviewDot, { backgroundColor: provider.color }]} />
                    <Text style={styles.dxPreviewText} numberOfLines={1}>{item}</Text>
                  </View>
                ))}
                {provider.items.length > 2 && (
                  <Text style={styles.dxPreviewMore}>+{provider.items.length - 2} more</Text>
                )}
              </View>
              <View style={styles.providerVisitRow}>
                <Text style={styles.providerVisitText}>Last: {provider.lastVisit}</Text>
                <Text style={styles.providerVisitDivider}>·</Text>
                <Text style={[styles.providerVisitText, { color: provider.color }]}>Next: {provider.nextVisit}</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F2EC' },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5DFD3',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 14,
  },
  backBtn: { marginBottom: 10 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 13, color: '#C4611A', fontWeight: '600' },
  title: { fontFamily: 'Georgia', fontSize: 20, color: '#3D3229', marginBottom: 3 },
  subtitle: { fontSize: 12, color: '#8A7E72', marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F0EBE1', borderWidth: 1, borderColor: '#E5DFD3' },
  filterChipActive: { backgroundColor: '#C4611A', borderColor: '#C4611A' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#8A7E72' },
  filterChipTextActive: { color: '#fff' },
  content: { flex: 1, padding: 16 },
  providerCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: '#E5DFD3',
  },
  providerCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  providerIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  providerInfo: { flex: 1 },
  providerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  providerName: { fontSize: 14, fontWeight: '700', color: '#3D3229', flex: 1 },
  providerSpecialty: { fontSize: 11, color: '#8A7E72' },
  mdBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  mdBadgeMD: { backgroundColor: '#EBEFE3' },
  mdBadgeNonMD: { backgroundColor: '#F6EDDA' },
  mdBadgeText: { fontSize: 9, fontWeight: '700' },
  mdBadgeTextMD: { color: '#5C7340' },
  mdBadgeTextNonMD: { color: '#C4922A' },
  dxPreview: { marginBottom: 10 },
  dxPreviewItem: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  dxPreviewDot: { width: 5, height: 5, borderRadius: 3 },
  dxPreviewText: { fontSize: 12, color: '#5A4A38', flex: 1 },
  dxPreviewMore: { fontSize: 11, color: '#8A7E72', fontStyle: 'italic' },
  providerVisitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#F0EBE1', paddingTop: 10 },
  providerVisitText: { fontSize: 11, color: '#8A7E72' },
  providerVisitDivider: { fontSize: 11, color: '#E5DFD3' },
  providerHeaderInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  providerIconBig: { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  providerDetailName: { fontFamily: 'Georgia', fontSize: 16, color: '#3D3229', marginBottom: 4 },
  providerDetailMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  providerDetailSpecialty: { fontSize: 12, color: '#8A7E72' },
  visitRow: { flexDirection: 'row', backgroundColor: '#F0EBE1', borderRadius: 10, padding: 12 },
  visitItem: { flex: 1, alignItems: 'center' },
  visitLabel: { fontSize: 9, color: '#8A7E72', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  visitValue: { fontSize: 12, fontWeight: '600', color: '#3D3229', textAlign: 'center' },
  visitDivider: { width: 1, backgroundColor: '#E5DFD3', marginHorizontal: 8 },
  section: { marginBottom: 14 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#3D3229' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5DFD3' },
  cardDate: { fontSize: 10, fontWeight: '700', color: '#8A7E72', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  cardText: { fontSize: 13, color: '#5A4A38', lineHeight: 20, fontWeight: '300' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5DFD3', alignItems: 'center' },
  emptyText: { fontSize: 12, color: '#8A7E72', fontStyle: 'italic' },
  diagnosisItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  diagnosisDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  diagnosisText: { fontSize: 13, color: '#3D3229', flex: 1, lineHeight: 20 },
  rxCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5DFD3', marginBottom: 8 },
  rxTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  rxName: { fontSize: 14, fontWeight: '600', color: '#3D3229', flex: 1 },
  rxBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  rxBadgeText: { fontSize: 12, fontWeight: '600' },
  rxInstructions: { fontSize: 12, color: '#8A7E72', lineHeight: 18 },
})