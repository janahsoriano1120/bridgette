import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native'
import Svg, { Path, Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg'
import { supabase } from '../../lib/supabase'

const SCREEN_WIDTH = Dimensions.get('window').width

const TRACKED_TESTS = [
  'LDL Cholesterol',
  'Total Cholesterol',
  'HDL Cholesterol',
  'Triglycerides',
  'Glucose (Fasting)',
  'MCH',
  'Hemoglobin',
  'Testosterone (Total)',
]

type DataPoint = { label: string; value: number }
type TrendSeries = {
  test_name: string
  unit: string
  reference_high: number | null
  reference_low: number | null
  points: DataPoint[]
}

type Props = {
  patientId: string
  patientName: string
  onBack: () => void
}

export default function PatientTrendsScreen({ patientId, patientName, onBack }: Props) {
  const [trends, setTrends] = useState<TrendSeries[]>([])
  const [selected, setSelected] = useState('LDL Cholesterol')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTrends()
  }, [])

  async function fetchTrends() {
    const { data } = await supabase
      .from('lab_values')
      .select('test_name, value, unit, reference_high, reference_low, record_date')
      .eq('patient_id', patientId)
      .in('test_name', TRACKED_TESTS)
      .order('record_date', { ascending: true })

    if (data) {
      const grouped: Record<string, TrendSeries> = {}
      data.forEach((row) => {
        if (!grouped[row.test_name]) {
          grouped[row.test_name] = {
            test_name: row.test_name,
            unit: row.unit,
            reference_high: row.reference_high,
            reference_low: row.reference_low,
            points: [],
          }
        }
        const exists = grouped[row.test_name].points.find(p => p.label === new Date(row.record_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }))
        if (!exists) {
          grouped[row.test_name].points.push({
            label: new Date(row.record_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            value: row.value,
          })
        }
      })
      setTrends(Object.values(grouped))
    }
    setLoading(false)
  }

  function renderLineChart(series: TrendSeries) {
    if (series.points.length < 2) return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyChartText}>Not enough data points</Text>
      </View>
    )

    const chartW = SCREEN_WIDTH - 64
    const chartH = 130
    const padTop = 24, padBottom = 28, padLeft = 8, padRight = 8
    const innerW = chartW - padLeft - padRight
    const innerH = chartH - padTop - padBottom
    const values = series.points.map(d => d.value)
    const minVal = Math.min(...values) * 0.88
    const maxVal = Math.max(...values) * 1.08
    const toX = (i: number) => padLeft + (i / (series.points.length - 1)) * innerW
    const toY = (val: number) => padTop + ((maxVal - val) / (maxVal - minVal)) * innerH
    const linePath = series.points.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.value).toFixed(1)}`).join(' ')
    const areaPath = linePath + ` L${toX(series.points.length - 1).toFixed(1)},${(chartH - padBottom).toFixed(1)} L${toX(0).toFixed(1)},${(chartH - padBottom).toFixed(1)} Z`

    const latest = series.points[series.points.length - 1]
    const prev = series.points[series.points.length - 2]
    const isImproving = latest.value <= prev.value
    const color = isImproving ? '#3D7A5E' : '#C8524A'

    const refY = series.reference_high ? toY(series.reference_high) : null

    return (
      <View style={{ marginTop: 8 }}>
        <Svg width={chartW} height={chartH}>
          <Defs>
            <LinearGradient id={`g${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.12" />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          {refY && (
            <Path
              d={`M${padLeft},${refY} L${chartW - padRight},${refY}`}
              stroke="#3D7A5E"
              strokeWidth="1"
              strokeDasharray="4,3"
              opacity="0.5"
            />
          )}
          <Path d={areaPath} fill={`url(#g${color.replace('#', '')})`} />
          <Path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {series.points.map((d, i) => (
            <View key={i}>
              <Circle cx={toX(i)} cy={toY(d.value)} r={5} fill="#fff" stroke={color} strokeWidth="2.5" />
              <SvgText x={toX(i)} y={toY(d.value) - 10} textAnchor="middle" fontSize="10" fontWeight="bold" fill={color}>{d.value}</SvgText>
              <SvgText x={toX(i)} y={chartH - 4} textAnchor="middle" fontSize="8" fill="#7A7A9A">{d.label}</SvgText>
            </View>
          ))}
        </Svg>
        {series.reference_high && (
          <Text style={styles.refNote}>- - - Target: &lt;{series.reference_high} {series.unit}</Text>
        )}
      </View>
    )
  }

  const activeSeries = trends.find(t => t.test_name === selected)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Lab Trends</Text>
        <Text style={styles.subtitle}>{patientName}</Text>
      </View>

      {/* Clinical story */}
      <View style={styles.storyBanner}>
        <Text style={styles.storyTitle}>📖 Clinical Summary</Text>
        <Text style={styles.storyText}>
          Started Diane-35 in April 2025 for hormonal acne. Lipid markers worsened over 9 months. Stopped the pill and changed diet in January 2026. Cholesterol improving but still above target.
        </Text>
      </View>

      {/* Milestones */}
      <View style={styles.milestoneRow}>
        <View style={styles.milestone}>
          <View style={[styles.milestoneDot, { backgroundColor: '#9B59B6' }]} />
          <Text style={styles.milestoneText}>💊 Diane-35 started Apr 2025</Text>
        </View>
        <View style={styles.milestone}>
          <View style={[styles.milestoneDot, { backgroundColor: '#3D7A5E' }]} />
          <Text style={styles.milestoneText}>🥗 Off pill + diet Jan 2026</Text>
        </View>
      </View>

      {/* Test selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.selectorContent}
      >
        {TRACKED_TESTS.map((test) => {
          const series = trends.find(t => t.test_name === test)
          if (!series) return null
          const latest = series.points[series.points.length - 1]
          const prev = series.points[series.points.length - 2]
          const trending = latest && prev ? (latest.value < prev.value ? '↓' : '↑') : ''
          const isFlagged =
            (series.reference_high !== null && latest?.value > series.reference_high) ||
            (series.reference_low !== null && latest?.value < series.reference_low)

          return (
            <TouchableOpacity
              key={test}
              style={[
                styles.selectorChip,
                selected === test && styles.selectorChipActive,
                isFlagged && selected !== test && styles.selectorChipFlagged,
              ]}
              onPress={() => setSelected(test)}
            >
              <Text style={[styles.selectorChipText, selected === test && styles.selectorChipTextActive]}>
                {test.replace(' Cholesterol', '').replace(' (Fasting)', '')}
              </Text>
              {trending ? (
                <Text style={[styles.selectorTrend, trending === '↓' ? styles.trendGood : styles.trendBad]}>
                  {trending}
                </Text>
              ) : null}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <ScrollView style={styles.content}>
        {loading ? (
          <Text style={styles.loadingText}>Loading trends...</Text>
        ) : activeSeries ? (
          <>
            {/* Active chart */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>{activeSeries.test_name}</Text>
                <View style={styles.chartLatest}>
                  <Text style={styles.chartLatestVal}>
                    {activeSeries.points[activeSeries.points.length - 1]?.value}
                  </Text>
                  <Text style={styles.chartLatestUnit}> {activeSeries.unit}</Text>
                </View>
              </View>
              <Text style={styles.chartSub}>
                {activeSeries.points.length} readings · latest {activeSeries.points[activeSeries.points.length - 1]?.label}
              </Text>
              {renderLineChart(activeSeries)}
            </View>

            {/* Summary table */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>All Tracked Values</Text>
              {trends.map((series) => {
                const latest = series.points[series.points.length - 1]
                const first = series.points[0]
                const diff = latest && first ? +(latest.value - first.value).toFixed(1) : 0
                const isFlagged =
                  (series.reference_high !== null && latest?.value > series.reference_high) ||
                  (series.reference_low !== null && latest?.value < series.reference_low)

                return (
                  <TouchableOpacity
                    key={series.test_name}
                    style={styles.summaryRow}
                    onPress={() => setSelected(series.test_name)}
                  >
                    <View style={styles.summaryLeft}>
                      <Text style={styles.summaryName}>{series.test_name}</Text>
                      <Text style={styles.summaryChange}>
                        {diff > 0 ? '+' : ''}{diff} {series.unit} since first reading
                      </Text>
                    </View>
                    <View style={styles.summaryRight}>
                      <Text style={[styles.summaryVal, isFlagged && styles.summaryValFlagged]}>
                        {latest?.value}
                      </Text>
                      <Text style={styles.summaryUnit}>{series.unit}</Text>
                    </View>
                    <View style={[styles.summaryFlag, isFlagged ? styles.summaryFlagBad : styles.summaryFlagGood]}>
                      <Text style={styles.summaryFlagText}>{isFlagged ? '⚠' : '✓'}</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          </>
        ) : (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyChartText}>No trend data available</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingBottom: 14,
    paddingHorizontal: 24,
  },
  backBtn: { marginBottom: 10 },
  backText: { fontSize: 15, color: '#C8524A', fontWeight: '600' },
  title: { fontFamily: 'serif', fontSize: 22, color: '#1A1A2E', marginBottom: 2 },
  subtitle: { fontSize: 13, color: '#7A7A9A' },
  storyBanner: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#F3EFFA',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#9B59B6',
  },
  storyTitle: { fontSize: 12, fontWeight: '700', color: '#6B4FA0', marginBottom: 5 },
  storyText: { fontSize: 12, color: '#4A3A6A', lineHeight: 18 },
  milestoneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, marginBottom: 4 },
  milestone: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  milestoneDot: { width: 8, height: 8, borderRadius: 4 },
  milestoneText: { fontSize: 11, color: '#7A7A9A' },
  selectorContent: { paddingHorizontal: 16, gap: 8, paddingVertical: 10 },
  selectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },
  selectorChipActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  selectorChipFlagged: { borderColor: '#E8B96A', backgroundColor: '#FDF3E3' },
  selectorChipText: { fontSize: 12, fontWeight: '600', color: '#7A7A9A' },
  selectorChipTextActive: { color: '#fff' },
  selectorTrend: { fontSize: 13, fontWeight: '700' },
  trendGood: { color: '#3D7A5E' },
  trendBad: { color: '#C8524A' },
  content: { flex: 1, padding: 16 },
  loadingText: { fontSize: 13, color: '#7A7A9A', textAlign: 'center', marginTop: 40 },
  emptyChart: { height: 60, alignItems: 'center', justifyContent: 'center' },
  emptyChartText: { fontSize: 12, color: '#7A7A9A', fontStyle: 'italic' },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  chartTitle: { fontFamily: 'serif', fontSize: 16, color: '#1A1A2E', flex: 1 },
  chartLatest: { flexDirection: 'row', alignItems: 'baseline' },
  chartLatestVal: { fontSize: 22, fontWeight: '700', color: '#C8524A' },
  chartLatestUnit: { fontSize: 12, color: '#7A7A9A' },
  chartSub: { fontSize: 11, color: '#7A7A9A', marginBottom: 4 },
  refNote: { fontSize: 11, color: '#3D7A5E', marginTop: 4 },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#7A7A9A',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE8',
  },
  summaryLeft: { flex: 1 },
  summaryName: { fontSize: 13, fontWeight: '500', color: '#1A1A2E', marginBottom: 2 },
  summaryChange: { fontSize: 11, color: '#7A7A9A' },
  summaryRight: { alignItems: 'flex-end', marginRight: 10 },
  summaryVal: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  summaryValFlagged: { color: '#C8524A' },
  summaryUnit: { fontSize: 10, color: '#7A7A9A' },
  summaryFlag: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  summaryFlagBad: { backgroundColor: '#FDF3E3' },
  summaryFlagGood: { backgroundColor: '#EAF4EE' },
  summaryFlagText: { fontSize: 12 },
})