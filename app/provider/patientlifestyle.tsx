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
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
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

const QUALITY_LABELS: Record<number, string> = {
  1: 'Very poor', 2: 'Poor', 3: 'Okay', 4: 'Good', 5: 'Great'
}

const NUTRITION_PLAN = {
  provider: 'Beatrix Mercado, RND',
  date: 'April 21, 2026',
  notes: 'Mediterranean-style meal plan prescribed following review of Bridgette food logs. Patient motivated and logging meals consistently. Focus on reducing saturated fat and increasing fiber to support lipid management.',
  goals: [
    '25g fiber per day',
    'Olive oil over palm oil for cooking',
    'Lean protein at every meal',
    'Reduce processed meat to once per week',
    'Brown rice over white rice',
    'Increase vegetable intake to 3 servings/day',
  ],
}

type Tab = 'Food' | 'Sleep' | 'Workouts' | 'Nutrition Plan'

export default function PatientLifestyleScreen({
  patientId,
  patientName,
  onBack,
}: {
  patientId: string
  patientName: string
  onBack: () => void
}) {
  const [activeTab, setActiveTab] = useState<Tab>('Food')
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([])
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const [foodRes, sleepRes, actRes] = await Promise.all([
      supabase.from('food_logs').select('*').eq('patient_id', patientId).order('log_date', { ascending: false }).limit(30),
      supabase.from('sleep_logs').select('*').eq('patient_id', patientId).order('log_date', { ascending: false }).limit(14),
      supabase.from('activity_logs').select('*').eq('patient_id', patientId).order('log_date', { ascending: false }).limit(20),
    ])
    if (foodRes.data) setFoodLogs(foodRes.data)
    if (sleepRes.data) setSleepLogs(sleepRes.data)
    if (actRes.data) setActivityLogs(actRes.data)
    setLoading(false)
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Food analysis
  const unhealthyCount = foodLogs.filter(l => l.health_flag === 'unhealthy').length
  const healthyCount = foodLogs.filter(l => l.health_flag === 'healthy').length
  const fastFoodCount = foodLogs.filter(l => l.is_fast_food).length
  const totalFoodLogs = foodLogs.length

  // Sleep analysis
  const avgSleep = sleepLogs.length > 0
    ? (sleepLogs.reduce((acc, l) => acc + l.hours_slept, 0) / sleepLogs.length).toFixed(1)
    : null
  const goodSleepDays = sleepLogs.filter(l => l.hours_slept >= 7).length

  // Workout analysis
  const totalWorkouts = activityLogs.length
  const totalMinutes = activityLogs.reduce((acc, l) => acc + l.duration_minutes, 0)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← {patientName}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Lifestyle</Text>
        <Text style={styles.subtitle}>{patientName}'s health habits</Text>

        {/* Sub tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContent}>
          {(['Food', 'Sleep', 'Workouts', 'Nutrition Plan'] as Tab[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#6B4FA0" />
      ) : (
        <ScrollView style={styles.content}>

          {/* FOOD TAB */}
          {activeTab === 'Food' && (
            <>
              {/* AI Analysis */}
              <View style={styles.aiCard}>
                <Text style={styles.aiCardTitle}>🤖 AI Food Analysis</Text>
                <Text style={styles.aiCardText}>
                  Based on {totalFoodLogs} logged meals: {healthyCount > unhealthyCount
                    ? `${patientName.split(' ')[0]} is making mostly healthy food choices — ${healthyCount} healthy vs ${unhealthyCount} unhealthy meals logged.`
                    : `${patientName.split(' ')[0]} has logged ${unhealthyCount} unhealthy meals vs ${healthyCount} healthy. Diet needs significant improvement.`
                  }
                  {fastFoodCount > 0 ? ` Fast food was consumed ${fastFoodCount} times — encourage home-cooked alternatives.` : ' No fast food logged — good adherence to meal plan.'}
                  {' '}Consistent with Beatrix Mercado's nutrition plan recommendations to reduce saturated fat and increase fiber intake.
                </Text>
                <View style={styles.aiStats}>
                  <View style={styles.aiStat}>
                    <Text style={styles.aiStatNum}>{healthyCount}</Text>
                    <Text style={styles.aiStatLabel}>Healthy</Text>
                  </View>
                  <View style={styles.aiStatDivider} />
                  <View style={styles.aiStat}>
                    <Text style={[styles.aiStatNum, { color: '#C8524A' }]}>{unhealthyCount}</Text>
                    <Text style={styles.aiStatLabel}>Unhealthy</Text>
                  </View>
                  <View style={styles.aiStatDivider} />
                  <View style={styles.aiStat}>
                    <Text style={[styles.aiStatNum, { color: '#B5720A' }]}>{fastFoodCount}</Text>
                    <Text style={styles.aiStatLabel}>Fast Food</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.sectionLabel}>Recent Meals</Text>
              {foodLogs.length === 0 ? (
                <View style={styles.emptyCard}><Text style={styles.emptyText}>No food logs yet.</Text></View>
              ) : (
                foodLogs.map(log => (
                  <View key={log.id} style={styles.logCard}>
                    <View style={styles.logTop}>
                      <Text style={styles.logMealType}>{log.meal_type}</Text>
                      <View style={[
                        styles.healthBadge,
                        log.health_flag === 'healthy' ? styles.healthBadgeGood :
                        log.health_flag === 'unhealthy' ? styles.healthBadgeBad : styles.healthBadgeMod
                      ]}>
                        <Text style={styles.healthBadgeText}>
                          {log.health_flag === 'healthy' ? '✅ Healthy' : log.health_flag === 'unhealthy' ? '⚠️ Unhealthy' : '📝 Moderate'}
                        </Text>
                      </View>
                      <Text style={styles.logDate}>{formatDate(log.log_date)}</Text>
                    </View>
                    <Text style={styles.logDesc}>{log.description}</Text>
                    {log.ai_notes && <Text style={styles.aiNote}>{log.ai_notes}</Text>}
                    <View style={styles.logTags}>
                      {log.is_fast_food && <View style={styles.logTag}><Text style={styles.logTagText}>🍔 Fast food</Text></View>}
                      {log.cooking_method && <View style={styles.logTag}><Text style={styles.logTagText}>{log.cooking_method}</Text></View>}
                      {log.oil_type && <View style={styles.logTag}><Text style={styles.logTagText}>{log.oil_type}</Text></View>}
                    </View>
                    {(log.protein_g || log.carbs_g || log.fat_g || log.fiber_g) && (
                      <View style={styles.macroRow}>
                        {log.protein_g != null && <Text style={styles.macro}>P: {log.protein_g}g</Text>}
                        {log.carbs_g != null && <Text style={styles.macro}>C: {log.carbs_g}g</Text>}
                        {log.fat_g != null && <Text style={styles.macro}>F: {log.fat_g}g</Text>}
                        {log.fiber_g != null && <Text style={styles.macro}>Fib: {log.fiber_g}g</Text>}
                      </View>
                    )}
                  </View>
                ))
              )}
            </>
          )}

          {/* SLEEP TAB */}
          {activeTab === 'Sleep' && (
            <>
              {avgSleep && (
                <View style={[styles.aiCard, { borderLeftColor: '#9B59B6' }]}>
                  <Text style={styles.aiCardTitle}>💜 Sleep Analysis</Text>
                  <Text style={styles.aiCardText}>
                    Average sleep over the last {sleepLogs.length} logged nights is {avgSleep} hours.
                    {parseFloat(avgSleep) >= 7
                      ? ` ${patientName.split(' ')[0]} is getting adequate sleep — ${goodSleepDays} of ${sleepLogs.length} nights met the 7-hour target.`
                      : ` Sleep is below the 7-hour target. Only ${goodSleepDays} of ${sleepLogs.length} nights met the goal. Poor sleep can worsen lipid levels and hormonal balance.`
                    }
                  </Text>
                  <View style={styles.aiStats}>
                    <View style={styles.aiStat}>
                      <Text style={styles.aiStatNum}>{avgSleep}h</Text>
                      <Text style={styles.aiStatLabel}>Average</Text>
                    </View>
                    <View style={styles.aiStatDivider} />
                    <View style={styles.aiStat}>
                      <Text style={[styles.aiStatNum, { color: '#3D7A5E' }]}>{goodSleepDays}</Text>
                      <Text style={styles.aiStatLabel}>≥7h nights</Text>
                    </View>
                    <View style={styles.aiStatDivider} />
                    <View style={styles.aiStat}>
                      <Text style={[styles.aiStatNum, { color: '#C8524A' }]}>{sleepLogs.length - goodSleepDays}</Text>
                      <Text style={styles.aiStatLabel}>{'<'}7h nights</Text>
                    </View>
                  </View>
                </View>
              )}

              <Text style={styles.sectionLabel}>Sleep History</Text>
              {sleepLogs.length === 0 ? (
                <View style={styles.emptyCard}><Text style={styles.emptyText}>No sleep logs yet.</Text></View>
              ) : (
                sleepLogs.map(log => (
                  <View key={log.id} style={styles.logCard}>
                    <View style={styles.logTop}>
                      <Text style={styles.logDate}>{formatDate(log.log_date)}</Text>
                      <Text style={[styles.logMealType, { color: log.hours_slept >= 7 ? '#3D7A5E' : '#C8524A' }]}>
                        {log.hours_slept} hrs
                      </Text>
                      <Text style={styles.logDate}>{QUALITY_LABELS[log.quality_rating]}</Text>
                    </View>
                    <View style={styles.sleepBar}>
                      <View style={[styles.sleepBarFill, {
                        width: `${Math.min((log.hours_slept / 9) * 100, 100)}%`,
                        backgroundColor: log.hours_slept >= 7 ? '#3D7A5E' : '#C8524A',
                      }]} />
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          {/* WORKOUTS TAB */}
          {activeTab === 'Workouts' && (
            <>
              {totalWorkouts > 0 && (
                <View style={[styles.aiCard, { borderLeftColor: '#2C5FAB' }]}>
                  <Text style={styles.aiCardTitle}>💪 Activity Analysis</Text>
                  <Text style={styles.aiCardText}>
                    {patientName.split(' ')[0]} has logged {totalWorkouts} workouts totaling {totalMinutes} minutes of activity.
                    {totalWorkouts >= 8
                      ? ' Workout frequency is good — meeting the recommended 3x/week target set by Jesse Virata.'
                      : ' Workout frequency is below the 3x/week target. Encourage consistent exercise to support cardiovascular health and lipid management.'
                    }
                  </Text>
                  <View style={styles.aiStats}>
                    <View style={styles.aiStat}>
                      <Text style={styles.aiStatNum}>{totalWorkouts}</Text>
                      <Text style={styles.aiStatLabel}>Sessions</Text>
                    </View>
                    <View style={styles.aiStatDivider} />
                    <View style={styles.aiStat}>
                      <Text style={styles.aiStatNum}>{totalMinutes}</Text>
                      <Text style={styles.aiStatLabel}>Total mins</Text>
                    </View>
                    <View style={styles.aiStatDivider} />
                    <View style={styles.aiStat}>
                      <Text style={styles.aiStatNum}>{totalWorkouts > 0 ? Math.round(totalMinutes / totalWorkouts) : 0}</Text>
                      <Text style={styles.aiStatLabel}>Avg mins</Text>
                    </View>
                  </View>
                </View>
              )}

              <Text style={styles.sectionLabel}>Activity History</Text>
              {activityLogs.length === 0 ? (
                <View style={styles.emptyCard}><Text style={styles.emptyText}>No workouts logged yet.</Text></View>
              ) : (
                activityLogs.map(log => (
                  <View key={log.id} style={styles.logCard}>
                    <View style={styles.logTop}>
                      <Text style={styles.logMealType}>{log.activity_type}</Text>
                      <Text style={styles.logDate}>{log.duration_minutes} min · {formatDate(log.log_date)}</Text>
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          {/* NUTRITION PLAN TAB */}
          {activeTab === 'Nutrition Plan' && (
            <>
              <View style={[styles.aiCard, { borderLeftColor: '#B5720A' }]}>
                <Text style={styles.aiCardTitle}>🥗 Nutrition Plan</Text>
                <Text style={styles.aiCardText}>Prescribed by {NUTRITION_PLAN.provider} on {NUTRITION_PLAN.date}</Text>
                <Text style={[styles.aiCardText, { marginTop: 6 }]}>{NUTRITION_PLAN.notes}</Text>
              </View>

              <Text style={styles.sectionLabel}>Goals</Text>
              <View style={styles.goalsCard}>
                {NUTRITION_PLAN.goals.map((goal, i) => (
                  <View key={i} style={styles.goalItem}>
                    <View style={styles.goalDot} />
                    <Text style={styles.goalText}>{goal}</Text>
                  </View>
                ))}
              </View>

              {/* Adherence check */}
              <Text style={styles.sectionLabel}>Adherence Check</Text>
              <View style={styles.adherenceCard}>
                <Text style={styles.adherenceTitle}>Based on recent food logs:</Text>
                <View style={styles.adherenceItem}>
                  <Text style={styles.adherenceIcon}>{fastFoodCount === 0 ? '✅' : '⚠️'}</Text>
                  <Text style={styles.adherenceText}>
                    Fast food: {fastFoodCount === 0 ? 'None logged — excellent' : `${fastFoodCount} instances — needs improvement`}
                  </Text>
                </View>
                <View style={styles.adherenceItem}>
                  <Text style={styles.adherenceIcon}>{healthyCount > unhealthyCount ? '✅' : '⚠️'}</Text>
                  <Text style={styles.adherenceText}>
                    Meal quality: {healthyCount} healthy vs {unhealthyCount} unhealthy meals
                  </Text>
                </View>
                <View style={styles.adherenceItem}>
                  <Text style={styles.adherenceIcon}>📊</Text>
                  <Text style={styles.adherenceText}>
                    {totalFoodLogs} total meals logged — {totalFoodLogs >= 20 ? 'good tracking consistency' : 'encourage more consistent logging'}
                  </Text>
                </View>
              </View>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F4' },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4DC',
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 13, color: '#6B4FA0', fontWeight: '600' },
  title: { fontFamily: 'serif', fontSize: 20, color: '#1A1A2E', marginBottom: 2 },
  subtitle: { fontSize: 12, color: '#7A7A9A', marginBottom: 12 },
  tabScroll: { marginHorizontal: -16 },
  tabContent: { paddingHorizontal: 16, gap: 4, paddingBottom: 0 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#6B4FA0' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#7A7A9A' },
  tabTextActive: { color: '#6B4FA0' },
  content: { flex: 1, padding: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#7A7A9A', marginBottom: 10, marginTop: 4 },

  // AI Card
  aiCard: {
    backgroundColor: '#F3EFFA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#6B4FA0',
  },
  aiCardTitle: { fontSize: 13, fontWeight: '700', color: '#4A2F7A', marginBottom: 8 },
  aiCardText: { fontSize: 12, color: '#4A3A6A', lineHeight: 19 },
  aiStats: { flexDirection: 'row', marginTop: 14, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 10, padding: 12 },
  aiStat: { flex: 1, alignItems: 'center' },
  aiStatNum: { fontSize: 20, fontWeight: '700', color: '#3D7A5E', marginBottom: 2 },
  aiStatLabel: { fontSize: 10, color: '#7A7A9A', textTransform: 'uppercase', letterSpacing: 0.5 },
  aiStatDivider: { width: 1, backgroundColor: '#E8E4DC', marginHorizontal: 8 },

  // Log cards
  logCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E8E4DC' },
  logTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  logMealType: { fontSize: 11, fontWeight: '700', color: '#7A7A9A', textTransform: 'uppercase' },
  logDate: { fontSize: 11, color: '#7A7A9A', marginLeft: 'auto' },
  logDesc: { fontSize: 13, color: '#1A1A2E', lineHeight: 19, marginBottom: 6 },
  aiNote: { fontSize: 12, color: '#3D7A5E', fontStyle: 'italic', lineHeight: 17, marginBottom: 6 },
  logTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 4 },
  logTag: { backgroundColor: '#F4F2EE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  logTagText: { fontSize: 10, color: '#7A7A9A' },
  macroRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  macro: { fontSize: 11, color: '#7A7A9A', fontWeight: '600' },
  healthBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  healthBadgeGood: { backgroundColor: '#EAF4EE' },
  healthBadgeBad: { backgroundColor: '#FCEEED' },
  healthBadgeMod: { backgroundColor: '#FDF3E3' },
  healthBadgeText: { fontSize: 10, fontWeight: '600', color: '#1A1A2E' },

  // Sleep
  sleepBar: { height: 6, backgroundColor: '#E8E4DC', borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  sleepBarFill: { height: '100%', borderRadius: 3 },

  // Nutrition
  goalsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E8E4DC' },
  goalItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  goalDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#B5720A', marginTop: 6 },
  goalText: { fontSize: 13, color: '#4A4A6A', flex: 1, lineHeight: 20 },
  adherenceCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E8E4DC' },
  adherenceTitle: { fontSize: 12, fontWeight: '700', color: '#1A1A2E', marginBottom: 12 },
  adherenceItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  adherenceIcon: { fontSize: 14 },
  adherenceText: { fontSize: 13, color: '#4A4A6A', flex: 1, lineHeight: 19 },
  emptyCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#E8E4DC', alignItems: 'center' },
  emptyText: { fontSize: 12, color: '#7A7A9A', fontStyle: 'italic' },
})