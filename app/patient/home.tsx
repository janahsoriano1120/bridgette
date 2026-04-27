import { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  RefreshControl,
  StatusBar,
} from 'react-native'
import Svg, { Path, Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import TrendsScreen from './trends'
import LifestyleScreen from './lifestyle'
import MedicalRecordsScreen from './medicalrecords'
import ShareLinkScreen from './sharelink'

const SCREEN_WIDTH = Dimensions.get('window').width
const DRAWER_WIDTH = 220

type Period = 'daily' | 'weekly' | 'annual'

const AVAILABLE_TESTS = [
  'Glucose (Fasting)',
  'LDL Cholesterol',
  'Total Cholesterol',
  'HDL Cholesterol',
  'Triglycerides',
  'MCH',
  'Hemoglobin',
  'Testosterone (Total)',
]

export default function PatientHome() {
  const signOut = useAuthStore((state) => state.signOut)
  const session = useAuthStore((state) => state.session)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activePage, setActivePage] = useState<'dashboard' | 'records' | 'trends' | 'lifestyle' | 'share'>('dashboard')
  const [period, setPeriod] = useState<Period>('daily')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTest, setSelectedTest] = useState('Glucose (Fasting)')
  const [testPickerOpen, setTestPickerOpen] = useState(false)
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current

  const [macros, setMacros] = useState({ protein: 0, carbs: 0, fat: 0, fiber: 0 })
  const [hasMacroData, setHasMacroData] = useState(false)
  const [sleepData, setSleepData] = useState<{ label: string, value: number }[]>([
    { label: 'Mon', value: 5 },
    { label: 'Tue', value: 6 },
    { label: 'Wed', value: 5.5 },
    { label: 'Thu', value: 6.5 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 7 },
    { label: 'Sun', value: 6 },
  ])
  const [trendData, setTrendData] = useState<{ label: string, value: number }[]>([
    { label: 'Apr 25', value: 88 },
    { label: 'Jul 25', value: 96 },
    { label: 'Dec 25', value: 102 },
    { label: 'Apr 26', value: 95 },
  ])
  const [summary] = useState('Your FBS trend is stabilizing after dietary changes. LDL at 154 — improving. Keep up the 4x/week exercise routine. Focus on increasing fiber this week.')

  useEffect(() => {
    if (session?.user.id) fetchDashboardData()
  }, [selectedDate, period, selectedTest])

  async function fetchDashboardData() {
    const userId = session?.user.id!
    await Promise.all([fetchMacros(userId), fetchSleep(userId), fetchTrends(userId)])
  }

  async function onRefresh() {
    setRefreshing(true)
    await fetchDashboardData()
    setRefreshing(false)
  }

  async function fetchMacros(userId: string) {
    let query = supabase.from('food_logs').select('protein_g, carbs_g, fat_g, fiber_g').eq('patient_id', userId)
    if (period === 'daily') query = query.eq('log_date', selectedDate)
    else if (period === 'weekly') query = query.gte('log_date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
    else query = query.gte('log_date', new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0])
    const { data } = await query
    if (!data || data.length === 0) { setHasMacroData(false); return }
    const totals = data.reduce((acc, row) => ({
      protein: acc.protein + (row.protein_g || 0),
      carbs: acc.carbs + (row.carbs_g || 0),
      fat: acc.fat + (row.fat_g || 0),
      fiber: acc.fiber + (row.fiber_g || 0),
    }), { protein: 0, carbs: 0, fat: 0, fiber: 0 })
    const total = totals.protein + totals.carbs + totals.fat + totals.fiber
    if (total > 0) {
      setHasMacroData(true)
      setMacros({
        protein: Math.round((totals.protein / total) * 100),
        carbs: Math.round((totals.carbs / total) * 100),
        fat: Math.round((totals.fat / total) * 100),
        fiber: Math.round((totals.fiber / total) * 100),
      })
    } else {
      setHasMacroData(false)
    }
  }

  async function fetchSleep(userId: string) {
    let query = supabase.from('sleep_logs').select('hours_slept, log_date').eq('patient_id', userId).order('log_date', { ascending: true })
    if (period === 'daily') query = query.eq('log_date', selectedDate)
    else if (period === 'weekly') query = query.gte('log_date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
    else query = query.gte('log_date', new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0])
    const { data } = await query
    if (data && data.length > 0) {
      setSleepData(data.map(row => ({
        label: new Date(row.log_date).toLocaleDateString('en-US', { weekday: 'short' }),
        value: row.hours_slept,
      })))
    }
  }

  async function fetchTrends(userId: string) {
    const { data } = await supabase
      .from('lab_values')
      .select('value, record_date')
      .eq('patient_id', userId)
      .eq('test_name', selectedTest)
      .order('record_date', { ascending: true })
    if (data && data.length > 0) {
      setTrendData(data.map(row => ({
        label: new Date(row.record_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        value: row.value,
      })))
    } else {
      setTrendData([])
    }
  }

  function openDrawer() {
    setDrawerOpen(true)
    Animated.timing(drawerAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start()
  }

  function closeDrawer() {
    Animated.timing(drawerAnim, { toValue: -DRAWER_WIDTH, duration: 200, useNativeDriver: true }).start(() => setDrawerOpen(false))
  }

  function navigate(page: typeof activePage) {
    closeDrawer()
    setTimeout(() => setActivePage(page), 200)
  }

  function changeDate(days: number) {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  function formatDate(date: string) {
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    if (date === today) return 'Today'
    if (date === yesterday) return 'Yesterday'
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function renderDonut() {
    const size = 120
    const cx = size / 2
    const cy = size / 2
    const r = 42
    const strokeW = 18
    const circumference = 2 * Math.PI * r
    const colors = ['#3D7A5E', '#C8524A', '#B5720A', '#2C5FAB']
    const values = hasMacroData ? [macros.protein, macros.carbs, macros.fat, macros.fiber] : [25, 25, 25, 25]
    const displayVals = hasMacroData ? [macros.protein, macros.carbs, macros.fat, macros.fiber] : [0, 0, 0, 0]
    const labels = ['Protein', 'Carbs', 'Fat', 'Fiber']
    let offset = 0
    const segments = values.map((val, i) => {
      const dash = (val / 100) * circumference
      const gap = circumference - dash
      const rotate = (offset / 100) * 360 - 90
      offset += val
      return { dash, gap, rotate, color: hasMacroData ? colors[i] : '#E8E4DC', label: labels[i], val: displayVals[i] }
    })
    const dateLabel = formatDate(selectedDate)
    const shortLabel = dateLabel.length > 9 ? dateLabel.substring(0, 8) : dateLabel
    return (
      <View style={styles.donutContainer}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {segments.map((seg, i) => (
            <Circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={strokeW}
              strokeDasharray={`${seg.dash} ${seg.gap}`} transform={`rotate(${seg.rotate} ${cx} ${cy})`} strokeLinecap="butt" />
          ))}
          <SvgText x={cx} y={cy - 5} textAnchor="middle" fontSize="10" fill="#1A1A2E" fontWeight="bold">{shortLabel}</SvgText>
          <SvgText x={cx} y={cy + 9} textAnchor="middle" fontSize="9" fill="#7A7A9A">{hasMacroData ? 'Macros' : 'No data'}</SvgText>
        </Svg>
        <View style={styles.donutLegend}>
          {segments.map((seg, i) => (
            <View key={i} style={styles.donutLegendItem}>
              <View style={[styles.donutDot, { backgroundColor: colors[i] }]} />
              <Text style={styles.donutLegendText}>{seg.label}</Text>
              <Text style={[styles.donutLegendVal, { color: hasMacroData ? colors[i] : '#7A7A9A' }]}>
                {hasMacroData ? `${seg.val}%` : '—'}
              </Text>
            </View>
          ))}
        </View>
      </View>
    )
  }

  function renderLineChart(data: { label: string, value: number }[], color: string) {
    if (data.length < 2) return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyChartText}>No data yet for this selection</Text>
      </View>
    )
    const chartW = SCREEN_WIDTH - 80
    const chartH = 110
    const padTop = 22, padBottom = 26, padLeft = 8, padRight = 8
    const innerW = chartW - padLeft - padRight
    const innerH = chartH - padTop - padBottom
    const values = data.map(d => d.value)
    const minVal = Math.min(...values) * 0.9
    const maxVal = Math.max(...values) * 1.08
    const toX = (i: number) => padLeft + (i / (data.length - 1)) * innerW
    const toY = (val: number) => padTop + ((maxVal - val) / (maxVal - minVal)) * innerH
    const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.value).toFixed(1)}`).join(' ')
    const areaPath = linePath + ` L${toX(data.length - 1).toFixed(1)},${(chartH - padBottom).toFixed(1)} L${toX(0).toFixed(1)},${(chartH - padBottom).toFixed(1)} Z`
    return (
      <Svg width={chartW} height={chartH}>
        <Defs>
          <LinearGradient id={`g${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.15" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill={`url(#g${color.replace('#', '')})`} />
        <Path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <View key={i}>
            <Circle cx={toX(i)} cy={toY(d.value)} r={4} fill="#fff" stroke={color} strokeWidth="2" />
            <SvgText x={toX(i)} y={toY(d.value) - 8} textAnchor="middle" fontSize="9" fontWeight="bold" fill={color}>{d.value}</SvgText>
            <SvgText x={toX(i)} y={chartH - 4} textAnchor="middle" fontSize="8" fill="#7A7A9A">{d.label}</SvgText>
          </View>
        ))}
      </Svg>
    )
  }

  if (activePage === 'records') return <MedicalRecordsScreen onBack={() => setActivePage('dashboard')} />
  if (activePage === 'trends') return <TrendsScreen onBack={() => setActivePage('dashboard')} />
  if (activePage === 'lifestyle') return <LifestyleScreen onBack={() => setActivePage('dashboard')} />
  if (activePage === 'share') return <ShareLinkScreen onBack={() => setActivePage('dashboard')} />

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={openDrawer} style={styles.hamburger}>
          <View style={styles.hLine} />
          <View style={styles.hLine} />
          <View style={styles.hLine} />
        </TouchableOpacity>
        <Text style={styles.topBarLogo}>B</Text>
        <Text style={styles.topBarTitle}>Dashboard</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Text style={styles.refreshIcon}>{refreshing ? '⏳' : '🔄'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <View style={styles.periodRow}>
          {(['daily', 'weekly', 'annual'] as Period[]).map(p => (
            <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodBtnActive]} onPress={() => setPeriod(p)}>
              <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {period === 'daily' && (
          <View style={styles.datePicker}>
            <TouchableOpacity onPress={() => changeDate(-1)}>
              <Text style={styles.dateArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.dateLabel}>{formatDate(selectedDate)}</Text>
            <TouchableOpacity onPress={() => changeDate(1)} disabled={selectedDate >= new Date().toISOString().split('T')[0]}>
              <Text style={[styles.dateArrow, selectedDate >= new Date().toISOString().split('T')[0] && { opacity: 0.3 }]}>›</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.dashboard}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C8524A" colors={['#C8524A']} />}
      >
        {/* TRENDS */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Trends</Text>
            <TouchableOpacity onPress={() => setTestPickerOpen(!testPickerOpen)} style={styles.testSelector}>
              <Text style={styles.testSelectorText} numberOfLines={1}>
                {selectedTest.replace(' Cholesterol', '').replace(' (Fasting)', '')}
              </Text>
              <Text style={styles.testSelectorArrow}>{testPickerOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>
          </View>
          {testPickerOpen && (
            <View style={styles.testDropdown}>
              {AVAILABLE_TESTS.map(test => (
                <TouchableOpacity
                  key={test}
                  style={[styles.testDropdownItem, selectedTest === test && styles.testDropdownItemActive]}
                  onPress={() => { setSelectedTest(test); setTestPickerOpen(false) }}
                >
                  <Text style={[styles.testDropdownText, selectedTest === test && styles.testDropdownTextActive]}>{test}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={{ marginTop: 8 }}>{renderLineChart(trendData, '#3D7A5E')}</View>
          <TouchableOpacity onPress={() => setActivePage('trends')} style={styles.cardLink}>
            <Text style={styles.cardLinkText}>View full trends →</Text>
          </TouchableOpacity>
        </View>

        {/* FOODS */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Foods</Text>
            <TouchableOpacity onPress={() => setActivePage('lifestyle')}>
              <Text style={styles.cardLinkText}>+ Log →</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.cardSub}>
            {period === 'daily' ? formatDate(selectedDate) : period === 'weekly' ? 'This week' : 'This year'} · Macro breakdown
          </Text>
          {!hasMacroData && <Text style={styles.noDataNote}>No meals logged for this period yet</Text>}
          {renderDonut()}
        </View>

        {/* SLEEP */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Sleep</Text>
            <TouchableOpacity onPress={() => setActivePage('lifestyle')}>
              <Text style={styles.cardLinkText}>+ Log →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.legend}>
            <View style={[styles.legendDot, { backgroundColor: '#9B59B6' }]} />
            <Text style={styles.legendText}>Duration (hours)</Text>
          </View>
          <View style={{ marginTop: 8 }}>{renderLineChart(sleepData, '#9B59B6')}</View>
        </View>

        {/* SUMMARY */}
        <View style={[styles.card, styles.summaryCard]}>
          <Text style={styles.summaryIcon}>💡</Text>
          <Text style={styles.summaryTitle}>Summary</Text>
          <Text style={styles.summaryText}>{summary}</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {drawerOpen && (
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeDrawer} />
      )}

      <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>
        <View style={styles.drawerInner}>
          <View style={styles.drawerHeader}>
            <View style={styles.drawerLogo}>
              <Text style={styles.drawerLogoText}>B</Text>
            </View>
            <Text style={styles.drawerBrandName}>bridgette</Text>
          </View>

          <View style={styles.drawerSection}>
  <TouchableOpacity style={styles.drawerItem} onPress={() => navigate('lifestyle')}>
    <Text style={styles.drawerItemText}>🍽 Logged Foods</Text>
  </TouchableOpacity>
  <TouchableOpacity style={styles.drawerItem} onPress={() => navigate('records')}>
    <Text style={styles.drawerItemText}>🧪 Medical Records</Text>
  </TouchableOpacity>
  <TouchableOpacity style={styles.drawerItem} onPress={() => navigate('trends')}>
    <Text style={styles.drawerItemText}>📈 Lab Trends</Text>
  </TouchableOpacity>
  <TouchableOpacity style={styles.drawerItem} onPress={() => navigate('share')}>
    <Text style={styles.drawerItemText}>👥 Care Team</Text>
  </TouchableOpacity>
</View>

<View style={styles.drawerDivider} />

<View style={styles.drawerSection}>
  <Text style={styles.drawerSectionLabel}>SHARE HEALTH LINK</Text>
  <TouchableOpacity style={styles.drawerItem} onPress={() => navigate('share')}>
    <Text style={styles.drawerItemText}>🔗 Share with Doctor</Text>
  </TouchableOpacity>
  <TouchableOpacity style={styles.drawerItem} onPress={() => navigate('share')}>
    <Text style={styles.drawerItemText}>🔗 External Link</Text>
  </TouchableOpacity>
</View>

          <View style={styles.drawerBottom}>
            <TouchableOpacity onPress={signOut} style={styles.drawerSignOut}>
              <Text style={styles.drawerSignOutText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF8F4' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4DC',
  },
  hamburger: { marginRight: 10 },
  hLine: { width: 22, height: 2, backgroundColor: '#1A1A2E', borderRadius: 1, marginBottom: 4 },
  topBarLogo: { fontFamily: 'serif', fontSize: 22, color: '#3D7A5E', fontWeight: '700', marginRight: 8 },
  topBarTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', flex: 1 },
  refreshBtn: { marginRight: 12 },
  refreshIcon: { fontSize: 18 },
  signOutText: { fontSize: 12, color: '#7A7A9A' },
  controls: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4DC',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  periodBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F4F2EE', borderWidth: 1, borderColor: '#E8E4DC' },
  periodBtnActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  periodBtnText: { fontSize: 12, fontWeight: '600', color: '#7A7A9A' },
  periodBtnTextActive: { color: '#fff' },
  datePicker: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateArrow: { fontSize: 24, color: '#C8524A' },
  dateLabel: { fontSize: 13, fontWeight: '600', color: '#1A1A2E' },
  dashboard: { flex: 1, padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E8E4DC' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontFamily: 'serif', fontSize: 16, color: '#1A1A2E' },
  cardSub: { fontSize: 11, color: '#7A7A9A', marginBottom: 4 },
  noDataNote: { fontSize: 12, color: '#7A7A9A', fontStyle: 'italic', marginBottom: 4 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#7A7A9A' },
  cardLink: { alignSelf: 'flex-end', marginTop: 8 },
  cardLinkText: { fontSize: 12, color: '#C8524A', fontWeight: '600' },
  emptyChart: { height: 60, alignItems: 'center', justifyContent: 'center' },
  emptyChartText: { fontSize: 12, color: '#7A7A9A', fontStyle: 'italic' },
  testSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F2EE', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#E8E4DC', maxWidth: 160 },
  testSelectorText: { fontSize: 11, fontWeight: '600', color: '#1A1A2E', flex: 1 },
  testSelectorArrow: { fontSize: 10, color: '#7A7A9A' },
  testDropdown: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E8E4DC', marginTop: 6, marginBottom: 4, overflow: 'hidden' },
  testDropdownItem: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F4F2EE' },
  testDropdownItemActive: { backgroundColor: '#F4F2EE' },
  testDropdownText: { fontSize: 13, color: '#7A7A9A' },
  testDropdownTextActive: { color: '#1A1A2E', fontWeight: '600' },
  donutContainer: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  donutLegend: { flex: 1, gap: 8 },
  donutLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  donutDot: { width: 10, height: 10, borderRadius: 5 },
  donutLegendText: { fontSize: 12, color: '#7A7A9A', flex: 1 },
  donutLegendVal: { fontSize: 13, fontWeight: '700' },
  summaryCard: { backgroundColor: '#F3EFFA', borderColor: '#D4C5F0' },
  summaryIcon: { fontSize: 20, marginBottom: 6 },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: '#6B4FA0', marginBottom: 6 },
  summaryText: { fontSize: 13, color: '#4A3A6A', lineHeight: 20 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 10 },
  drawer: { position: 'absolute', top: 0, left: 0, bottom: 0, width: DRAWER_WIDTH, backgroundColor: '#1A1A2E', zIndex: 20, shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 20 },
  drawerInner: { flex: 1, paddingTop: 56 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  drawerLogo: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#3D7A5E', alignItems: 'center', justifyContent: 'center' },
  drawerLogoText: { fontFamily: 'serif', fontSize: 20, color: '#fff', fontWeight: '700' },
  drawerBrandName: { fontFamily: 'serif', fontSize: 18, color: '#fff' },
  drawerSection: { paddingHorizontal: 12, paddingTop: 16 },
  drawerSectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: 'rgba(255,255,255,0.35)', paddingHorizontal: 10, marginBottom: 8 },
  drawerItem: { paddingHorizontal: 10, paddingVertical: 13, borderRadius: 10, marginBottom: 2 },
  drawerItemText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  drawerDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 20, marginVertical: 8 },
  drawerBottom: { position: 'absolute', bottom: 40, left: 0, right: 0, paddingHorizontal: 20 },
  drawerSignOut: { paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  drawerSignOutText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
})