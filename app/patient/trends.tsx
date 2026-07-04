import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle, Line, Rect, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import Icon from '../../components/Icon'

const SCREEN_WIDTH = Dimensions.get('window').width

type DataPoint = {
  date: string
  value: number
}

type TrendSeries = {
  test_name: string
  unit: string
  reference_high: number | null
  reference_low: number | null
  points: DataPoint[]
}

function getRangeStatus(
  value: number,
  low: number | null,
  high: number | null
): 'in_range' | 'out_of_range' | 'no_range' {
  if (high !== null && value > high) return 'out_of_range'
  if (low !== null && value < low) return 'out_of_range'
  if (high === null && low === null) return 'no_range'
  return 'in_range'
}

function baselineCaption(
  value: number,
  low: number | null,
  high: number | null,
  unit: string
): { text: string; color: string } {
  if (high !== null && value > high) {
    const over = +(value - high).toFixed(2)
    return { text: `Above the reference range (${over} ${unit} over ${high})`, color: '#B5451B' }
  }
  if (low !== null && value < low) {
    const under = +(low - value).toFixed(2)
    return { text: `Below the reference range (${under} ${unit} under ${low})`, color: '#B5451B' }
  }
  if (low !== null || high !== null) {
    return { text: 'Within the reference range', color: '#5C7340' }
  }
  return { text: 'No reference range on file for this test', color: '#8A7E72' }
}

export default function TrendsScreen({ onBack }: { onBack: () => void }) {
  const session = useAuthStore((state) => state.session)
  const [trends, setTrends] = useState<TrendSeries[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTrends()
  }, [])

  async function fetchTrends() {
    const { data, error } = await supabase
      .from('lab_values')
      .select('test_name, value, unit, reference_high, reference_low, record_date')
      .eq('patient_id', session?.user.id)
      .order('record_date', { ascending: true })

    if (!error && data) {
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
        // Avoid duplicate dates
        const exists = grouped[row.test_name].points.find(p => p.date === row.record_date)
        if (!exists) {
          grouped[row.test_name].points.push({
            date: row.record_date,
            value: row.value,
          })
        }
      })

      // Tests with the most history first, then alphabetical
      const sorted = Object.values(grouped).sort(
        (a, b) =>
          b.points.length - a.points.length ||
          a.test_name.localeCompare(b.test_name)
      )
      setTrends(sorted)

      // Pick a sensible default: LDL if present, otherwise the first test
      const ldl = sorted.find((t) => t.test_name === 'LDL Cholesterol')
      setSelected(ldl ? ldl.test_name : sorted[0]?.test_name ?? null)
    }
    setLoading(false)
  }

  function formatDate(date: string) {
    const d = new Date(date)
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }

  function shortName(name: string) {
    return name
      .replace(' Cholesterol', '')
      .replace(' (Fasting)', '')
      .replace(' (Total)', '')
      .replace(' Count', '')
  }

  function renderBaseline(series: TrendSeries) {
    const chartWidth = SCREEN_WIDTH - 64
    const chartHeight = 180
    const padTop = 30
    const padBottom = 35
    const innerH = chartHeight - padTop - padBottom

    const point = series.points[0]
    const low = series.reference_low
    const high = series.reference_high

    const candidates = [point.value]
    if (low !== null) candidates.push(low)
    if (high !== null) candidates.push(high)
    let minVal = Math.min(...candidates)
    let maxVal = Math.max(...candidates)
    const span = (maxVal - minVal) || Math.abs(point.value) || 1
    minVal = minVal - span * 0.25
    maxVal = maxVal + span * 0.25

    const toY = (val: number) => padTop + ((maxVal - val) / (maxVal - minVal)) * innerH

    const cx = chartWidth / 2
    const status = getRangeStatus(point.value, low, high)
    const dotColor = status === 'out_of_range' ? '#B5451B' : '#5C7340'

    const bandTopVal = high !== null ? high : maxVal
    const bandBottomVal = low !== null ? low : minVal
    const bandY = toY(bandTopVal)
    const bandH = toY(bandBottomVal) - toY(bandTopVal)

    const caption = baselineCaption(point.value, low, high, series.unit)

    return (
      <View style={{ marginTop: 8 }}>
        <Svg width={chartWidth} height={chartHeight}>
          {/* Normal-range band */}
          {(low !== null || high !== null) && (
            <Rect x={0} y={bandY} width={chartWidth} height={bandH} fill="#5C7340" opacity={0.1} />
          )}
          {/* Upper edge + its value */}
          {high !== null && (
            <>
              <Line x1={0} y1={toY(high)} x2={chartWidth} y2={toY(high)} stroke="#5C7340" strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />
              <SvgText x={chartWidth - 4} y={toY(high) - 4} textAnchor="end" fontSize="9" fill="#5C7340">
                {`High ${high}`}
              </SvgText>
            </>
          )}
          {/* Lower edge + its value */}
          {low !== null && (
            <>
              <Line x1={0} y1={toY(low)} x2={chartWidth} y2={toY(low)} stroke="#5C7340" strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />
              <SvgText x={chartWidth - 4} y={toY(low) + 12} textAnchor="end" fontSize="9" fill="#5C7340">
                {`Low ${low}`}
              </SvgText>
            </>
          )}
          {/* The single reading */}
          <Circle cx={cx} cy={toY(point.value)} r={7} fill="#fff" stroke={dotColor} strokeWidth="3" />
          <SvgText x={cx} y={toY(point.value) - 14} textAnchor="middle" fontSize="13" fontWeight="bold" fill={dotColor}>
            {point.value}
          </SvgText>
          <SvgText x={cx} y={chartHeight - 6} textAnchor="middle" fontSize="9" fill="#8A7E72">
            {formatDate(point.date)}
          </SvgText>
        </Svg>
        <Text style={styles.rangeLabel}>
          {low !== null && high !== null
            ? `Reference range: ${low} to ${high} ${series.unit}`
            : high !== null
            ? `Reference: below ${high} ${series.unit}`
            : low !== null
            ? `Reference: above ${low} ${series.unit}`
            : 'No reference range on file'}
        </Text>
        <Text style={[styles.refNote, { color: caption.color }]}>{caption.text}</Text>
      </View>
    )
  } 

  function renderChart(series: TrendSeries) {
    if (series.points.length < 2) {
      return renderBaseline(series)
    }

    const chartWidth = SCREEN_WIDTH - 64
    const chartHeight = 180
    const padTop = 30
    const padBottom = 35
    const padLeft = 10
    const padRight = 10
    const innerW = chartWidth - padLeft - padRight
    const innerH = chartHeight - padTop - padBottom

    const low = series.reference_low
    const high = series.reference_high

    // Y-axis must include the data AND the reference lines so the band is visible
    const values = series.points.map((p) => p.value)
    const candidates = [...values]
    if (low !== null) candidates.push(low)
    if (high !== null) candidates.push(high)
    const rawMin = Math.min(...candidates)
    const rawMax = Math.max(...candidates)
    const span = (rawMax - rawMin) || Math.abs(values[0]) || 1
    const minVal = rawMin - span * 0.15
    const maxVal = rawMax + span * 0.15

    const toX = (i: number) =>
      padLeft + (i / (series.points.length - 1)) * innerW

    const toY = (val: number) =>
      padTop + ((maxVal - val) / (maxVal - minVal)) * innerH

    const linePath = series.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`)
      .join(' ')

    const areaPath =
      linePath +
      ` L${toX(series.points.length - 1).toFixed(1)},${(chartHeight - padBottom).toFixed(1)}` +
      ` L${toX(0).toFixed(1)},${(chartHeight - padBottom).toFixed(1)} Z`

    const latest = series.points[series.points.length - 1]
    const rangeStatus = getRangeStatus(latest.value, low, high)
    const lineColor = rangeStatus === 'out_of_range' ? '#B5451B' : '#5C7340'

    const bandTopVal = high !== null ? high : maxVal
    const bandBottomVal = low !== null ? low : minVal
    const bandY = toY(bandTopVal)
    const bandH = toY(bandBottomVal) - toY(bandTopVal)

    return (
      <View style={{ marginTop: 8 }}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={lineColor} stopOpacity="0.15" />
              <Stop offset="1" stopColor={lineColor} stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {/* Normal-range band */}
          {(low !== null || high !== null) && (
            <Rect x={0} y={bandY} width={chartWidth} height={bandH} fill="#5C7340" opacity={0.08} />
          )}
          {/* Upper edge + value */}
          {high !== null && (
            <>
              <Line x1={padLeft} y1={toY(high)} x2={chartWidth - padRight} y2={toY(high)} stroke="#5C7340" strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />
              <SvgText x={chartWidth - padRight} y={toY(high) - 4} textAnchor="end" fontSize="9" fill="#5C7340">
                {`High ${high}`}
              </SvgText>
            </>
          )}
          {/* Lower edge + value */}
          {low !== null && (
            <>
              <Line x1={padLeft} y1={toY(low)} x2={chartWidth - padRight} y2={toY(low)} stroke="#5C7340" strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />
              <SvgText x={chartWidth - padRight} y={toY(low) + 12} textAnchor="end" fontSize="9" fill="#5C7340">
                {`Low ${low}`}
              </SvgText>
            </>
          )}

          {/* Area */}
          <Path d={areaPath} fill="url(#areaGrad)" />

          {/* Line */}
          <Path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Dots + labels */}
          {series.points.map((p, i) => (
            <View key={i}>
              <Circle
                cx={toX(i)}
                cy={toY(p.value)}
                r={5}
                fill="#fff"
                stroke={lineColor}
                strokeWidth="2.5"
              />
              <SvgText
                x={toX(i)}
                y={toY(p.value) - 10}
                textAnchor="middle"
                fontSize="11"
                fontWeight="bold"
                fill={lineColor}
              >
                {p.value}
              </SvgText>
              <SvgText
                x={toX(i)}
                y={chartHeight - 6}
                textAnchor="middle"
                fontSize="9"
                fill="#8A7E72"
              >
                {formatDate(p.date)}
              </SvgText>
            </View>
          ))}
        </Svg>
        <Text style={styles.rangeLabel}>
          {low !== null && high !== null
            ? `Reference range: ${low} to ${high} ${series.unit}`
            : high !== null
            ? `Reference: below ${high} ${series.unit}`
            : low !== null
            ? `Reference: above ${low} ${series.unit}`
            : 'No reference range on file'}
        </Text>
      </View>
    )
  }

  const activeSeries = trends.find((t) => t.test_name === selected)

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <View style={styles.backRow}>
            <Icon name="back" size={18} color="#5C7340" />
            <Text style={styles.backText}>Back</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>Lab Trends</Text>
        <Text style={styles.subtitle}>
          {trends.length > 0
            ? `Tracking ${trends.length} markers from your records`
            : 'Your lab results over time'}
        </Text>
      </View>

      {/* Test selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.selectorContent}
      >
        {trends.map((series) => {
          const test = series.test_name
          const latest = series.points[series.points.length - 1]
          const prev = series.points[series.points.length - 2]
          const direction = latest && prev
            ? (latest.value < prev.value ? 'down' : latest.value > prev.value ? 'up' : 'steady')
            : null
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
              <Text style={[
                styles.selectorChipText,
                selected === test && styles.selectorChipTextActive,
              ]}>
                {shortName(test)}
              </Text>
              {direction ? (
                <Icon
                  name={direction}
                  size={13}
                  color={selected === test ? '#FFFFFF' : '#3D3229'}
                />
              ) : null}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Active chart */}
      {loading ? (
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>Loading trends...</Text>
        </View>
      ) : activeSeries ? (
        <Animated.View key={selected} entering={FadeIn.duration(350)} style={styles.chartCard}>
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
            {activeSeries.points.length > 1
              ? `${activeSeries.points.length} readings · latest ${formatDate(activeSeries.points[activeSeries.points.length - 1]?.date)}`
              : `Baseline reading · ${formatDate(activeSeries.points[0]?.date)}`}
          </Text>
          {renderChart(activeSeries)}
        </Animated.View>
      ) : null}

      {/* Summary table */}
      <Animated.View entering={FadeInDown.delay(150)} style={styles.summaryCard}>
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
                  {series.points.length > 1
                    ? `${diff > 0 ? '+' : ''}${diff} ${series.unit} since ${formatDate(first?.date)}`
                    : `Baseline · ${formatDate(first?.date)}`}
                </Text>
              </View>
              <View style={styles.summaryRight}>
                <Text style={[styles.summaryVal, isFlagged && styles.summaryValFlagged]}>
                  {latest?.value}
                </Text>
                <Text style={styles.summaryUnit}>{series.unit}</Text>
              </View>
              <View style={[styles.summaryFlag, isFlagged ? styles.summaryFlagBad : styles.summaryFlagGood]}>
                <Icon
                  name={isFlagged ? 'flagged' : 'ok'}
                  size={14}
                  color={isFlagged ? '#B5451B' : '#5C7340'}
                />
              </View>
            </TouchableOpacity>
          )
        })}
      </Animated.View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F2EC' },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5DFD3',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 24,
  },
  backBtn: { marginBottom: 12 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 16, color: '#5C7340', fontWeight: '600' },
  title: { fontFamily: 'Georgia', fontSize: 22, color: '#3D3229', marginBottom: 3 },
  subtitle: { fontSize: 13, color: '#8A7E72' },
  selectorContent: { paddingHorizontal: 16, gap: 8, paddingVertical: 12 },
  selectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5DFD3',
  },
  selectorChipActive: { backgroundColor: '#3D3229', borderColor: '#3D3229' },
  selectorChipFlagged: { borderColor: '#DCC089', backgroundColor: '#F6EDDA' },
  selectorChipText: { fontSize: 12, fontWeight: '600', color: '#8A7E72' },
  selectorChipTextActive: { color: '#fff' },
  loadingBox: { padding: 40, alignItems: 'center' },
  loadingText: { fontSize: 14, color: '#8A7E72' },
  chartCard: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5DFD3',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  chartTitle: { fontFamily: 'Georgia', fontSize: 17, color: '#3D3229', flex: 1 },
  chartLatest: { flexDirection: 'row', alignItems: 'baseline' },
  chartLatestVal: { fontSize: 22, fontWeight: '700', color: '#3D3229' },
  chartLatestUnit: { fontSize: 12, color: '#8A7E72' },
  chartSub: { fontSize: 12, color: '#8A7E72', marginBottom: 4 },
  rangeLabel: { fontSize: 12, fontWeight: '600', color: '#3D3229', marginTop: 8 },
  refNote: { fontSize: 11, color: '#5C7340', marginTop: 6 },
  summaryCard: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5DFD3',
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#8A7E72',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EBE5DA',
  },
  summaryLeft: { flex: 1 },
  summaryName: { fontSize: 13, fontWeight: '500', color: '#3D3229', marginBottom: 2 },
  summaryChange: { fontSize: 11, color: '#8A7E72' },
  summaryRight: { alignItems: 'flex-end', marginRight: 10 },
  summaryVal: { fontSize: 15, fontWeight: '700', color: '#3D3229' },
  summaryValFlagged: { color: '#B5451B' },
  summaryUnit: { fontSize: 10, color: '#8A7E72' },
  summaryFlag: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryFlagBad: { backgroundColor: '#F6EDDA' },
  summaryFlagGood: { backgroundColor: '#EBEFE3' },
})