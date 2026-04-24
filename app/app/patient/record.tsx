import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { supabase } from '../../lib/supabase'

type LabValue = {
  id: string
  test_name: string
  value: number
  unit: string
  reference_low: number | null
  reference_high: number | null
  is_flagged: boolean
}

type Props = {
  recordId: string
  labFacility: string
  recordDate: string
  onBack: () => void
}

export default function RecordDetail({ recordId, labFacility, recordDate, onBack }: Props) {
  const [labValues, setLabValues] = useState<LabValue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLabValues()
  }, [])

  async function fetchLabValues() {
    const { data, error } = await supabase
      .from('lab_values')
      .select('*')
      .eq('record_id', recordId)
      .order('test_name', { ascending: true })

    if (!error && data) setLabValues(data)
    setLoading(false)
  }

  function getFlag(value: number, low: number | null, high: number | null) {
    if (high !== null && value > high) return 'high'
    if (low !== null && value < low) return 'low'
    return 'normal'
  }

  // Group lab values by category
  const categories: Record<string, LabValue[]> = {
    'Hematology': labValues.filter(v =>
      ['RBC Count', 'Hemoglobin', 'HCT', 'MCV', 'MCH', 'MCHC', 'RDW-CV',
       'WBC Count', 'Neutrophils', 'Lymphocytes', 'Monocytes', 'Eosinophils',
       'Basophils', 'Platelet Count'].includes(v.test_name)
    ),
    'Lipid Profile': labValues.filter(v =>
      ['Total Cholesterol', 'HDL Cholesterol', 'Non-HDL Cholesterol',
       'Triglycerides', 'LDL Cholesterol', 'VLDL Cholesterol',
       'Total Cholesterol/HDL'].includes(v.test_name)
    ),
    'Clinical Chemistry': labValues.filter(v =>
      ['Glucose (Fasting)', 'Creatinine', 'eGFR', 'ALT (SGPT)', 'AST (SGOT)'].includes(v.test_name)
    ),
    'Hormones': labValues.filter(v =>
      ['Testosterone (Total)', 'DHEA-Sulfate'].includes(v.test_name)
    ),
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.facility}>{labFacility}</Text>
          <Text style={styles.date}>{recordDate}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#C8524A" />
      ) : labValues.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No lab values found for this record.</Text>
        </View>
      ) : (
        <View style={styles.content}>
          {/* Flagged values summary */}
          {labValues.filter(v => v.is_flagged).length > 0 && (
            <View style={styles.flaggedSection}>
              <Text style={styles.flaggedTitle}>
                ⚠️ {labValues.filter(v => v.is_flagged).length} values need attention
              </Text>
              {labValues.filter(v => v.is_flagged).map(v => (
                <View key={v.id} style={styles.flaggedItem}>
                  <Text style={styles.flaggedName}>{v.test_name}</Text>
                  <Text style={styles.flaggedValue}>
                    {v.value} {v.unit}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* All values by category */}
          {Object.entries(categories).map(([category, values]) =>
            values.length > 0 ? (
              <View key={category} style={styles.category}>
                <Text style={styles.categoryTitle}>{category}</Text>
                {values.map((v) => {
                  const flag = getFlag(v.value, v.reference_low, v.reference_high)
                  return (
                    <View key={v.id} style={styles.labRow}>
                      <View style={styles.labLeft}>
                        <Text style={styles.labName}>{v.test_name}</Text>
                        <Text style={styles.labRef}>
                          Ref: {v.reference_low ?? '—'} – {v.reference_high ?? '—'} {v.unit}
                        </Text>
                      </View>
                      <View style={styles.labRight}>
                        <Text style={[
                          styles.labValue,
                          flag === 'high' && styles.valueHigh,
                          flag === 'low' && styles.valueLow,
                        ]}>
                          {v.value}
                        </Text>
                        <Text style={styles.labUnit}>{v.unit}</Text>
                      </View>
                      <View style={[
                        styles.flagBadge,
                        flag === 'high' && styles.flagHigh,
                        flag === 'low' && styles.flagLow,
                        flag === 'normal' && styles.flagNormal,
                      ]}>
                        <Text style={styles.flagText}>
                          {flag === 'high' ? '↑' : flag === 'low' ? '↓' : '✓'}
                        </Text>
                      </View>
                    </View>
                  )
                })}
              </View>
            ) : null
          )}
        </View>
      )}
    </ScrollView>
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
  headerInfo: {},
  facility: { fontFamily: 'serif', fontSize: 20, color: '#1A1A2E', marginBottom: 4 },
  date: { fontSize: 13, color: '#7A7A9A' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#7A7A9A' },
  content: { padding: 16 },
  flaggedSection: {
    backgroundColor: '#FDF3E3',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8B96A',
  },
  flaggedTitle: { fontSize: 13, fontWeight: '700', color: '#B5720A', marginBottom: 10 },
  flaggedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#E8D5A0',
  },
  flaggedName: { fontSize: 13, color: '#1A1A2E' },
  flaggedValue: { fontSize: 13, fontWeight: '600', color: '#B5720A' },
  category: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },
  categoryTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#7A7A9A',
    marginBottom: 12,
  },
  labRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE8',
  },
  labLeft: { flex: 1 },
  labName: { fontSize: 13, fontWeight: '500', color: '#1A1A2E', marginBottom: 2 },
  labRef: { fontSize: 11, color: '#7A7A9A' },
  labRight: { alignItems: 'flex-end', marginRight: 10 },
  labValue: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  valueHigh: { color: '#C0392B' },
  valueLow: { color: '#2563EB' },
  labUnit: { fontSize: 10, color: '#7A7A9A', marginTop: 1 },
  flagBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagHigh: { background: '#FDECEA' },
  flagLow: { backgroundColor: '#EBF1FB' },
  flagNormal: { backgroundColor: '#EAF4EE' },
  flagText: { fontSize: 12, fontWeight: '700' },
})