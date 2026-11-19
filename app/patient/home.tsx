import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  RefreshControl,
  StatusBar,
  ImageBackground,
  Image,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager, PanResponder } from 'react-native'
import { BlurView } from 'expo-blur'
import ReAnimated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, cancelAnimation, Easing, runOnJS } from 'react-native-reanimated'
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler'
import Svg, { Path, Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import Icon from '../../components/Icon'
import { KidMed, KidLog, slotsFor, takenKeys, scheduledToday, dueSlots } from '../../lib/kidMeds'
import { ageText, daysOld, parseISO as parseKidISO } from '../../lib/kidsSchedule'
import { signedUrl } from '../../lib/shareData'
import TrendsScreen from './trends'
import LifestyleScreen, { LifestyleStart } from './lifestyle'
import MedicalRecordsScreen from './medicalrecords'
import ShareLinkScreen from './sharelink'
import DocNoteScreen from './docnote'
import { registerPushToken } from '../../lib/pushToken'
import * as ExpoNotifications from 'expo-notifications'
import SupplementsScreen from './supplements'
import PatientNotificationsScreen from './notifications'
import CaregivingScreen from './caregiving'
import ProfileScreen from './profile'
import SettingsScreen from './settings'
import CommunityScreen from './community'
import VaccinesScreen from './vaccines'
import PetsScreen from './pets'
import LabelReaderScreen from './labelreader'
import GroceryScreen from './grocery'
import DoctorMessages from '../../components/DoctorMessages'
import NotificationsPopover from '../../components/NotificationsPopover'
import ScreenBackground from '../../components/ScreenBackground'
import { getRecentNote, getFollowUps, syncSharedNotes, providerFullName } from './sharelink'
import CaregiversScreen from './caregivers'
import PatientTabBar from '../../components/PatientTabBar'
import EdgeFades from '../../components/EdgeFades'
import { EmbeddedCtx, ChromeInsetCtx, subBack, pendingProfile } from '../../lib/embedded'
import SwipeBack from '../../components/SwipeBack'
import PatientTopBar from '../../components/PatientTopBar'
import MedicalHubScreen from './medicalhub'
import AllergiesScreen from './allergies'
import KidsScreen from './kids'
import ActivityLogScreen from './activitylog'
import { logEvent } from '../../lib/activityLog'

const SCREEN_WIDTH = Dimensions.get('window').width
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true)

const DRAWER_WIDTH = 290

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

const MOCK_UNREAD_COUNT = 2

const DASHBOARD_CARDS: { key: string; label: string }[] = [
  { key: 'summary', label: 'Daily Summary' },
  { key: 'kids', label: 'Bridgette for Kids' },
  { key: 'careteam', label: 'Care Team' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'trends', label: 'Trends' },
  { key: 'foods', label: 'Foods' },
  { key: 'supplements', label: 'Supplements & Medicine' },
  { key: 'activity', label: 'Activity' },
  { key: 'sleep', label: 'Sleep' },
]
const DEFAULT_ORDER = DASHBOARD_CARDS.map((c) => c.key)

type SupplementDef = { id: string; name: string; reminder_time: string; kind: string; frequency: string; days_of_week: number[] | null; meal_relation: string }

function to12h(hhmm: string) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10))
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

// Frosted glass card: blur over the photo, plus a cream tint so text stays crisp.
function FrostedCard({ children, style, solid = true }: { children: React.ReactNode; style?: any; solid?: boolean }) {
  if (solid) {
    return (
      <View style={[styles.cardBlur, { backgroundColor: '#FFFFFF' }, style]}>
        <View style={{ padding: 16 }}>{children}</View>
      </View>
    )
  }
  return (
    <BlurView intensity={32} tint="light" style={[styles.cardBlur, style]}>
      <View style={styles.cardTint}>{children}</View>
    </BlurView>
  )
}

// iOS-style jiggle while in edit mode. Neighbouring cards rock opposite ways.
function fracOf(v: any) {
  if (typeof v === 'number') return v
  if (v === 'half') return 0.5
  if (v === 'third') return 1 / 3
  return 1
}
function caregiverTierLabel(t: string) {
  if (t === 'elevated') return 'Can help log'
  if (t === 'representative') return 'Full representative'
  return 'View only'
}
function fracLabel(f: number) {
  if (f >= 0.99) return 'Full'
  if (Math.abs(f - 0.5) < 0.05) return '1/2'
  if (Math.abs(f - 1 / 3) < 0.05) return '1/3'
  if (Math.abs(f - 2 / 3) < 0.05) return '2/3'
  return Math.round(f * 100) + '%'
}
function packGrid(orderArr: string[], frames: Record<string, any>, listW: number, gap: number) {
  const rows: { k: string; w: number; h: number }[][] = []
  let row: { k: string; w: number; h: number }[] = []
  let rowW = 0
  for (const k of orderArr) {
    const f = frames[k]
    if (!f) continue
    const w = f.w
    const prospective = row.length === 0 ? w : rowW + gap + w
    if (row.length > 0 && prospective > listW + 0.5) { rows.push(row); row = []; rowW = 0 }
    rowW = row.length === 0 ? w : rowW + gap + w
    row.push({ k, w, h: f.h })
  }
  if (row.length) rows.push(row)
  const pos: Record<string, { x: number; y: number }> = {}
  let y = 0
  for (const r of rows) {
    let total = 0
    for (let i = 0; i < r.length; i++) total += r[i].w + (i > 0 ? gap : 0)
    let x = Math.max(0, (listW - total) / 2)
    let rowH = 0
    for (const it of r) {
      pos[it.k] = { x, y }
      x += it.w + gap
      if (it.h > rowH) rowH = it.h
    }
    y += rowH
  }
  return pos
}
function packMasonry(orderArr: string[], sizes: Record<string, any>, heights: Record<string, number>, listW: number, gap: number, fallbackH: number) {
  const W = Math.max(1, Math.round(listW))
  const sky = new Array(W + 1).fill(0)
  const positions: Record<string, { x: number; y: number }> = {}
  let total = 0
  for (const k of orderArr) {
    let frac = fracOf(sizes[k])
    if (frac > 1) frac = 1
    if (frac < 0.25) frac = 0.25
    const wpx = frac >= 0.99 ? W : Math.floor(frac * listW) - gap
    const w = Math.max(1, Math.min(wpx, W))
    const h = (heights[k] != null && heights[k] > 0) ? heights[k] : fallbackH
    let bestX = 0
    let bestY = Infinity
    for (let x = 0; x + w <= W; x++) {
      let mh = 0
      for (let i = x; i < x + w; i++) { if (sky[i] > mh) mh = sky[i] }
      if (mh < bestY) { bestY = mh; bestX = x }
    }
    if (bestY === Infinity) { bestX = 0; bestY = 0 }
    positions[k] = { x: bestX, y: bestY }
    const top = bestY + h
    const right = Math.min(bestX + w + gap, W)
    for (let i = bestX; i < right; i++) sky[i] = top
    if (top > total) total = top
  }
  return { positions, total }
}
function CardTile({ keyName, frac, wpx, editMode, isDragging, onResize, listW, dragX, dragY, beginDrag, updatePreview, endDrag, finalizeDrag, tileRefs, offsetsRef, onMeasureHeight, wiggleDir, children }: any) {
  const startW = useSharedValue(frac)
  const lastW = useSharedValue(frac)
  const ox = useSharedValue(0)
  const oy = useSharedValue(0)
  const wig = useSharedValue(0)
  offsetsRef.current[keyName] = { ox, oy }
  useEffect(() => {
    if (editMode) {
      wig.value = withRepeat(withTiming(1, { duration: 280, easing: Easing.linear }), -1, false)
    } else {
      cancelAnimation(wig)
      wig.value = withTiming(0, { duration: 140 })
    }
  }, [editMode])
  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: ox.value },
      { translateY: oy.value },
      { rotateZ: `${Math.sin(wig.value * 2 * Math.PI) * 1.1 * wiggleDir}deg` },
    ],
  }))
  const resizePan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onStart(() => { startW.value = frac; lastW.value = frac })
    .onUpdate((e) => {
      const raw = startW.value + e.translationX / listW
      let w = Math.round(raw / 0.02) * 0.02
      w = Math.max(0.25, Math.min(1, w))
      if (w !== lastW.value) { lastW.value = w; runOnJS(onResize)(keyName, w) }
    })
  const movePan = Gesture.Pan()
    .activateAfterLongPress(160)
    .onStart(() => { dragX.value = 0; dragY.value = 0; runOnJS(beginDrag)(keyName) })
    .onUpdate((e) => { dragX.value = e.translationX; dragY.value = e.translationY; runOnJS(updatePreview)(e.absoluteX, e.absoluteY) })
    .onEnd((e) => { runOnJS(endDrag)(e.absoluteX, e.absoluteY) })
    .onFinalize(() => { runOnJS(finalizeDrag)() })
  return (
    <ReAnimated.View ref={(node: any) => { tileRefs.current[keyName] = node }} onLayout={(e: any) => onMeasureHeight(keyName, e.nativeEvent.layout.height)} style={[styles.cardAbs, { width: wpx, opacity: isDragging ? 0 : 1 }, animStyle]}>
      {editMode ? (
        <GestureDetector gesture={movePan}>
          <View>{children}</View>
        </GestureDetector>
      ) : (
        <View>{children}</View>
      )}
      {editMode && (
        <GestureDetector gesture={resizePan}>
          <View style={styles.resizeHandle}><View style={styles.resizeHandleIcon}><Icon name="forward" size={13} color="#5C7340" /></View></View>
        </GestureDetector>
      )}
    </ReAnimated.View>
  )
}

export default function PatientHome() {
  const signOut = useAuthStore((state) => state.signOut)
  const session = useAuthStore((state) => state.session)
  const profile = useAuthStore((state) => state.profile)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [histTab, setHistTab] = useState<'all' | 'surgery' | 'records'>('all')
  const [quickOpen, setQuickOpen] = useState(false)
  const [lifestyleStart, setLifestyleStart] = useState<LifestyleStart>(null)
  const [savedLabel, setSavedLabel] = useState<any>(null)
  const [activePage, setActivePageRaw] = useState<'dashboard' | 'records' | 'trends' | 'lifestyle' | 'share' | 'notifications' | 'supplements' | 'caregivers' | 'caregiving' | 'messages' | 'history' | 'profile' | 'settings' | 'community' | 'vaccines' | 'pets' | 'labelreader' | 'grocery' | 'allergies' | 'kids' | 'activitylog' | 'docnote'>('dashboard')
  // Back goes to the page you came from, not always the dashboard.
  const pageRef = useRef<typeof activePage>('dashboard')
  pageRef.current = activePage
  const navStack = useRef<(typeof activePage)[]>([])
  const skipSub = useRef(false)
  function setActivePage(next: typeof activePage) {
    const cur = pageRef.current
    if (next === cur) return
    if (next === 'dashboard') navStack.current = []
    else if (cur !== 'dashboard') navStack.current.push(cur)
    if (cur === 'share') skipSub.current = false
    pageRef.current = next
    setActivePageRaw(next)
  }
  function goBack() {
    const prev = navStack.current.pop() || 'dashboard'
    if (pageRef.current === 'share') skipSub.current = false
    pageRef.current = prev
    setActivePageRaw(prev)
  }
  function goBackTo(target: typeof activePage) {
    const i = navStack.current.lastIndexOf(target)
    if (i >= 0) navStack.current = navStack.current.slice(0, i)
    pageRef.current = target
    setActivePageRaw(target)
  }
  function backSub() {
    if (pageRef.current === 'share' && skipSub.current) { goBack(); return }
    if (!(subBack.current && subBack.current())) goBack()
  }
  const [pendingNotes, setPendingNotes] = useState<any[]>([])
  const [reviewNote, setReviewNote] = useState<{ note: any; from: string } | null>(null)
  const [threadOpen, setThreadOpen] = useState(false)
  const [period, setPeriod] = useState<Period>('daily')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTest, setSelectedTest] = useState('Glucose (Fasting)')
  const [testPickerOpen, setTestPickerOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(MOCK_UNREAD_COUNT)
  const [msgNotifOpen, setMsgNotifOpen] = useState(false)
  const [caregiverInvites, setCaregiverInvites] = useState<{ link_id: string; patient_email: string; tier: string; can_chat_providers: boolean }[]>([])
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER)
  const [editMode, setEditMode] = useState(false)
  const [cardSizes, setCardSizes] = useState<Record<string, any>>({})
  const [dragging, setDragging] = useState<{ key: string; width: number; baseX: number; baseY: number } | null>(null)
  const dragX = useSharedValue(0)
  const dragY = useSharedValue(0)
  const dragScale = useSharedValue(1)
  const cloneStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.value }, { translateY: dragY.value }, { scale: dragScale.value }] }))
  const tileRefs = useRef<Record<string, any>>({})
  const framesRef = useRef<Record<string, any>>({})
  const [heights, setHeights] = useState<Record<string, number>>({})
  const heightsRef = useRef<Record<string, number>>(heights)
  heightsRef.current = heights
  const [containerHeight, setContainerHeight] = useState<number>(0)
  const gridRef = useRef<any>(null)
  const layoutReadyRef = useRef<boolean>(false)
  const dragBaseRef = useRef<{ baseX: number; baseY: number }>({ baseX: 0, baseY: 0 })
  const draggingKeyRef = useRef<string | null>(null)
  const orderRef = useRef<string[]>(order)
  orderRef.current = order
  const offsetsRef = useRef<Record<string, any>>({})
  const committedRelRef = useRef<Record<string, { x: number; y: number }>>({})
  const previewRelRef = useRef<Record<string, { x: number; y: number }>>({})
  const previewOrderRef = useRef<string[]>([])
  const baseOrderRef = useRef<string[]>([])
  const gridOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const lastHoverRef = useRef<number>(-1)
  const committingRef = useRef<boolean>(false)
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current

  const [foodQuality, setFoodQuality] = useState({ healthy: 0, okay: 0, unhealthy: 0 })
  const [hasQualityData, setHasQualityData] = useState(false)
  const [supplements, setSupplements] = useState<SupplementDef[]>([])
  const [suppTaken, setSuppTaken] = useState<Record<string, string>>({}) // supplement_id -> checkin id
  // Children's medicines and supplements for today, ticked off here and on the Kids page.
  const [kidsTitle, setKidsTitle] = useState('Bridgette for Kids')
  const [kidList, setKidList] = useState<{ id: string; name: string; birth_date?: string; photo_path?: string | null }[]>([])
  const [kidPhotos, setKidPhotos] = useState<Record<string, string>>({})
  const [kidMeds, setKidMeds] = useState<KidMed[]>([])
  const [kidLogs, setKidLogs] = useState<KidLog[]>([])
  const [activityData, setActivityData] = useState<{ label: string; value: number }[]>([])
  const [sleepData, setSleepData] = useState<{ label: string, value: number }[]>([])
  const [trendData, setTrendData] = useState<{ label: string, value: number }[]>([])
  const [summary, setSummary] = useState('')
  const [openGroups, setOpenGroups] = useState<string[]>([])
  const [, setNoteTick] = useState(0)
  useEffect(() => {
    const uid = session?.user.id
    if (!uid) return
    syncSharedNotes(uid).then(() => setNoteTick((n) => n + 1))
    supabase.from('share_notes').select('*').eq('patient_id', uid).eq('status', 'pending').order('created_at', { ascending: false }).then(({ data }) => {
      setPendingNotes(data || [])
      if (data && data.length && activePage !== 'notifications') setUnreadCount((u) => Math.max(u, data.length))
    })
  }, [session?.user.id, activePage])
  useEffect(() => {
    const uid = session?.user.id
    if (!uid) return
    registerPushToken(uid)
    let sub: any
    try {
      sub = ExpoNotifications.addNotificationResponseReceivedListener(async (resp: any) => {
        const d = resp?.notification?.request?.content?.data
        if (d?.type !== 'share_note' || !d?.note_id) return
        const { data } = await supabase.from('share_notes').select('*').eq('id', d.note_id).eq('status', 'pending').maybeSingle()
        if (data) { setReviewNote({ note: data, from: 'dashboard' }); setActivePage('docnote') }
      })
    } catch {}
    return () => { try { sub && sub.remove() } catch {} }
  }, [session?.user.id])
  const recentNote = getRecentNote()
  const followUps = getFollowUps()

  useEffect(() => {
    if (session?.user.id) fetchDashboardData()
  }, [selectedDate, period, selectedTest])

  useEffect(() => {
    if (session?.user.id) loadOrder()
    if (session?.user.id) loadCaregiverInvites()
  }, [])

  async function loadCaregiverInvites() {
    const { data, error } = await supabase.rpc('get_my_caregiver_invites')
    if (!error && data) setCaregiverInvites(data as any)
  }

  async function acceptInvite(linkId: string) {
    const { error } = await supabase.rpc('accept_caregiver_invite', { p_link_id: linkId })
    if (error) { Alert.alert('Could not accept', 'Please try again.'); return }
    setCaregiverInvites((cur) => cur.filter((i) => i.link_id !== linkId))
  }

  async function declineInvite(linkId: string) {
    const { error } = await supabase.rpc('decline_caregiver_invite', { p_link_id: linkId })
    if (error) { Alert.alert('Could not decline', 'Please try again.'); return }
    setCaregiverInvites((cur) => cur.filter((i) => i.link_id !== linkId))
  }

  async function loadOrder() {
    const userId = session?.user.id
    if (!userId) return
    const { data } = await supabase.from('profiles').select('dashboard_order, card_sizes').eq('id', userId).single()
    const saved: string[] = (data?.dashboard_order || []).filter((k: string) => DEFAULT_ORDER.includes(k))
    if (saved.length) {
      const missing = DEFAULT_ORDER.filter((k) => !saved.includes(k))
      let merged = [...saved, ...missing]
      if (missing.includes('kids')) {
        merged = merged.filter((k) => k !== 'kids')
        const at = merged.indexOf('summary')
        merged.splice(at >= 0 ? at + 1 : 0, 0, 'kids')
      }
      // Newly added Care Team card: show it near the top instead of the very bottom
      if (missing.includes('careteam')) {
        const without = merged.filter((k) => k !== 'careteam' && k !== 'appointments')
        const at = without.indexOf('summary')
        without.splice(at >= 0 ? at + 1 : 0, 0, 'careteam', 'appointments')
        setOrder(without)
      } else if (missing.includes('appointments')) {
        const without = merged.filter((k) => k !== 'appointments')
        const at = without.indexOf('careteam')
        without.splice(at >= 0 ? at + 1 : 0, 0, 'appointments')
        setOrder(without)
      } else {
        setOrder(merged)
      }
    }
    if (data?.card_sizes) setCardSizes(data.card_sizes)
  }

  async function saveOrder(next: string[]) {
    setOrder(next)
    const userId = session?.user.id
    if (!userId) return
    await supabase.from('profiles').update({ dashboard_order: next }).eq('id', userId)
  }


  async function fetchDashboardData() {
    const userId = session?.user.id!
    await Promise.all([
      fetchFoodQuality(userId),
      fetchSleep(userId),
      fetchTrends(userId),
      fetchSupplements(userId),
      fetchKidMeds(userId),
      fetchActivity(userId),
      buildDailySummary(userId),
    ])
  }

  async function onRefresh() {
    setRefreshing(true)
    await fetchDashboardData()
    setRefreshing(false)
  }

  function rangeFor(q: any) {
    if (period === 'daily') return q.eq('log_date', selectedDate)
    if (period === 'weekly') return q.gte('log_date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
    return q.gte('log_date', new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0])
  }

  async function fetchFoodQuality(userId: string) {
    let query = supabase.from('food_logs').select('quality').eq('patient_id', userId)
    query = rangeFor(query)
    const { data, error } = await query
    if (error || !data || data.length === 0) { setHasQualityData(false); return }
    const counts = { healthy: 0, okay: 0, unhealthy: 0 }
    data.forEach((row: any) => {
      if (row.quality === 'healthy') counts.healthy++
      else if (row.quality === 'okay') counts.okay++
      else if (row.quality === 'unhealthy') counts.unhealthy++
    })
    const total = counts.healthy + counts.okay + counts.unhealthy
    setHasQualityData(total > 0)
    setFoodQuality(counts)
  }

  async function fetchSleep(userId: string) {
    let query = supabase.from('sleep_logs').select('hours_slept, log_date').eq('patient_id', userId).order('log_date', { ascending: true })
    query = rangeFor(query)
    const { data } = await query
    if (data && data.length > 0) {
      setSleepData(data.map((row: any) => ({
        label: new Date(row.log_date).toLocaleDateString('en-US', { weekday: 'short' }),
        value: row.hours_slept,
      })))
    } else {
      setSleepData([])
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
      setTrendData(data.map((row: any) => ({
        label: new Date(row.record_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        value: row.value,
      })))
    } else {
      setTrendData([])
    }
  }

  // Supplements on the dashboard mirror the Supplements screen:
  // a set list (definitions) plus today's check-offs (supplement_checkins).
  async function fetchSupplements(userId: string) {
    const today = new Date().toISOString().split('T')[0]
    const dow = new Date().getDay()
    const [defRes, checkRes] = await Promise.all([
      supabase
        .from('supplements')
        .select('id, name, reminder_time, kind, frequency, days_of_week, meal_relation')
        .eq('patient_id', userId)
        .eq('active', true)
        .order('reminder_time', { ascending: true }),
      supabase
        .from('supplement_checkins')
        .select('id, supplement_id')
        .eq('patient_id', userId)
        .eq('log_date', today),
    ])
    const all = (defRes.data || []) as SupplementDef[]
    // Only show items actually scheduled for today
    const todays = all.filter(s => s.frequency === 'daily' || (s.days_of_week || []).includes(dow))
    setSupplements(todays)
    const map: Record<string, string> = {}
    if (checkRes.data) checkRes.data.forEach((c: any) => { map[c.supplement_id] = c.id })
    setSuppTaken(map)
  }

  function localToday() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  async function fetchKidMeds(userId: string) {
    const k = await supabase.from('kids').select('id, name, birth_date, photo_path').eq('parent_id', userId).order('created_at', { ascending: true })
    if (k.error || !k.data || k.data.length === 0) { setKidList([]); setKidMeds([]); setKidLogs([]); return }
    const [m, l] = await Promise.all([
      supabase.from('kid_meds').select('*').eq('parent_id', userId).eq('active', true),
      supabase.from('kid_med_logs').select('*').eq('parent_id', userId).eq('log_date', localToday()),
    ])
    setKidList(k.data as any)
    ;(async () => {
      const next: Record<string, string> = {}
      for (const x of (k.data as any[])) { if (x.photo_path) { const u = await signedUrl(x.photo_path); if (u) next[x.id] = u } }
      setKidPhotos(next)
    })()
    setKidMeds(m.error ? [] : ((m.data as KidMed[]) || []))
    setKidLogs(l.error ? [] : ((l.data as KidLog[]) || []))
  }
  async function toggleKidSlot(m: KidMed, key: string) {
    const userId = session?.user.id
    if (!userId) return
    const today = localToday()
    const existing = kidLogs.find((x) => x.med_id === m.id && x.log_date === today && x.slot === key)
    if (existing) {
      setKidLogs((all) => all.filter((x) => x.id !== existing.id))
      await supabase.from('kid_med_logs').delete().eq('id', existing.id)
      logEvent(userId, { kid_id: m.kid_id, kid_name: kidList.find((k) => k.id === m.kid_id)?.name || null, category: 'dose', action: 'unmarked', title: `${m.name} unmarked` })
    } else {
      const { data, error } = await supabase.from('kid_med_logs').insert({ kid_id: m.kid_id, med_id: m.id, parent_id: userId, med_name: m.name, kind: m.kind, slot: key, log_date: today }).select().single()
      if (!error && data) { setKidLogs((all) => [data as KidLog, ...all]); logEvent(userId, { kid_id: m.kid_id, kid_name: kidList.find((k) => k.id === m.kid_id)?.name || null, category: 'dose', action: 'given', title: `${m.name} given` }) }
    }
  }

  async function fetchActivity(userId: string) {
    let query = supabase.from('activity_logs').select('log_date').eq('patient_id', userId)
    query = rangeFor(query)
    const { data, error } = await query
    if (error || !data) { setActivityData([]); return }
    // Count activities per weekday as an honest proxy until a metric column is chosen
    const byDay: Record<string, number> = {}
    data.forEach((row: any) => {
      const label = new Date(row.log_date).toLocaleDateString('en-US', { weekday: 'short' })
      byDay[label] = (byDay[label] || 0) + 1
    })
    const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    setActivityData(order.filter(d => byDay[d]).map(d => ({ label: d, value: byDay[d] })))
  }

  // Builds the Daily Summary from the day's own logs, on-device. Nothing
  // identifying leaves the phone, so it stays DPA-clean. It organizes and
  // surfaces what was logged; it does not interpret, diagnose, or advise.
  async function buildDailySummary(userId: string) {
    const day = selectedDate
    const today = new Date().toISOString().split('T')[0]
    try {
      const [foodRes, sleepRes, actRes, labRes] = await Promise.all([
        supabase.from('food_logs').select('quality').eq('patient_id', userId).eq('log_date', day),
        supabase.from('sleep_logs').select('hours_slept').eq('patient_id', userId).eq('log_date', day),
        supabase.from('activity_logs').select('log_date').eq('patient_id', userId).eq('log_date', day),
        supabase.from('lab_values').select('test_name, value, unit, record_date').eq('patient_id', userId).eq('is_flagged', true).order('record_date', { ascending: false }).limit(6),
      ])

      const foods = (foodRes.data || []) as { quality: string }[]
      const counts = { healthy: 0, okay: 0, unhealthy: 0 }
      foods.forEach((f) => {
        if (f.quality === 'healthy') counts.healthy++
        else if (f.quality === 'okay') counts.okay++
        else if (f.quality === 'unhealthy') counts.unhealthy++
      })
      const mealTotal = counts.healthy + counts.okay + counts.unhealthy

      const sleepRows = (sleepRes.data || []) as { hours_slept: number }[]
      const sleepHours = sleepRows.reduce((s, r) => s + (r.hours_slept || 0), 0)

      const activityCount = (actRes.data || []).length

      const labRows = (labRes.data || []) as { test_name: string; value: number; unit: string | null }[]
      const seen = new Set<string>()
      const flagged: { test: string; value: number; unit: string | null }[] = []
      labRows.forEach((r) => {
        if (!seen.has(r.test_name)) { seen.add(r.test_name); flagged.push({ test: r.test_name, value: r.value, unit: r.unit }) }
      })

      const parts: string[] = []
      if (mealTotal > 0) {
        const bits: string[] = []
        if (counts.healthy) bits.push(`${counts.healthy} healthy`)
        if (counts.okay) bits.push(`${counts.okay} okay`)
        if (counts.unhealthy) bits.push(`${counts.unhealthy} less healthy`)
        parts.push(`You logged ${mealTotal} ${mealTotal === 1 ? 'meal' : 'meals'} (${bits.join(', ')}).`)
      }
      if (sleepHours > 0) parts.push(`You slept ${Number.isInteger(sleepHours) ? sleepHours : sleepHours.toFixed(1)} hours.`)
      if (activityCount > 0) parts.push(`You logged ${activityCount} ${activityCount === 1 ? 'workout' : 'workouts'}.`)
      if (flagged.length > 0) {
        const labStr = flagged.slice(0, 3).map((l) => `${l.test} ${l.value}${l.unit ? ' ' + l.unit : ''}`).join(', ')
        parts.push(`Recent labs outside the usual range: ${labStr}.`)
      }

      const dayLabel = day === today ? 'today' : formatDate(day)
      setSummary(parts.length ? parts.join(' ') : `Nothing logged for ${dayLabel} yet. Add a meal, a sleep entry, or a workout and it will come together here.`)
    } catch {
      setSummary('Could not put together your summary right now. Pull down to refresh and try again.')
    }
  }

  async function toggleSupplement(id: string) {
    const userId = session?.user.id
    if (!userId) return
    const existing = suppTaken[id]
    const today = new Date().toISOString().split('T')[0]
    if (existing) {
      setSuppTaken((m) => { const n = { ...m }; delete n[id]; return n })
      await supabase.from('supplement_checkins').delete().eq('id', existing)
    } else {
      const { data, error } = await supabase
        .from('supplement_checkins')
        .insert({ supplement_id: id, patient_id: userId, log_date: today })
        .select()
        .single()
      if (!error && data) setSuppTaken((m) => ({ ...m, [id]: data.id }))
    }
  }

  // Coming back to the dashboard from the Kids page picks up any doses that were ticked off there.
  useEffect(() => { if (activePage === 'dashboard' && session?.user.id) fetchKidMeds(session.user.id) }, [activePage])

  function openDrawer() {
    setDrawerOpen(true)
    Animated.timing(drawerAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start()
  }

  function closeDrawer() {
    Animated.timing(drawerAnim, { toValue: -DRAWER_WIDTH, duration: 200, useNativeDriver: true }).start(() => setDrawerOpen(false))
  }


  // Swipe in from the left edge to pull the menu open, swipe left on it to close.
  const edgePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_e, g) => g.x0 < 40 && g.dx > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderGrant: () => { drawerAnim.stopAnimation(); setDrawerOpen(true) },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => { drawerAnim.setValue(Math.min(0, -DRAWER_WIDTH + g.dx)) },
      onPanResponderRelease: (_e, g) => {
        if (g.dx > DRAWER_WIDTH * 0.35 || g.vx > 0.5) {
          Animated.timing(drawerAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start()
        } else {
          Animated.timing(drawerAnim, { toValue: -DRAWER_WIDTH, duration: 160, useNativeDriver: true }).start(() => setDrawerOpen(false))
        }
      },
      onPanResponderTerminate: () => { Animated.timing(drawerAnim, { toValue: -DRAWER_WIDTH, duration: 160, useNativeDriver: true }).start(() => setDrawerOpen(false)) },
    })
  ).current

  const drawerPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_e, g) => g.dx < -8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderGrant: () => { drawerAnim.stopAnimation() },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => { drawerAnim.setValue(Math.max(-DRAWER_WIDTH, Math.min(0, g.dx))) },
      onPanResponderRelease: (_e, g) => {
        if (g.dx < -DRAWER_WIDTH * 0.3 || g.vx < -0.5) {
          Animated.timing(drawerAnim, { toValue: -DRAWER_WIDTH, duration: 160, useNativeDriver: true }).start(() => setDrawerOpen(false))
        } else {
          Animated.timing(drawerAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start()
        }
      },
    })
  ).current

  function navigate(page: typeof activePage) {
    closeDrawer()
    setTimeout(() => setActivePage(page), 200)
  }

  function goToTab(page: typeof activePage) {
    if (drawerOpen) closeDrawer()
    setThreadOpen(false)
    if (page === 'labelreader') setSavedLabel(null)
    navStack.current = []
    setActivePage(page)
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

  function renderQualityRing(ringSize: number) {
    const size = ringSize
    const cx = size / 2
    const cy = size / 2
    const total = foodQuality.healthy + foodQuality.okay + foodQuality.unhealthy
    const rings = [
      { key: 'Healthy', val: foodQuality.healthy, color: '#5C7340', r: 46 },
      { key: 'Okay', val: foodQuality.okay, color: '#C4922A', r: 36 },
      { key: 'Unhealthy', val: foodQuality.unhealthy, color: '#B5451B', r: 26 },
    ]
    const healthyPct = total > 0 ? Math.round((foodQuality.healthy / total) * 100) : 0
    return (
      <View style={[styles.ringContainer, { flexWrap: 'wrap' }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {rings.map((ring, i) => {
            const circ = 2 * Math.PI * ring.r
            const frac = total > 0 ? ring.val / total : 0
            const dash = frac * circ
            return (
              <Circle key={i}
                cx={cx} cy={cy} r={ring.r} fill="none"
                stroke={total > 0 ? ring.color : '#E5DFD3'}
                strokeWidth={7}
                strokeDasharray={`${dash} ${circ - dash}`}
                transform={`rotate(-90 ${cx} ${cy})`}
                strokeLinecap="round"
                opacity={total > 0 ? 1 : 0.5}
              />
            )
          })}
          <SvgText x={cx} y={cy - 2} textAnchor="middle" fontSize="11" fill="#3D3229" fontWeight="bold">Today</SvgText>
          <SvgText x={cx} y={cy + 11} textAnchor="middle" fontSize="8" fill="#4F5048">Food Quality</SvgText>
        </Svg>
        <View style={styles.ringLegend}>
          {rings.map((ring, i) => (
            <View key={i} style={styles.ringLegendItem}>
              <View style={[styles.ringDot, { backgroundColor: ring.color }]} />
              <Text style={styles.ringLegendText}>{ring.key}</Text>
            </View>
          ))}
          {total > 0 && <Text style={styles.ringPct}>{healthyPct}% healthy</Text>}
        </View>
      </View>
    )
  }

  function renderLineChart(data: { label: string, value: number }[], color: string, chartW: number) {
    if (data.length < 2) return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyChartText}>No data yet for this selection</Text>
      </View>
    )
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
            <Stop offset="0" stopColor={color} stopOpacity="0.18" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill={`url(#g${color.replace('#', '')})`} />
        <Path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <View key={i}>
            <Circle cx={toX(i)} cy={toY(d.value)} r={4} fill="#fff" stroke={color} strokeWidth="2" />
            <SvgText x={toX(i)} y={toY(d.value) - 8} textAnchor="middle" fontSize="9" fontWeight="bold" fill={color}>{d.value}</SvgText>
            <SvgText x={toX(i)} y={chartH - 4} textAnchor="middle" fontSize="8" fill="#4F5048">{d.label}</SvgText>
          </View>
        ))}
      </Svg>
    )
  }

  function renderActivityBars() {
    if (activityData.length === 0) {
      return <Text style={styles.noDataNote}>No activity logged yet</Text>
    }
    const max = Math.max(...activityData.map(d => d.value), 1)
    return (
      <View style={styles.barRow}>
        {activityData.map((d, i) => (
          <View key={i} style={styles.barItem}>
            <View style={[styles.bar, { height: 8 + (d.value / max) * 42, backgroundColor: '#5C7340' }]} />
            <Text style={styles.barLabel}>{d.label}</Text>
          </View>
        ))}
      </View>
    )
  }

  const GAP = 12
  const LIST_W = SCREEN_WIDTH - 32
  function estWidth(f: number) { return Math.max(120, Math.round(LIST_W * f)) }
  function clampW(w: number) { return Math.min(1, Math.max(0.25, w)) }
  async function saveSizes(next: Record<string, any>) {
    setCardSizes(next)
    const userId = session?.user.id
    if (!userId) return
    await supabase.from('profiles').update({ card_sizes: next }).eq('id', userId)
  }
  function onResize(key: string, frac: number) {
    saveSizes({ ...cardSizes, [key]: frac })
  }
  function wpxOf(fr: number) { return fr >= 0.99 ? LIST_W : Math.floor(fr * LIST_W) - 6 }
  function onMeasureHeight(key: string, h: number) {
    if (!h) return
    const prev = heightsRef.current[key]
    if (prev != null && Math.abs(prev - h) < 1) return
    setHeights((cur) => ({ ...cur, [key]: h }))
  }
  function applyLayout(positions: Record<string, { x: number; y: number }>, animated: boolean) {
    Object.keys(positions).forEach((k) => {
      const off = offsetsRef.current[k]
      if (!off) return
      if (animated) {
        off.ox.value = withTiming(positions[k].x, { duration: 240 })
        off.oy.value = withTiming(positions[k].y, { duration: 240 })
      } else {
        off.ox.value = positions[k].x
        off.oy.value = positions[k].y
      }
    })
  }
  useLayoutEffect(() => {
    if (activePage !== 'dashboard') { layoutReadyRef.current = false; return }
    if (draggingKeyRef.current) return
    const { positions, total } = packMasonry(order, cardSizes, heightsRef.current, LIST_W, 6, 200)
    committedRelRef.current = positions
    setContainerHeight(total)
    applyLayout(positions, layoutReadyRef.current)
    layoutReadyRef.current = true
  }, [activePage, order, cardSizes, heights])
  function beginDrag(key: string) {
    baseOrderRef.current = [...orderRef.current]
    lastHoverRef.current = -1
    committingRef.current = false
    previewOrderRef.current = []
    draggingKeyRef.current = key
    dragScale.value = withTiming(1.03, { duration: 130 })
    const committed = packMasonry(baseOrderRef.current, cardSizes, heightsRef.current, LIST_W, 6, 200).positions
    committedRelRef.current = committed
    const pos = committed[key] || { x: 0, y: 0 }
    const w = wpxOf(clampW(fracOf(cardSizes[key])))
    const place = (ox: number, oy: number) => {
      gridOriginRef.current = { x: ox, y: oy }
      dragBaseRef.current = { baseX: ox + pos.x, baseY: oy + pos.y }
      setDragging({ key, width: w, baseX: ox + pos.x, baseY: oy + pos.y })
    }
    const g = gridRef.current
    if (g && g.measure) {
      g.measure((x: number, y: number, mw: number, mh: number, pageX: number, pageY: number) => { place(pageX, pageY) })
    } else {
      place(gridOriginRef.current.x, gridOriginRef.current.y)
    }
  }
  function updatePreview(absX: number, absY: number) {
    const moved = draggingKeyRef.current
    if (!moved) return
    const base = baseOrderRef.current
    if (!base.length) return
    const origin = gridOriginRef.current
    const fx = absX - origin.x
    const fy = absY - origin.y
    const committed = committedRelRef.current
    const hts = heightsRef.current
    const without = base.filter((k) => k !== moved)
    let target: string | null = null
    for (const k of without) {
      const p = committed[k]
      if (!p) continue
      const w = wpxOf(clampW(fracOf(cardSizes[k])))
      const h = hts[k] || 200
      if (fx >= p.x && fx <= p.x + w && fy >= p.y && fy <= p.y + h) { target = k; break }
    }
    if (!target) {
      let best = Infinity
      for (const k of without) {
        const p = committed[k]
        if (!p) continue
        const w = wpxOf(clampW(fracOf(cardSizes[k])))
        const h = hts[k] || 200
        const cx = p.x + w / 2, cy = p.y + h / 2
        const d = (cx - fx) * (cx - fx) + (cy - fy) * (cy - fy)
        if (d < best) { best = d; target = k }
      }
    }
    if (!target) return
    const tp = committed[target]
    const tw = wpxOf(clampW(fracOf(cardSizes[target])))
    const th = hts[target] || 200
    const below = fy > tp.y + th / 2
    const rightish = fx > tp.x + tw / 2
    const after = below || (Math.abs(fy - (tp.y + th / 2)) <= th / 2 && rightish)
    let insertIdx = without.indexOf(target)
    if (after) insertIdx += 1
    if (insertIdx === lastHoverRef.current) return
    lastHoverRef.current = insertIdx
    const preview = [...without]
    preview.splice(insertIdx, 0, moved)
    previewOrderRef.current = preview
    const prel = packMasonry(preview, cardSizes, hts, LIST_W, 6, 200).positions
    previewRelRef.current = prel
    for (const k of base) {
      if (k === moved) continue
      const off = offsetsRef.current[k]
      if (!off || !prel[k]) continue
      off.ox.value = withTiming(prel[k].x, { duration: 200 })
      off.oy.value = withTiming(prel[k].y, { duration: 200 })
    }
  }
  function commitDrop(nextOrder: string[]) {
    const prel = previewRelRef.current
    const moved = draggingKeyRef.current
    if (moved && prel[moved] && offsetsRef.current[moved]) {
      offsetsRef.current[moved].ox.value = prel[moved].x
      offsetsRef.current[moved].oy.value = prel[moved].y
    }
    draggingKeyRef.current = null
    lastHoverRef.current = -1
    committingRef.current = false
    previewOrderRef.current = []
    setDragging(null)
    dragX.value = 0
    dragY.value = 0
    dragScale.value = 1
    saveOrder(nextOrder)
  }
  function endDrag(absX: number, absY: number) {
    const moved = draggingKeyRef.current
    const preview = previewOrderRef.current
    const prel = previewRelRef.current
    if (!moved || !preview.length || !prel[moved]) { finalizeDrag(); return }
    committingRef.current = true
    const origin = gridOriginRef.current
    const targetPageX = origin.x + prel[moved].x
    const targetPageY = origin.y + prel[moved].y
    const baseX = dragBaseRef.current.baseX
    const baseY = dragBaseRef.current.baseY
    dragScale.value = withTiming(1, { duration: 180 })
    dragX.value = withTiming(targetPageX - baseX, { duration: 180 })
    dragY.value = withTiming(targetPageY - baseY, { duration: 180 }, (finished) => {
      if (finished) runOnJS(commitDrop)(preview)
    })
  }
  function finalizeDrag() {
    if (committingRef.current) return
    const committed = committedRelRef.current
    Object.keys(offsetsRef.current).forEach((k) => {
      const off = offsetsRef.current[k]
      const p = committed[k]
      if (off && p) { off.ox.value = withTiming(p.x, { duration: 200 }); off.oy.value = withTiming(p.y, { duration: 200 }) }
    })
    draggingKeyRef.current = null
    lastHoverRef.current = -1
    previewOrderRef.current = []
    setDragging(null)
    dragX.value = 0
    dragY.value = 0
    dragScale.value = withTiming(1, { duration: 160 })
  }

  function dueSlotsFor(kidId: string) {
    const names: string[] = []
    for (const m of kidMeds.filter((x) => x.kid_id === kidId)) { if (dueSlots(m, kidLogs).length > 0) names.push(m.name) }
    return names
  }

  function renderCard(key: string, cw: number) {
    switch (key) {
      case 'summary':
        return (
<ReAnimated.View key="summary" entering={FadeInDown.delay(0)}>
          <FrostedCard>
            <View style={styles.summaryHead}>
              <Text style={styles.cardTitle}>Daily Summary</Text>
              <View style={styles.aiChip}><Text style={styles.aiChipText}>AI</Text></View>
            </View>
            <Text style={styles.summaryText}>{summary || 'Putting together your day...'}</Text>
          </FrostedCard>
        </ReAnimated.View>
        )
      case 'careteam': {
        const n = recentNote
        const docName = n?.doctorName || ''
        const initials = docName.replace(/^(dr\.?|doc)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join('') || 'D'
        const snippet = (n?.snippet || '').toString().trim()
        const when = n?.date || ''
        return (
<ReAnimated.View key="careteam" entering={FadeInDown.delay(40)}>
          <FrostedCard solid>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Care Team</Text>
              <TouchableOpacity onPress={() => setActivePage('share')} style={styles.addRow}>
                <Text style={styles.cardLinkText}>Open</Text>
                <Icon name="forward" size={15} color="#2F4A1E" />
              </TouchableOpacity>
            </View>
            {n ? (
              <TouchableOpacity activeOpacity={0.85} onPress={() => setActivePage('share')} style={styles.noteBox}>
                <View style={styles.noteTop}>
                  <View style={styles.noteAvatar}>
                    {n.photo ? <Image source={n.photo} style={styles.notePhoto} resizeMode="cover" /> : <Text style={styles.noteAvatarText}>{initials}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.noteLabel}>Recent note</Text>
                    <Text style={styles.noteDoctor} numberOfLines={1}>{docName}</Text>
                    <Text style={styles.noteMeta} numberOfLines={1}>{[n.role, when].filter(Boolean).join('  |  ')}</Text>
                  </View>
                </View>
                {!!snippet && <Text style={styles.noteSnippet} numberOfLines={3}>{snippet}</Text>}
              </TouchableOpacity>
            ) : (
              <View style={styles.noteBox}>
                <Text style={styles.noteLabel}>Recent note</Text>
                <Text style={styles.noteSnippet}>No notes from your doctors yet. When a doctor writes one, it shows up here.</Text>
              </View>
            )}
            <View style={styles.careActions}>
              <TouchableOpacity style={styles.careBtn} onPress={() => setActivePage('share')}>
                <Text style={styles.careBtnText}>Open Care Team</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.careBtnGhost} onPress={() => setActivePage('share')}>
                <Icon name="share" size={14} color="#2F4A1E" />
                <Text style={styles.careBtnGhostText}>Share link</Text>
              </TouchableOpacity>
            </View>
          </FrostedCard>
        </ReAnimated.View>
        )
      }
      case 'appointments': {
        const next = followUps.slice(0, 3)
        return (
<ReAnimated.View key="appointments" entering={FadeInDown.delay(60)}>
          <FrostedCard>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Appointments</Text>
              <TouchableOpacity onPress={() => setActivePage('share')} style={styles.addRow}>
                <Text style={styles.cardLinkText}>See all</Text>
                <Icon name="forward" size={15} color="#2F4A1E" />
              </TouchableOpacity>
            </View>
            <Text style={styles.apptSub}>Follow ups your care team asked you to keep.</Text>
            {next.length === 0 ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteSnippet}>No follow ups yet. When a doctor sets one, it shows up here.</Text>
              </View>
            ) : next.map((f) => (
              <TouchableOpacity key={f.doctorName} activeOpacity={0.85} onPress={() => setActivePage('share')} style={[styles.apptRow, f.overdue && styles.apptRowOverdue]} accessibilityRole="button" accessibilityLabel={`${f.when}, set by ${f.doctorName}`}>
                <View style={[styles.apptDate, f.overdue && styles.apptDateOverdue]}>
                  <Text style={[styles.apptMonth, f.overdue && { color: '#A4500F' }]}>{f.month}</Text>
                  <Text style={[styles.apptDay, f.overdue && { color: '#A4500F' }]}>{f.day}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.noteDoctor} numberOfLines={1}>{f.doctorName}</Text>
                  <Text style={styles.noteMeta} numberOfLines={1}>{f.role}</Text>
                  <Text style={[styles.apptWhen, f.overdue && { color: '#A4500F' }]} numberOfLines={1}>{f.overdue ? `${f.when}. Message to reschedule` : f.when}</Text>
                </View>
                <Icon name="forward" size={16} color="#5B6650" />
              </TouchableOpacity>
            ))}
          </FrostedCard>
        </ReAnimated.View>
        )
      }
      case 'kids': {
        const turns = (bd: Date | null) => {
          if (!bd) return null
          const n = Math.round((new Date(bd.getFullYear() + 18, bd.getMonth(), bd.getDate()).getTime() - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime()) / 86400000)
          return n <= 60 ? (n <= 0 ? 'Turned 18' : n === 1 ? 'Turns 18 tomorrow' : `Turns 18 in ${n} days`) : null
        }
        return (
<ReAnimated.View key="kids" entering={FadeInDown.delay(40)}>
          <FrostedCard>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Bridgette for Kids</Text>
              <TouchableOpacity onPress={() => setActivePage('kids')} style={styles.addRow}>
                <Text style={styles.cardLinkText}>{kidList.length ? 'Open' : '+ Add a child'}</Text>
              </TouchableOpacity>
            </View>
            {kidList.length === 0 ? (
              <TouchableOpacity onPress={() => setActivePage('kids')} accessibilityRole="button">
                <Text style={styles.cardSub}>Keep your child's vaccines, medicines and doctor visits in one place.</Text>
              </TouchableOpacity>
            ) : kidList.slice(0, 3).map((k) => {
              const bd = parseKidISO(k.birth_date || null)
              const due = dueSlotsFor(k.id)
              const t18 = turns(bd)
              return (
                <TouchableOpacity key={k.id} style={styles.kidRow} onPress={() => setActivePage('kids')} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`Open ${k.name}`}>
                  <View style={styles.kidAvatar}>
                    {kidPhotos[k.id] ? <Image source={{ uri: kidPhotos[k.id] }} style={{ width: 40, height: 40 }} resizeMode="cover" /> : <Text style={styles.kidAvatarTxt}>{(k.name || '?').trim().charAt(0).toUpperCase()}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.kidRowName}>{k.name}</Text>
                    <Text style={styles.kidRowSub}>{bd ? ageText(daysOld(bd)) : ''}</Text>
                    {due.length > 0 && <Text style={styles.kidRowDue}>Due now: {due.join(', ')}</Text>}
                    {t18 && <Text style={styles.kidRowTurn}>{t18}</Text>}
                  </View>
                  <Icon name="forward" size={16} color="#4F5048" />
                </TouchableOpacity>
              )
            })}
            {kidList.length > 3 && <Text style={styles.cardSub}>+ {kidList.length - 3} more</Text>}
          </FrostedCard>
        </ReAnimated.View>
        )
      }
      case 'trends':
        return (
<ReAnimated.View key="trends" entering={FadeInDown.delay(80)}>
          <FrostedCard>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Trends</Text>
              <TouchableOpacity onPress={() => setTestPickerOpen(!testPickerOpen)} style={styles.testSelector}>
                <Text style={styles.testSelectorText} numberOfLines={1}>
                  {selectedTest.replace(' Cholesterol', '').replace(' (Fasting)', '')}
                </Text>
                <Icon name={testPickerOpen ? 'up' : 'down'} size={12} color="#4F5048" />
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
            <View style={{ marginTop: 8 }}>{renderLineChart(trendData, '#5C7340', cw - 56)}</View>
            <TouchableOpacity onPress={() => setActivePage('trends')} style={styles.cardLink}>
              <Text style={styles.cardLinkText}>View full trends →</Text>
            </TouchableOpacity>
          </FrostedCard>
        </ReAnimated.View>
        )
      case 'foods':
        return (
<ReAnimated.View key="foods" entering={FadeInDown.delay(160)}>
          <FrostedCard>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Foods</Text>
              <TouchableOpacity onPress={() => { setLifestyleStart(null); setActivePage('lifestyle') }}>
                <Text style={styles.cardLinkText}>+ Add Meal Log</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.cardSub}>
              {period === 'daily' ? formatDate(selectedDate) : period === 'weekly' ? 'This week' : 'This year'} · Quality breakdown
            </Text>
            {!hasQualityData && <Text style={styles.noDataNote}>No meal quality data yet for this period</Text>}
            {renderQualityRing(cw >= 280 ? 120 : cw >= 180 ? 100 : 84)}
          </FrostedCard>
        </ReAnimated.View>
        )
      case 'supplements':
        return (
<ReAnimated.View key="supplements" entering={FadeInDown.delay(240)}>
          <FrostedCard>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Supplements & Medicine</Text>
              <TouchableOpacity onPress={() => setActivePage('supplements')} style={styles.addRow}>
                <Icon name="forward" size={15} color="#5C7340" />
                <Text style={styles.cardLinkText}>Manage</Text>
              </TouchableOpacity>
            </View>
            {supplements.length === 0 && !kidMeds.some((m) => scheduledToday(m) && slotsFor(m).length > 0) ? (
              <TouchableOpacity onPress={() => setActivePage('supplements')}>
                <Text style={styles.noDataNote}>No supplements yet. Tap Manage to add your daily list.</Text>
              </TouchableOpacity>
            ) : (
              supplements.map(s => {
                const taken = !!suppTaken[s.id]
                return (
                  <TouchableOpacity key={s.id} style={styles.suppRow} onPress={() => toggleSupplement(s.id)}>
                    <Icon name="medication" size={18} color="#7B4B94" />
                    <View style={styles.suppInfo}>
                      <Text style={styles.suppName}>{s.name}</Text>
                      <Text style={styles.suppTime}>
                        {to12h(s.reminder_time)}
                        {s.meal_relation === 'before_meal' ? '  ·  Before meal' : s.meal_relation === 'after_meal' ? '  ·  After meal' : ''}
                      </Text>
                    </View>
                    <View style={[styles.checkbox, taken && styles.checkboxOn]}>
                      {taken && <Icon name="ok" size={13} color="#FFFFFF" />}
                    </View>
                  </TouchableOpacity>
                )
              })
            )}
            {kidList.map((k) => {
              const rows = kidMeds.filter((m) => m.kid_id === k.id && scheduledToday(m)).flatMap((m) => slotsFor(m).map((sl) => ({ m, sl })))
              if (rows.length === 0) return null
              return (
                <View key={k.id}>
                  <Text style={styles.kidHead}>{k.name}</Text>
                  {rows.map(({ m, sl }) => {
                    const taken = takenKeys(kidLogs, m.id, localToday()).has(sl.key)
                    return (
                      <TouchableOpacity key={m.id + sl.key} style={styles.suppRow} onPress={() => toggleKidSlot(m, sl.key)} accessibilityRole="checkbox" accessibilityState={{ checked: taken }}>
                        <Icon name="medication" size={18} color="#7B4B94" />
                        <View style={styles.suppInfo}>
                          <Text style={styles.suppName}>{m.name}</Text>
                          <Text style={styles.suppTime}>{sl.label}{m.dosage ? `  |  ${m.dosage}` : ''}{m.kind === 'supplement' ? '  |  Supplement' : ''}</Text>
                        </View>
                        <View style={[styles.checkbox, taken && styles.checkboxOn]}>
                          {taken && <Icon name="ok" size={13} color="#FFFFFF" />}
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )
            })}
          </FrostedCard>
        </ReAnimated.View>
        )
      case 'activity':
        return (
<ReAnimated.View key="activity" entering={FadeInDown.delay(320)}>
          <FrostedCard>
            <View style={styles.cardHeader}>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle}>Activity</Text>
                <Icon name="trainer" size={16} color="#B5451B" />
              </View>
              <TouchableOpacity onPress={() => { setLifestyleStart(null); setActivePage('lifestyle') }}>
                <Text style={styles.cardLinkText}>+ Log Activity</Text>
              </TouchableOpacity>
            </View>
            {renderActivityBars()}
          </FrostedCard>
        </ReAnimated.View>
        )
      case 'sleep':
        return (
<ReAnimated.View key="sleep" entering={FadeInDown.delay(400)}>
          <FrostedCard>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Sleep</Text>
              <TouchableOpacity onPress={() => { setLifestyleStart(null); setActivePage('lifestyle') }}>
                <Text style={styles.cardLinkText}>+ Add Sleep Log</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.legend}>
              <View style={[styles.legendDot, { backgroundColor: '#7B4B94' }]} />
              <Text style={styles.legendText}>Duration (hours)</Text>
            </View>
            <View style={{ marginTop: 8 }}>{renderLineChart(sleepData, '#7B4B94', cw - 56)}</View>
          </FrostedCard>
        </ReAnimated.View>
        )
      default:
        return null
    }
  }

  const dashboardView = (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <View style={styles.root} {...edgePan.panHandlers}>
      <ScreenBackground />
      <StatusBar barStyle="dark-content" />

      <PatientTopBar
        onMenu={openDrawer}
        onBell={() => setActivePage('notifications')}
        onAvatar={() => setActivePage('profile')}
        unread={unreadCount}
        name={profile?.full_name || ''}
      />

      <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <View style={styles.segment}>
            {(['daily', 'weekly', 'annual'] as Period[]).map(p => (
              <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodBtnActive]} onPress={() => setPeriod(p)}>
                <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => setEditMode(!editMode)} style={[styles.editMini, editMode && styles.editMiniActive]}>
            <Icon name="edit" size={14} color={editMode ? '#FFFFFF' : '#2F4A1E'} />
            <Text style={[styles.editMiniText, editMode && styles.editMiniTextActive]}>{editMode ? 'Done' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>
        {period === 'daily' && (
          <View style={styles.datePicker}>
            <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateArrow}>
              <Icon name="back" size={18} color="#2F4A1E" />
            </TouchableOpacity>
            <Text style={styles.dateLabel}>{formatDate(selectedDate)}</Text>
            <TouchableOpacity onPress={() => changeDate(1)} disabled={selectedDate >= new Date().toISOString().split('T')[0]} style={styles.dateArrow}>
              <View style={selectedDate >= new Date().toISOString().split('T')[0] ? { opacity: 0.3 } : undefined}>
                <Icon name="forward" size={18} color="#2F4A1E" />
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.dashboard}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        scrollEnabled={!dragging}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5C7340" colors={['#5C7340']} />}
      >
        {caregiverInvites.map((inv) => (
          <View key={inv.link_id} style={styles.inviteCard}>
            <View style={styles.inviteIcon}>
              <Icon name="careteam" size={20} color="#5C7340" />
            </View>
            <Text style={styles.inviteTitle}>Caregiver invitation</Text>
            <Text style={styles.inviteBody}>
              {inv.patient_email} invited you to help manage their health as{' '}
              <Text style={styles.inviteTier}>{caregiverTierLabel(inv.tier)}</Text>.
              {inv.can_chat_providers ? ' You will also be able to message their doctors.' : ''}
            </Text>
            <View style={styles.inviteActions}>
              <TouchableOpacity style={styles.inviteDecline} onPress={() => declineInvite(inv.link_id)}>
                <Text style={styles.inviteDeclineText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.inviteAccept} onPress={() => acceptInvite(inv.link_id)}>
                <Text style={styles.inviteAcceptText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {pendingNotes.map((n) => (
          <TouchableOpacity key={n.id} style={styles.noteCard} activeOpacity={0.85} onPress={() => { setReviewNote({ note: n, from: 'dashboard' }); setActivePage('docnote') }} accessibilityRole="button">
            <View style={styles.inviteIcon}><Icon name="notes" size={20} color="#C4611A" /></View>
            <Text style={styles.inviteTitle}>{providerFullName(n)} left you a note</Text>
            <Text style={styles.inviteBody}>{n.title ? n.title + '. ' : ''}It is not in your Care Team yet. Review it to decide.</Text>
            <View style={styles.noteBtn}><Text style={styles.noteBtnText}>Review note</Text></View>
          </TouchableOpacity>
        ))}
        {editMode && (
          <View style={styles.moveHint}>
            <Text style={styles.moveHintText}>Press and hold a card to move it. Drag the corner to resize. Tap Done when finished.</Text>
          </View>
        )}
        <View ref={gridRef} style={[styles.cardGrid, { height: containerHeight }]}>
          {order.map((key, i) => {
            const w = clampW(fracOf(cardSizes[key]))
            const wpx = w >= 0.99 ? LIST_W : Math.floor(w * LIST_W) - 6
            return (
              <CardTile key={key} keyName={key} frac={w} wpx={wpx} editMode={editMode} isDragging={dragging?.key === key} onResize={onResize} listW={LIST_W} dragX={dragX} dragY={dragY} beginDrag={beginDrag} updatePreview={updatePreview} endDrag={endDrag} finalizeDrag={finalizeDrag} tileRefs={tileRefs} offsetsRef={offsetsRef} onMeasureHeight={onMeasureHeight} wiggleDir={i % 2 === 0 ? 1 : -1}>
                {renderCard(key, wpx)}
              </CardTile>
            )
          })}
        </View>
      </ScrollView>

      {dragging && (
        <ReAnimated.View pointerEvents="none" style={[styles.dragClone, { width: dragging.width, top: dragging.baseY, left: dragging.baseX }, cloneStyle]}>
          {renderCard(dragging.key, dragging.width)}
        </ReAnimated.View>
      )}

      {drawerOpen && (
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeDrawer} />
      )}

      {!drawerOpen && !dragging && !editMode && (
        <>
          {quickOpen && (
            <View style={styles.quickFull} pointerEvents="box-none">
              <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
              <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setQuickOpen(false)} accessibilityLabel="Close quick add" />
              <ReAnimated.View entering={FadeInDown.duration(180)} style={styles.quickSheet}>
                <Text style={styles.quickHeading}>Food</Text>
                <View style={styles.quickGrid}>
                  {([
                    ['Breakfast', 'breakfast', '#D9A441', { kind: 'food', mealType: 'Breakfast' }],
                    ['Lunch', 'lunch', '#C4611A', { kind: 'food', mealType: 'Lunch' }],
                    ['Dinner', 'dinner', '#7B4B94', { kind: 'food', mealType: 'Dinner' }],
                    ['Snacks', 'snack', '#5C7340', { kind: 'food', mealType: 'Snack' }],
                  ] as [string, string, string, NonNullable<LifestyleStart>][]).map(([label, icon, color, start]) => (
                    <TouchableOpacity key={label} style={styles.quickCell} onPress={() => { setQuickOpen(false); setLifestyleStart(start); setActivePage('lifestyle') }} accessibilityRole="button" accessibilityLabel={`Add ${label}`}>
                      <View style={[styles.quickBubble, { backgroundColor: color }]}><Icon name={icon as any} size={28} color="#FFFFFF" /></View>
                      <Text style={styles.quickCellText}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.quickHeading}>Move, rest and medicine</Text>
                <View style={styles.quickGrid}>
                  {([
                    ['Exercise', 'trainer', '#2F4A1E', () => { setLifestyleStart({ kind: 'workout' }); setActivePage('lifestyle') }],
                    ['Sleep', 'sleep', '#4B3F72', () => { setLifestyleStart({ kind: 'sleep' }); setActivePage('lifestyle') }],
                    ['Meds', 'medication', '#3D7A5E', () => setActivePage('supplements')],
                  ] as [string, string, string, () => void][]).map(([label, icon, color, fn]) => (
                    <TouchableOpacity key={label} style={styles.quickCell} onPress={() => { setQuickOpen(false); fn() }} accessibilityRole="button" accessibilityLabel={`Log ${label}`}>
                      <View style={[styles.quickBubble, { backgroundColor: color }]}><Icon name={icon as any} size={28} color="#FFFFFF" /></View>
                      <Text style={styles.quickCellText}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ReAnimated.View>
            </View>
          )}
          <View style={styles.quickWrap} pointerEvents="box-none">
            <TouchableOpacity style={styles.quickFab} onPress={() => setQuickOpen(!quickOpen)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={quickOpen ? 'Close quick add' : 'Quick add'}>
              <Icon name={quickOpen ? 'close' : 'add'} size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </>
      )}

      <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]} {...drawerPan.panHandlers}>
        <View style={styles.drawerInner}>
          <View style={styles.drawerHeader}>
            <Image source={require('../../assets/bridgette-logo.png')} style={styles.drawerWordmark} resizeMode="contain" />
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.drawerScroll}>
            <TouchableOpacity style={styles.drawerItem} activeOpacity={0.7} onPress={() => navigate('notifications')}>
              <View style={styles.drawerIconTile}>
                <Icon name="bell" size={18} color="#2F4A1E" />
              </View>
              <Text style={styles.drawerItemText} numberOfLines={1}>Notifications</Text>
              {unreadCount > 0 && (
                <View style={styles.drawerBadge}>
                  <Text style={styles.drawerBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.drawerItem} activeOpacity={0.7} onPress={() => navigate('kids')}>
              <View style={styles.drawerIconTile}>
                <Icon name="kids" size={18} color="#2F4A1E" />
              </View>
              <Text style={styles.drawerItemText} numberOfLines={1}>Bridgette for Kids</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.drawerItem} activeOpacity={0.7} onPress={() => navigate('pets')}>
              <View style={styles.drawerIconTile}>
                <Icon name="paw" size={18} color="#2F4A1E" />
              </View>
              <Text style={styles.drawerItemText} numberOfLines={1}>Bridgette for Pets</Text>
              <View style={styles.drawerSoon}>
                <Text style={styles.drawerSoonText}>Soon</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.drawerItem} activeOpacity={0.7} onPress={() => navigate('community')}>
              <View style={styles.drawerIconTile}>
                <Icon name="careteam" size={18} color="#2F4A1E" />
              </View>
              <Text style={styles.drawerItemText} numberOfLines={1}>Community</Text>
              <View style={styles.drawerSoon}>
                <Text style={styles.drawerSoonText}>Soon</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.drawerDivider} />

            {([
              { key: 'mhist', icon: 'record', label: 'Medical History', items: [['history:all', 'All History'], ['history:surgery', 'Past Surgery'], ['history:records', 'Medical Records']] },
              { key: 'health', icon: 'notes', label: 'My Health', items: [['vaccines', 'Vaccines'], ['allergies', 'Allergies'], ['trends', 'Lab Trends']] },
              { key: 'log', icon: 'diet', label: 'Daily Log', items: [['lifestyle', 'Logged Foods'], ['labelreader', 'Label Reader'], ['grocery', 'Grocery List'], ['supplements', 'Supplements & Medicine']] },
              { key: 'care', icon: 'careteam', label: 'Care', items: [['share', 'Care Team'], ['messages', 'Messages'], ['share', 'Share with Doctor'], ['share', 'External Link']] },
              { key: 'family', icon: 'careteam', label: 'Family', items: [['caregivers', 'Caregivers'], ['caregiving', 'People I care for']] },
            ] as { key: string; icon: any; label: string; items: [string, string][] }[]).map((g) => {
              const open = openGroups.includes(g.key)
              return (
                <View key={g.key} style={open ? styles.drawerGroupOpen : undefined}>
                  <TouchableOpacity
                    style={styles.drawerItem}
                    activeOpacity={0.7}
                    onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setOpenGroups((cur) => (open ? cur.filter((k) => k !== g.key) : [...cur, g.key])) }}
                  >
                    <View style={[styles.drawerIconTile, open && { backgroundColor: '#2F4A1E' }]}>
                      <Icon name={g.icon} size={18} color={open ? '#FFFFFF' : '#2F4A1E'} />
                    </View>
                    <Text style={styles.drawerItemText} numberOfLines={1}>{g.label}</Text>
                    <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
                      <Icon name="forward" size={16} color="#5B6650" />
                    </View>
                  </TouchableOpacity>
                  {open && (
                    <View style={styles.drawerSub}>
                      {g.items.map(([page, label]) => (
                        <TouchableOpacity key={label} style={styles.drawerSubItem} activeOpacity={0.7} onPress={() => { if (page.startsWith('history:')) { setHistTab(page.split(':')[1] as any); navigate('history') } else navigate(page as any) }}>
                          <Text style={styles.drawerSubText} numberOfLines={1}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )
            })}
          </ScrollView>

          <View style={styles.drawerBottom}>
            <View style={styles.drawerFootRow}>
              <TouchableOpacity style={styles.drawerFootBtn} activeOpacity={0.7} onPress={() => navigate('profile')}>
                <Icon name="account" size={16} color="#2F4A1E" />
                <Text style={styles.drawerFootText}>Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerFootBtn} activeOpacity={0.7} onPress={() => navigate('settings')}>
                <Icon name="settings" size={16} color="#2F4A1E" />
                <Text style={styles.drawerFootText}>Settings</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={signOut} style={styles.drawerSignOut}>
              <Text style={styles.drawerSignOutText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
    <PatientTabBar active="dashboard" onNavigate={goToTab} unread={unreadCount} />
    </GestureHandlerRootView>
  )

  const renderPage = (): React.ReactNode => {
  if (activePage === 'records') return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={goBack}>
    <View style={styles.tabHost}>
      <ScreenBackground />
      <PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={goBack} unread={unreadCount} title="Medical Records" onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} />
      <View style={{ flex: 1 }}><MedicalRecordsScreen onBack={goBack} onOpenTrends={() => setActivePage('trends')} /></View>
      <PatientTabBar active="records" onNavigate={goToTab} unread={unreadCount} />
    </View></SwipeBack></EmbeddedCtx.Provider>
  )
  if (activePage === 'history') return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={goBack}><View style={{ flex: 1 }}><ScreenBackground /><PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={goBack} unread={unreadCount} title="Medical History" onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} /><View style={{ flex: 1 }}><MedicalHubScreen initialTab={histTab} onBack={goBack} onOpenTrends={() => setActivePage('trends')} onTabChange={setHistTab} onOpenCare={(n) => { pendingProfile.name = n; skipSub.current = true; setActivePage('share') }} /></View></View></SwipeBack></EmbeddedCtx.Provider>
  )
  if (activePage === 'trends') return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={goBack}><View style={{ flex: 1 }}><ScreenBackground /><PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={goBack} unread={unreadCount} title="Lab Trends" onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} /><View style={{ flex: 1 }}><TrendsScreen onBack={goBack} /></View></View></SwipeBack></EmbeddedCtx.Provider>
  )
  if (activePage === 'lifestyle') return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={goBack}><View style={{ flex: 1 }}><ScreenBackground /><PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={goBack} unread={unreadCount} title="Lifestyle Log" onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} /><View style={{ flex: 1 }}><LifestyleScreen key={JSON.stringify(lifestyleStart)} onBack={() => { setLifestyleStart(null); setActivePage('dashboard') }} initialAdd={lifestyleStart} /></View></View></SwipeBack></EmbeddedCtx.Provider>
  )
  if (activePage === 'share') return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={backSub}>
    <View style={styles.tabHost}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F5F2EC' }} />
      {/* The page fills the whole screen and scrolls behind the floating header and tab bar. */}
      <ChromeInsetCtx.Provider value={{ top: 112, bottom: 100 }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}><ShareLinkScreen onBack={goBack} onReviewNote={(n: any) => { setReviewNote({ note: n, from: 'share' }); setActivePage('docnote') }} /></View>
      </ChromeInsetCtx.Provider>
      <EdgeFades color="#F5F2EC" top={120} bottom={120} solidTop={0.5} solidBottom={0.4} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="box-none">
        <PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={backSub} unread={unreadCount} title="Care Team" onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} />
      </View>
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} pointerEvents="box-none">
        <PatientTabBar active="share" onNavigate={goToTab} unread={unreadCount} />
      </View>
    </View></SwipeBack></EmbeddedCtx.Provider>
  )

  if (activePage === 'supplements') return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={goBack}><View style={{ flex: 1 }}><ScreenBackground /><PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={goBack} unread={unreadCount} title="Supplements" onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} /><View style={{ flex: 1 }}><SupplementsScreen onBack={goBack} /></View></View></SwipeBack></EmbeddedCtx.Provider>
  )
  if (activePage === 'profile') return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={goBack}><View style={{ flex: 1 }}><ScreenBackground /><PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={goBack} unread={unreadCount} title="Profile" onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} /><View style={{ flex: 1 }}><ProfileScreen onBack={goBack} onOpen={(t) => setActivePage(t)} /></View></View></SwipeBack></EmbeddedCtx.Provider>
  )
  if (activePage === 'settings') return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={goBack}><View style={{ flex: 1 }}><ScreenBackground /><PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={goBack} unread={unreadCount} title="Settings" onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} /><View style={{ flex: 1 }}><SettingsScreen onBack={goBack} onOpen={(t) => setActivePage(t)} /></View></View></SwipeBack></EmbeddedCtx.Provider>
  )
  if (activePage === 'community') return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={goBack}><View style={{ flex: 1 }}><ScreenBackground /><PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={goBack} unread={unreadCount} title="Community" onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} /><View style={{ flex: 1 }}><CommunityScreen onBack={goBack} /></View></View></SwipeBack></EmbeddedCtx.Provider>
  )
  if (activePage === 'vaccines') return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={goBack}><View style={{ flex: 1 }}><ScreenBackground /><PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={goBack} unread={unreadCount} title="Vaccines" onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} /><View style={{ flex: 1 }}><VaccinesScreen onBack={goBack} /></View></View></SwipeBack></EmbeddedCtx.Provider>
  )
  if (activePage === 'labelreader') return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={() => { if (savedLabel) { setSavedLabel(null); setActivePage('grocery') } else goBack() }}><View style={{ flex: 1, backgroundColor: '#F5F2EC' }}><PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={() => { if (savedLabel) { setSavedLabel(null); setActivePage('grocery') } else goBack() }} unread={unreadCount} title="Label Reader" onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} /><View style={{ flex: 1 }}><LabelReaderScreen key={savedLabel ? 'saved' : 'new'} initialLabel={savedLabel} onBack={() => { if (savedLabel) { setSavedLabel(null); setActivePage('grocery') } else goBack() }} onOpenGrocery={() => setActivePage('grocery')} onOpenAllergies={() => setActivePage('allergies')} /></View></View></SwipeBack></EmbeddedCtx.Provider>
  )
  if (activePage === 'grocery') return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={goBack}><View style={{ flex: 1 }}><ScreenBackground /><PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={goBack} unread={unreadCount} title="Grocery List" onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} /><View style={{ flex: 1 }}><GroceryScreen onBack={goBack} onScan={() => { setSavedLabel(null); setActivePage('labelreader') }} onOpenItem={(l) => { setSavedLabel(l); setActivePage('labelreader') }} /></View></View></SwipeBack></EmbeddedCtx.Provider>
  )
  if (activePage === 'allergies') return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={goBack}><View style={{ flex: 1, backgroundColor: '#F5F2EC' }}><PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={goBack} unread={unreadCount} title="Allergies" onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} /><View style={{ flex: 1 }}><AllergiesScreen onBack={goBack} /></View></View></SwipeBack></EmbeddedCtx.Provider>)
  if (activePage === 'activitylog') return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={goBack}><View style={{ flex: 1 }}><ScreenBackground /><PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={goBack} unread={unreadCount} title="Activity log" onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} /><View style={{ flex: 1 }}><ActivityLogScreen onBack={goBack} /></View></View></SwipeBack></EmbeddedCtx.Provider>)
  if (activePage === 'kids') return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={backSub}><View style={{ flex: 1 }}><ScreenBackground /><PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={backSub} unread={unreadCount} title={kidsTitle} onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} /><View style={{ flex: 1 }}><KidsScreen onBack={goBack} onTitle={setKidsTitle} /></View></View></SwipeBack></EmbeddedCtx.Provider>)
  if (activePage === 'pets') return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={goBack}><View style={{ flex: 1 }}><ScreenBackground /><PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={goBack} unread={unreadCount} title="Bridgette for Pets" onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} /><View style={{ flex: 1 }}><PetsScreen onBack={goBack} /></View></View></SwipeBack></EmbeddedCtx.Provider>
  )
  if (activePage === 'caregivers') return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={goBack}><View style={{ flex: 1 }}><ScreenBackground /><PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={goBack} unread={unreadCount} title="Caregivers" onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} /><View style={{ flex: 1 }}><CaregiversScreen onBack={goBack} /></View></View></SwipeBack></EmbeddedCtx.Provider>
  )
  if (activePage === 'caregiving') return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={goBack}><View style={{ flex: 1 }}><ScreenBackground /><PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={goBack} unread={unreadCount} title="Caregiving" onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} /><View style={{ flex: 1 }}><CaregivingScreen onBack={goBack} /></View></View></SwipeBack></EmbeddedCtx.Provider>
  )
  if (activePage === 'messages') return (<EmbeddedCtx.Provider value={true}>
    <View style={styles.tabHost}>
      <ScreenBackground />
      <ChromeInsetCtx.Provider value={threadOpen ? { top: 0, bottom: 0 } : { top: 112, bottom: 100 }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <DoctorMessages
            patientId={session?.user.id || ''}
            myId={session?.user.id || ''}
            myRole="patient"
            myName={profile?.full_name || session?.user.email || 'You'}
            accent="#5C7340"
            headerTitle="Messages"
            onBack={goBack}
            onThreadActiveChange={setThreadOpen}
            plain
            onOpenCareTeam={() => goToTab('share')}
          />
        </View>
      </ChromeInsetCtx.Provider>
      {!threadOpen && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="box-none">
          <PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBell={() => setMsgNotifOpen(true)} onAvatar={() => setActivePage('profile')} unread={unreadCount} title="Messages" onBack={goBack} />
        </View>
      )}
      {!threadOpen && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} pointerEvents="box-none">
          <PatientTabBar active="messages" onNavigate={goToTab} unread={unreadCount} />
        </View>
      )}
      {msgNotifOpen && !threadOpen && <NotificationsPopover onClose={() => setMsgNotifOpen(false)} onSeeAll={() => { setMsgNotifOpen(false); setActivePage('notifications') }} />}
    </View></EmbeddedCtx.Provider>
  )
  if (activePage === 'docnote' && reviewNote) return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={goBack}>
    <View style={styles.tabHost}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F5F2EC' }} />
      <ChromeInsetCtx.Provider value={{ top: 112, bottom: 100 }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <DocNoteScreen note={reviewNote.note} onDone={(accepted) => {
            setPendingNotes((p) => p.filter((x) => x.id !== reviewNote.note.id))
            setUnreadCount(0)
            if (accepted) goBackTo('share'); else goBack()
          }} />
        </View>
      </ChromeInsetCtx.Provider>
      <EdgeFades color="#F5F2EC" top={120} bottom={120} solidTop={0.5} solidBottom={0.4} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="box-none">
        <PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={goBack} unread={unreadCount} title="Review note" onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} />
      </View>
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} pointerEvents="box-none">
        <PatientTabBar active="share" onNavigate={goToTab} unread={unreadCount} />
      </View>
    </View></SwipeBack></EmbeddedCtx.Provider>
  )
  if (activePage === 'notifications') return (<EmbeddedCtx.Provider value={true}><SwipeBack onBack={() => { goBack(); setUnreadCount(0) }}>
    <View style={styles.tabHost}>
      <ScreenBackground />
      <PatientTopBar onMenu={() => { setActivePage('dashboard'); setTimeout(openDrawer, 50) }} onBack={() => { goBack(); setUnreadCount(0) }} unread={unreadCount} title="Notifications" onBell={() => setActivePage('notifications')} onAvatar={() => setActivePage('profile')} />
      <View style={{ flex: 1 }}>
        <PatientNotificationsScreen
          onBack={() => { goBack(); setUnreadCount(0) }}
          onOpenSummary={() => setActivePage('dashboard')}
          onOpenDataRequest={(provider) => setActivePage('share')}
          onReviewNote={(n: any) => { setReviewNote({ note: n, from: 'notifications' }); setActivePage('docnote') }}
        />
      </View>
      <PatientTabBar active="notifications" onNavigate={goToTab} unread={unreadCount} />
    </View></SwipeBack></EmbeddedCtx.Provider>
  )
    return null
  }
  const page = renderPage()

  return (
    <View style={{ flex: 1 }}>
      <View style={StyleSheet.absoluteFill} pointerEvents={page ? 'none' : 'auto'}>{dashboardView}</View>
      {page}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F2EC' },
  tabHost: { flex: 1, backgroundColor: '#F5F2EC' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 10 },
  roundBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1, borderColor: 'rgba(47,74,30,0.12)', alignItems: 'center', justifyContent: 'center' },
  hLine: { width: 18, height: 2, backgroundColor: '#2F4A1E', borderRadius: 1, marginBottom: 4 },
  brandWrap: { flex: 1, alignItems: 'center' },
  brandLogo: { width: 132, height: 29 },
  doneBtn: { backgroundColor: '#5C7340', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 12 },
  doneBtnText: { fontSize: 12, fontFamily: 'DMSans-Bold', color: '#fff' },
  signOutText: { fontSize: 12, color: '#4F5048' },
  controls: { paddingHorizontal: 16, paddingBottom: 8 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  segment: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: 3, borderWidth: 1, borderColor: 'rgba(47,74,30,0.12)' },
  editMini: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(47,74,30,0.12)', backgroundColor: 'rgba(255,255,255,0.85)' },
  editMiniActive: { backgroundColor: '#2F4A1E', borderColor: '#2F4A1E' },
  editMiniText: { fontSize: 13, fontFamily: 'DMSans-Bold', color: '#2F4A1E' },
  editMiniTextActive: { color: '#FFFFFF' },
  rowWrap: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardGrid: { position: 'relative', width: '100%' },
  cardAbs: { position: 'absolute', top: 0, left: 0 },
  moveHint: { backgroundColor: 'rgba(92,115,64,0.12)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  noteCard: { backgroundColor: 'rgba(255,250,244,0.97)', borderRadius: 16, borderWidth: 1, borderColor: '#C4611A', padding: 16, marginBottom: 14 },
  noteBtn: { alignSelf: 'flex-start', backgroundColor: '#5C7340', borderRadius: 99, paddingHorizontal: 16, paddingVertical: 9, marginTop: 12 },
  noteBtnText: { color: '#fff', fontSize: 13, fontFamily: 'DMSans-Bold' },
  inviteCard: { backgroundColor: 'rgba(245,242,236,0.96)', borderRadius: 16, borderWidth: 1, borderColor: '#5C7340', padding: 16, marginBottom: 14 },
  inviteIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EBEFE3', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  inviteTitle: { fontFamily: 'DMSans-Medium', fontSize: 17, color: '#383A33', marginBottom: 6 },
  inviteBody: { fontSize: 13, color: '#5A4A38', lineHeight: 20, marginBottom: 14 },
  inviteTier: { fontFamily: 'DMSans-Medium', color: '#5C7340' },
  inviteActions: { flexDirection: 'row', gap: 10 },
  inviteDecline: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5DFD3', alignItems: 'center' },
  inviteDeclineText: { fontSize: 14, fontFamily: 'DMSans-Bold', color: '#4F5048' },
  inviteAccept: { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: '#5C7340', alignItems: 'center' },
  inviteAcceptText: { fontSize: 14, fontFamily: 'DMSans-Bold', color: '#fff' },
  moveHintText: { fontSize: 12, color: '#383A33', fontFamily: 'DMSans-Bold', textAlign: 'center' },
  cardPicked: { opacity: 0.55 },
  sizeTag: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(61,50,41,0.85)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  sizeTagText: { fontSize: 10, fontFamily: 'DMSans-Bold', color: '#FFFFFF' },
  resizeHandle: { position: 'absolute', right: 6, bottom: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.96)', alignItems: 'center', justifyContent: 'center', zIndex: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 4 },
  resizeHandleIcon: { transform: [{ rotate: '45deg' }] },
  selRing: { position: 'absolute', top: -3, left: -3, right: -3, bottom: 11, borderWidth: 2, borderColor: '#5C7340', borderRadius: 18, zIndex: 15 },
  dragClone: { position: 'absolute', zIndex: 999, elevation: 20 },
  sizeBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(61,50,41,0.92)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  sizeBtnText: { fontSize: 10, fontFamily: 'DMSans-Bold', color: '#FFFFFF' },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 11, alignItems: 'center' },
  periodBtnActive: { backgroundColor: '#2F4A1E' },
  periodBtnText: { fontSize: 13, fontFamily: 'DMSans-Bold', color: '#5B6650' },
  periodBtnTextActive: { color: '#FFFFFF' },
  datePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 14, borderWidth: 1.5, borderColor: '#5C7340', paddingHorizontal: 6, paddingVertical: 4 },
  dateArrow: { width: 36, height: 32, alignItems: 'center', justifyContent: 'center' },
  dateLabel: { fontSize: 14, fontFamily: 'DMSans-Bold', color: '#383A33' },
  dashboard: { flex: 1 },

  cardBlur: { borderRadius: 16, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: '#DDD7CB' },
  cardTint: { backgroundColor: 'rgba(255,255,255,0.72)', padding: 16 },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontFamily: 'DMSans-Medium', color: '#383A33' },
  cardSub: { fontSize: 11, color: '#4F5048', marginBottom: 4 },
  noDataNote: { fontSize: 12, color: '#4F5048', fontStyle: 'italic', marginVertical: 6 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#4F5048' },
  cardLink: { alignSelf: 'flex-end', marginTop: 8 },
  cardLinkText: { fontSize: 12, color: '#2F4A1E', fontFamily: 'DMSans-Bold' },
  careRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  apptSub: { fontSize: 12, color: '#4F5048', marginTop: 2, marginBottom: 4 },
  apptRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, padding: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1, borderColor: 'rgba(47,74,30,0.10)' },
  apptRowOverdue: { backgroundColor: '#FBEBDD', borderColor: '#F0D3BB' },
  apptDate: { width: 48, height: 52, borderRadius: 12, backgroundColor: '#EEF3E6', alignItems: 'center', justifyContent: 'center' },
  apptDateOverdue: { backgroundColor: '#fff' },
  apptMonth: { fontSize: 11, fontFamily: 'DMSans-Bold', color: '#3F5229', textTransform: 'uppercase' },
  apptDay: { fontSize: 20, fontFamily: 'DMSans-Bold', color: '#2F4A1E', lineHeight: 24 },
  apptWhen: { fontSize: 12.5, fontFamily: 'DMSans-Bold', color: '#3F5229', marginTop: 2 },
  noteBox: { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(47,74,30,0.10)' },
  noteTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  noteAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF3E6', borderWidth: 2, borderColor: '#2F4A1E', alignItems: 'center', justifyContent: 'center' },
  notePhoto: { width: 40, height: 40, borderRadius: 20 },
  noteAvatarText: { fontSize: 15, fontFamily: 'DMSans-Medium', color: '#2F4A1E' },
  noteLabel: { fontSize: 11, fontFamily: 'DMSans-Bold', color: '#5B6650', marginBottom: 2 },
  noteDoctor: { fontSize: 15, fontFamily: 'DMSans-Medium', color: '#383A33' },
  noteMeta: { fontSize: 12, color: '#5B6650', marginTop: 1 },
  noteSnippet: { fontSize: 13, color: '#383A33', lineHeight: 19, marginTop: 10 },
  careIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF3E6', alignItems: 'center', justifyContent: 'center' },
  careText: { flex: 1, fontSize: 13, color: '#383A33', lineHeight: 19 },
  careActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  careBtn: { backgroundColor: '#2F4A1E', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  careBtnText: { fontSize: 13, fontFamily: 'DMSans-Bold', color: '#FFFFFF' },
  careBtnGhost: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#2F4A1E', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  careBtnGhostText: { fontSize: 13, fontFamily: 'DMSans-Bold', color: '#2F4A1E' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  emptyChart: { height: 60, alignItems: 'center', justifyContent: 'center' },
  emptyChartText: { fontSize: 12, color: '#4F5048', fontStyle: 'italic' },

  summaryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  aiChip: { backgroundColor: '#EEF3E6', borderColor: '#A9BE8F', borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  aiChipText: { fontSize: 10, fontFamily: 'DMSans-Bold', color: '#2F4A1E', letterSpacing: 0.5 },
  summaryText: { fontSize: 13, color: '#5A4A38', lineHeight: 20 },

  testSelector: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#E5DFD3', maxWidth: 160 },
  testSelectorText: { fontSize: 11, fontFamily: 'DMSans-Bold', color: '#383A33', flex: 1 },
  testDropdown: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E5DFD3', marginTop: 6, marginBottom: 4, overflow: 'hidden' },
  testDropdownItem: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F0EBE1' },
  testDropdownItemActive: { backgroundColor: '#F0EBE1' },
  testDropdownText: { fontSize: 13, color: '#4F5048' },
  testDropdownTextActive: { color: '#383A33', fontFamily: 'DMSans-Medium' },

  ringContainer: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  ringLegend: { flex: 1, gap: 8 },
  ringLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ringDot: { width: 10, height: 10, borderRadius: 5 },
  ringLegendText: { fontSize: 12, color: '#5A4A38' },
  ringPct: { fontSize: 13, fontFamily: 'DMSans-Bold', color: '#5C7340', marginTop: 2 },

  suppRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(229,223,211,0.6)' },
  suppInfo: { flex: 1 },
  kidRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  kidAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEF3E6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  kidAvatarTxt: { fontSize: 16, fontFamily: 'DMSans-Bold', color: '#2F4A1E' },
  kidRowName: { fontSize: 15, fontFamily: 'DMSans-Medium', color: '#383A33' },
  kidRowSub: { fontSize: 12, color: '#4F5048', marginTop: 1 },
  kidRowDue: { fontSize: 12, fontFamily: 'DMSans-Medium', color: '#B8442E', marginTop: 3 },
  kidRowTurn: { fontSize: 12, fontFamily: 'DMSans-Medium', color: '#9A6A12', marginTop: 3 },
  kidHead: { fontSize: 12, fontFamily: 'DMSans-Bold', color: '#4F5048', marginTop: 12, marginBottom: 2 },
  suppName: { fontSize: 13, fontFamily: 'DMSans-Bold', color: '#383A33' },
  suppTime: { fontSize: 11, color: '#4F5048' },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#E5DFD3', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },
  checkboxOn: { backgroundColor: '#5C7340', borderColor: '#5C7340' },

  barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 12, height: 60 },
  barItem: { alignItems: 'center', gap: 4 },
  bar: { width: 14, borderRadius: 4 },
  barLabel: { fontSize: 9, color: '#4F5048' },

  bellFloat: {
    position: 'absolute', bottom: 32, right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#3D3229', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8, zIndex: 50,
  },
  bellBadge: {
    position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#C4611A', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#3D3229',
  },
  bellBadgeText: { fontSize: 9, fontFamily: 'DMSans-Bold', color: '#fff' },

  quickBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 4 },
  quickWrap: { position: 'absolute', right: 20, bottom: 16, alignItems: 'flex-end', gap: 12, zIndex: 8 },
  quickFab: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#2F4A1E', alignItems: 'center', justifyContent: 'center', shadowColor: '#1F3A24', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  quickFull: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 6, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  quickSheet: { width: '88%', borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.94)', paddingVertical: 20, paddingHorizontal: 14 },
  quickBubble: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  quickHeading: { fontSize: 15, fontFamily: 'DMSans-Bold', color: '#383A33', textAlign: 'center', marginBottom: 14 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', rowGap: 14, marginBottom: 18 },
  quickCell: { width: '25%', alignItems: 'center', gap: 6 },
  quickCellText: { fontSize: 12.5, fontFamily: 'DMSans-Bold', color: '#383A33' },
  quickMenu: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#DDD7CB', padding: 14, shadowColor: '#1F3A24', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  quickItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#ECE8DE' },
  quickIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#EEF3E6', alignItems: 'center', justifyContent: 'center' },
  quickText: { fontSize: 14.5, fontFamily: 'DMSans-Bold', color: '#383A33', paddingRight: 6 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 10 },
  drawer: { position: 'absolute', top: 0, left: 0, bottom: 0, width: DRAWER_WIDTH, backgroundColor: '#F7F4EC', zIndex: 20, borderRightWidth: 1.5, borderRightColor: 'rgba(47,74,30,0.35)', borderTopRightRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 20 },
  drawerInner: { flex: 1, paddingTop: 56 },
  drawerHeader: { paddingHorizontal: 20, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(47,74,30,0.12)' },
  drawerWordmark: { width: 150, height: 33 },
  drawerScroll: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12 },
  drawerSectionLabel: { fontSize: 12, fontFamily: 'DMSans-Bold', color: '#5B6650', paddingHorizontal: 10, marginTop: 4, marginBottom: 6 },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 14 },
  drawerIconTile: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#EEF3E6', alignItems: 'center', justifyContent: 'center' },
  drawerItemText: { flex: 1, fontSize: 15, fontFamily: 'DMSans-Medium', color: '#383A33' },
  drawerGroupOpen: { backgroundColor: 'rgba(47,74,30,0.05)', borderRadius: 16, marginBottom: 4 },
  drawerSub: { marginLeft: 26, paddingLeft: 22, paddingBottom: 8, borderLeftWidth: 2, borderLeftColor: 'rgba(47,74,30,0.25)' },
  drawerSubItem: { paddingVertical: 11, paddingRight: 12 },
  drawerSubText: { fontSize: 14, fontFamily: 'DMSans-Bold', color: '#383A33' },
  drawerSoon: { backgroundColor: '#FBEBDD', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  drawerSoonText: { fontSize: 11, fontFamily: 'DMSans-Bold', color: '#9A4A12' },
  drawerFootRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  drawerFootBtn: { flex: 1, height: 44, borderRadius: 14, backgroundColor: '#EEF3E6', borderWidth: 1, borderColor: 'rgba(47,74,30,0.35)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  drawerFootText: { fontSize: 14, fontFamily: 'DMSans-Bold', color: '#2F4A1E' },
  drawerBadge: { backgroundColor: '#C4611A', minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  drawerBadgeText: { fontSize: 11, fontFamily: 'DMSans-Bold', color: '#fff' },
  drawerDivider: { height: 1, backgroundColor: 'rgba(47,74,30,0.12)', marginHorizontal: 8, marginVertical: 12 },
  drawerBottom: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40, borderTopWidth: 1, borderTopColor: 'rgba(47,74,30,0.12)' },
  drawerSignOut: { height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: '#2F4A1E' },
  drawerSignOutText: { fontSize: 14, color: '#2F4A1E', fontFamily: 'DMSans-Bold' },
  cz_backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  cz_sheet: { backgroundColor: '#F5F2EC', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 20 },
  cz_handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D8D0C2', alignSelf: 'center', marginBottom: 10 },
  cz_header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cz_title: { fontFamily: 'DMSans-Medium', fontSize: 18, color: '#383A33' },
  cz_sub: { fontSize: 12, color: '#4F5048', marginTop: 4, marginBottom: 12, lineHeight: 17 },
  cz_row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5DFD3', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, gap: 12 },
  cz_rowNum: { width: 20, fontSize: 13, fontFamily: 'DMSans-Bold', color: '#4F5048' },
  cz_rowLabel: { flex: 1, fontSize: 15, fontFamily: 'DMSans-Medium', color: '#383A33' },
  cz_arrows: { flexDirection: 'row', gap: 6 },
  cz_arrowBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F0EBE1', alignItems: 'center', justifyContent: 'center' },
  cz_arrowDisabled: { backgroundColor: '#F5F2EC' },
  cz_actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cz_resetBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E5DFD3', alignItems: 'center', backgroundColor: '#fff' },
  cz_resetText: { fontSize: 14, fontFamily: 'DMSans-Bold', color: '#4F5048' },
  cz_doneBtn: { flex: 2, backgroundColor: '#5C7340', padding: 14, borderRadius: 10, alignItems: 'center' },
  cz_doneText: { fontSize: 14, fontFamily: 'DMSans-Bold', color: '#fff' },
  cz_rowActive: { borderColor: '#5C7340', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 10 },
  cz_grip: { gap: 3, paddingHorizontal: 6, paddingVertical: 4 },
  cz_gripBar: { width: 18, height: 2, borderRadius: 1, backgroundColor: '#C9C0B0' },
  cardDragging: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 14 },
})