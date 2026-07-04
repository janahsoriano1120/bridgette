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
  Image,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import Icon from '../../components/Icon'
import { analyzeMeal, MealAnalysis } from '../../lib/analyzeMeal'

const ACTIVITIES = [
  'Pilates',
  'Treadmill',
  'Yoga',
  'Strength Training',
  'Swimming',
  'Cycling',
  'Walking',
  'HIIT',
  'Dance',
  'Sports',
]

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack']

const COOKING_METHODS = ['Fried', 'Grilled', 'Roasted', 'Steamed', 'Boiled', 'Raw']

const OIL_TYPES = ['Palm oil', 'Coconut oil', 'Olive oil', 'Lard', 'Butter', 'None']

const MEAT_TYPES = ['Fresh', 'Frozen', 'Processed', 'No meat']

const QUALITY_LABELS: Record<number, string> = {
  1: 'Very poor',
  2: 'Poor',
  3: 'Okay',
  4: 'Good',
  5: 'Great',
}

const PREMIUM_PLANS = ['premium', 'couple', 'family']

type Tab = 'food' | 'sleep' | 'workout'

type FoodEntry = {
  id: string
  meal_type: string
  description: string
  cooking_method: string
  oil_type: string
  meat_type: string
  is_fast_food: boolean
  photo_url: string | null
  health_flag: string | null
  created_at: string
  log_date: string
}

type SleepEntry = {
  id: string
  hours_slept: number
  quality_rating: number
  log_date: string
}

type ActivityEntry = {
  id: string
  activity_type: string
  duration_minutes: number
  log_date: string
}

export default function LifestyleScreen({ onBack }: { onBack: () => void }) {
  const session = useAuthStore((state) => state.session)
  const [activeTab, setActiveTab] = useState<Tab>('food')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [plan, setPlan] = useState('free')

  // Food state
  const [mealType, setMealType] = useState('Breakfast')
  const [foodDescription, setFoodDescription] = useState('')
  const [cookingMethod, setCookingMethod] = useState('')
  const [oilType, setOilType] = useState('')
  const [meatType, setMeatType] = useState('')
  const [isFastFood, setIsFastFood] = useState(false)
  const [mealPhoto, setMealPhoto] = useState<string | null>(null)
  const [foodLoading, setFoodLoading] = useState(false)
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([])
  const [editingFood, setEditingFood] = useState<FoodEntry | null>(null)
  const [mealAnalysis, setMealAnalysis] = useState<MealAnalysis | null>(null)

  // Sleep state
  const [hoursSlept, setHoursSlept] = useState('7')
  const [sleepQuality, setSleepQuality] = useState(3)
  const [sleepLoading, setSleepLoading] = useState(false)
  const [sleepEntries, setSleepEntries] = useState<SleepEntry[]>([])
  const [editingSleep, setEditingSleep] = useState<SleepEntry | null>(null)

  // Workout state
  const [selectedActivity, setSelectedActivity] = useState('')
  const [duration, setDuration] = useState('30')
  const [workoutLoading, setWorkoutLoading] = useState(false)
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([])
  const [editingActivity, setEditingActivity] = useState<ActivityEntry | null>(null)

  useEffect(() => {
    fetchPlan()
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [selectedDate])

  async function fetchPlan() {
    const userId = session?.user.id
    if (!userId) return
    const { data } = await supabase.from('profiles').select('plan').eq('id', userId).single()
    if (data?.plan) setPlan(data.plan)
  }

  async function fetchEntries() {
    const userId = session?.user.id
    if (!userId) return

    const [foodRes, sleepRes, activityRes] = await Promise.all([
      supabase.from('food_logs').select('*').eq('patient_id', userId).eq('log_date', selectedDate).order('created_at', { ascending: false }),
      supabase.from('sleep_logs').select('*').eq('patient_id', userId).eq('log_date', selectedDate),
      supabase.from('activity_logs').select('*').eq('patient_id', userId).eq('log_date', selectedDate),
    ])

    if (foodRes.data) setFoodEntries(foodRes.data)
    if (sleepRes.data) setSleepEntries(sleepRes.data)
    if (activityRes.data) setActivityEntries(activityRes.data)
  }

  function changeDate(days: number) {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  function formatDisplayDate(date: string) {
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    if (date === today) return 'Today'
    if (date === yesterday) return 'Yesterday'
    const d = new Date(date)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  async function pickMealPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    })
    if (!result.canceled) setMealPhoto(result.assets[0].uri)
  }

  async function takeMealPhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 })
    if (!result.canceled) setMealPhoto(result.assets[0].uri)
  }

  function handleFastFood() {
    setIsFastFood(true)
    setCookingMethod('Fried')
    setOilType('Palm oil')
    setMeatType('Processed')
  }

  async function handleFoodLog() {
    if (!foodDescription.trim()) {
      Alert.alert('Please describe what you ate')
      return
    }
    setFoodLoading(true)
    const wasEditing = !!editingFood
    const mealText = foodDescription
    try {
      let photoUrl = null

      if (mealPhoto) {
        const userId = session?.user.id!
        const filePath = `${userId}/meals/${Date.now()}.jpg`
        const response = await fetch(mealPhoto)
        const blob = await response.blob()
        const { error: uploadError } = await supabase.storage
          .from('medical-records')
          .upload(filePath, blob, { contentType: 'image/jpeg' })
        if (!uploadError) photoUrl = filePath
      }

      const insertData = {
        patient_id: session?.user.id,
        log_date: selectedDate,
        meal_type: mealType,
        description: foodDescription,
        cooking_method: cookingMethod || null,
        oil_type: oilType || null,
        meat_type: meatType || null,
        is_fast_food: isFastFood,
        photo_url: photoUrl,
        health_flag: null,
        quality: null,
      }

      let rowId = editingFood?.id ?? null
      if (editingFood) {
        const { error } = await supabase.from('food_logs').update(insertData).eq('id', editingFood.id)
        if (error) { Alert.alert('Update failed', error.message); return }
        setEditingFood(null)
      } else {
        const { data, error } = await supabase.from('food_logs').insert(insertData).select().single()
        if (error) { Alert.alert('Save failed', error.message); return }
        rowId = data.id
      }

      // Clear the form
      setFoodDescription('')
      setCookingMethod('')
      setOilType('')
      setMeatType('')
      setIsFastFood(false)
      setMealPhoto(null)
      await fetchEntries()

      // Per-food AI analysis: Premium plans only, runs server-side
      const isPremium = PREMIUM_PLANS.includes(plan)
      if (isPremium && rowId) {
        try {
          const analysis = await analyzeMeal(mealText, '') // context: optional doctor note, wired later
          setMealAnalysis(analysis)
          const quality = analysis.flag === 'moderate' ? 'okay' : analysis.flag
          await supabase.from('food_logs').update({ health_flag: analysis.flag, quality }).eq('id', rowId)
          await fetchEntries()
        } catch (e) {
          console.log('Meal analysis skipped:', e)
        }
      }

      Alert.alert(
        wasEditing ? 'Updated!' : 'Logged!',
        PREMIUM_PLANS.includes(plan) ? 'Meal saved. Your insight is ready below.' : 'Meal saved.'
      )
    } catch (e) {
      Alert.alert('Error', 'Could not save meal.')
      console.log(e)
    } finally {
      setFoodLoading(false)
    }
  }

  function startEditFood(entry: FoodEntry) {
    setEditingFood(entry)
    setMealType(entry.meal_type)
    setFoodDescription(entry.description)
    setCookingMethod(entry.cooking_method || '')
    setOilType(entry.oil_type || '')
    setMeatType(entry.meat_type || '')
    setIsFastFood(entry.is_fast_food || false)
  }

  async function deleteFood(id: string) {
    Alert.alert('Delete entry?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('food_logs').delete().eq('id', id)
        fetchEntries()
      }},
    ])
  }

  async function handleSleepLog() {
    const hours = parseFloat(hoursSlept)
    if (isNaN(hours) || hours < 0 || hours > 24) {
      Alert.alert('Please enter valid hours')
      return
    }
    setSleepLoading(true)
    try {
      if (editingSleep) {
        await supabase.from('sleep_logs').update({ hours_slept: hours, quality_rating: sleepQuality }).eq('id', editingSleep.id)
        setEditingSleep(null)
      } else {
        await supabase.from('sleep_logs').insert({
          patient_id: session?.user.id,
          log_date: selectedDate,
          hours_slept: hours,
          quality_rating: sleepQuality,
        })
      }
      await fetchEntries()
      Alert.alert(editingSleep ? 'Updated!' : 'Logged!', `${hours} hours, ${QUALITY_LABELS[sleepQuality]}`)
    } catch (e) {
      Alert.alert('Error', 'Could not save sleep log.')
    } finally {
      setSleepLoading(false)
    }
  }

  async function deleteSleep(id: string) {
    Alert.alert('Delete entry?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('sleep_logs').delete().eq('id', id)
        fetchEntries()
      }},
    ])
  }

  async function handleWorkoutLog() {
    if (!selectedActivity) {
      Alert.alert('Please select an activity')
      return
    }
    const mins = parseInt(duration)
    if (isNaN(mins) || mins < 1) {
      Alert.alert('Please enter a valid duration')
      return
    }
    setWorkoutLoading(true)
    try {
      if (editingActivity) {
        await supabase.from('activity_logs').update({ activity_type: selectedActivity, duration_minutes: mins }).eq('id', editingActivity.id)
        setEditingActivity(null)
      } else {
        await supabase.from('activity_logs').insert({
          patient_id: session?.user.id,
          log_date: selectedDate,
          activity_type: selectedActivity,
          duration_minutes: mins,
        })
      }
      setSelectedActivity('')
      setDuration('30')
      await fetchEntries()
      Alert.alert(editingActivity ? 'Updated!' : 'Logged!', `${selectedActivity}, ${mins} minutes`)
    } catch (e) {
      Alert.alert('Error', 'Could not save workout.')
    } finally {
      setWorkoutLoading(false)
    }
  }

  async function deleteActivity(id: string) {
    Alert.alert('Delete entry?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('activity_logs').delete().eq('id', id)
        fetchEntries()
      }},
    ])
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  function AnalysisCard({ a }: { a: MealAnalysis }) {
    return (
      <Animated.View entering={FadeInDown} style={styles.insightCard}>
        <View style={styles.insightHead}>
          <View style={styles.insightHeadLeft}>
            <Icon name="insight" size={18} color="#C4611A" />
            <Text style={styles.insightTitle}>Meal Insight</Text>
          </View>
          <TouchableOpacity onPress={() => setMealAnalysis(null)}>
            <Icon name="close" size={18} color="#8A7E72" />
          </TouchableOpacity>
        </View>
        <Text style={styles.insightMeal}>{a.meal}</Text>

        <View style={styles.insightSection}>
          <View style={styles.insightLabelRow}>
            <View style={[styles.insightDot, { backgroundColor: '#5C7340' }]} />
            <Text style={styles.insightLabel}>What's working</Text>
          </View>
          <View style={[styles.insightBox, { backgroundColor: '#EBEFE3' }]}>
            {a.working.map((w, i) => <Text key={i} style={[styles.insightText, { color: '#3F4A30' }]}>{w}</Text>)}
          </View>
        </View>

        <View style={styles.insightSection}>
          <View style={styles.insightLabelRow}>
            <View style={[styles.insightDot, { backgroundColor: '#C4922A' }]} />
            <Text style={styles.insightLabel}>Worth noting</Text>
          </View>
          <View style={[styles.insightBox, { backgroundColor: '#F6EDDA' }]}>
            {a.noting.map((n, i) => <Text key={i} style={[styles.insightText, { color: '#5A4A22' }]}>{n}</Text>)}
          </View>
        </View>

        <View style={styles.insightSection}>
          <View style={styles.insightLabelRow}>
            <View style={[styles.insightDot, { backgroundColor: '#C4611A' }]} />
            <Text style={styles.insightLabel}>A small swap</Text>
          </View>
          <View style={[styles.insightBox, { backgroundColor: '#F6E8DD' }]}>
            <Text style={[styles.insightText, { color: '#5A3418' }]}>{a.swap}</Text>
          </View>
        </View>

        <View style={styles.insightSection}>
          <View style={styles.insightLabelRow}>
            <View style={[styles.insightDot, { backgroundColor: '#7B4B94' }]} />
            <Text style={styles.insightLabel}>Worth asking your doctor</Text>
          </View>
          <View style={[styles.insightBox, { backgroundColor: '#EFE7F2' }]}>
            <Text style={[styles.insightText, { color: '#4A2E58' }]}>{a.askDoctor}</Text>
          </View>
        </View>

        <Text style={styles.insightFooter}>
          General wellness information, not medical advice. Your doctor knows your full picture.
        </Text>
      </Animated.View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <View style={styles.backRow}>
            <Icon name="back" size={18} color="#5C7340" />
            <Text style={styles.backText}>Back</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>Lifestyle Log</Text>
        <View style={styles.datePicker}>
          <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateArrow}>
            <Icon name="back" size={22} color="#5C7340" />
          </TouchableOpacity>
          <Text style={styles.dateLabel}>{formatDisplayDate(selectedDate)}</Text>
          <TouchableOpacity
            onPress={() => changeDate(1)}
            style={styles.dateArrow}
            disabled={selectedDate >= new Date().toISOString().split('T')[0]}
          >
            <View style={selectedDate >= new Date().toISOString().split('T')[0] ? { opacity: 0.3 } : undefined}>
              <Icon name="forward" size={22} color="#5C7340" />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabBar}>
        {(['food', 'sleep', 'workout'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <View style={styles.tabInner}>
              <Icon
                name={tab === 'food' ? 'diet' : tab === 'sleep' ? 'sleep' : 'trainer'}
                size={15}
                color={activeTab === tab ? '#5C7340' : '#8A7E72'}
              />
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'food' ? 'Food' : tab === 'sleep' ? 'Sleep' : 'Workout'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>

        {activeTab === 'food' && (
          <View>
            {mealAnalysis && (
              <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                <AnalysisCard a={mealAnalysis} />
              </View>
            )}

            {foodEntries.length > 0 && (
              <View style={styles.entriesSection}>
                <Text style={styles.entriesLabel}>{formatDisplayDate(selectedDate)}'s Meals</Text>
                {foodEntries.map((entry, index) => (
                  <Animated.View key={entry.id} entering={FadeInDown.delay(index * 50)} style={styles.entryCard}>
                    {entry.photo_url && (
                      <View style={styles.entryPhotoBar}>
                        <View style={styles.photoBarLeft}>
                          <Icon name="photo" size={14} color="#8A7E72" />
                          <Text style={styles.entryPhotoText}>Photo attached</Text>
                        </View>
                        <Text style={styles.entryTimestamp}>{formatTime(entry.created_at)}</Text>
                      </View>
                    )}
                    <View style={styles.entryMain}>
                      <View style={styles.entryInfo}>
                        <View style={styles.entryTopRow}>
                          <Text style={styles.entryMealType}>{entry.meal_type}</Text>
                          {entry.health_flag && (
                            <View style={[
                              styles.healthFlag,
                              entry.health_flag === 'healthy' ? styles.flagHealthy :
                              entry.health_flag === 'unhealthy' ? styles.flagUnhealthy :
                              styles.flagModerate
                            ]}>
                              <Icon
                                name={entry.health_flag === 'healthy' ? 'ok' : entry.health_flag === 'unhealthy' ? 'flagged' : 'notes'}
                                size={12}
                                color={entry.health_flag === 'healthy' ? '#5C7340' : entry.health_flag === 'unhealthy' ? '#B5451B' : '#C4922A'}
                              />
                            </View>
                          )}
                        </View>
                        <Text style={styles.entryDesc}>{entry.description}</Text>
                        <View style={styles.entryTags}>
                          {entry.is_fast_food && <Text style={styles.entryTag}>Fast food</Text>}
                          {entry.cooking_method ? <Text style={styles.entryTag}>{entry.cooking_method}</Text> : null}
                          {entry.oil_type ? <Text style={styles.entryTag}>{entry.oil_type}</Text> : null}
                          {entry.meat_type ? <Text style={styles.entryTag}>{entry.meat_type}</Text> : null}
                        </View>
                        <Text style={styles.entryTime}>{formatTime(entry.created_at)}</Text>
                      </View>
                      <View style={styles.entryActions}>
                        <TouchableOpacity onPress={() => startEditFood(entry)} style={styles.actionBtn}>
                          <Icon name="edit" size={16} color="#8A7E72" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteFood(entry.id)} style={styles.actionBtn}>
                          <Icon name="delete" size={16} color="#B5451B" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Animated.View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{editingFood ? 'Edit Meal' : 'Log a Meal'}</Text>

              <TouchableOpacity
                style={[styles.fastFoodBtn, isFastFood && styles.fastFoodBtnActive]}
                onPress={() => {
                  if (isFastFood) {
                    setIsFastFood(false)
                    setCookingMethod('')
                    setOilType('')
                    setMeatType('')
                  } else {
                    handleFastFood()
                  }
                }}
              >
                <View style={styles.fastFoodInner}>
                  {isFastFood && <Icon name="ok" size={16} color="#fff" />}
                  <Text style={[styles.fastFoodBtnText, isFastFood && { color: '#fff' }]}>
                    {isFastFood ? 'Fast Food Selected' : 'I ate fast food'}
                  </Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Meal Type</Text>
              <View style={styles.chipRow}>
                {MEAL_TYPES.map((type) => (
                  <TouchableOpacity key={type} style={[styles.chip, mealType === type && styles.chipActive]} onPress={() => setMealType(type)}>
                    <Text style={[styles.chipText, mealType === type && styles.chipTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>What did you eat?</Text>
              <TextInput
                style={styles.textArea}
                placeholder="e.g. Sinangag, fried egg, hotdog..."
                placeholderTextColor="#A89E90"
                value={foodDescription}
                onChangeText={setFoodDescription}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.fieldLabel}>Cooking Method</Text>
              <View style={styles.chipRow}>
                {COOKING_METHODS.map((m) => (
                  <TouchableOpacity key={m} style={[styles.chip, cookingMethod === m && styles.chipActive]} onPress={() => setCookingMethod(m)}>
                    <Text style={[styles.chipText, cookingMethod === m && styles.chipTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Oil / Fat Used</Text>
              <View style={styles.chipRow}>
                {OIL_TYPES.map((oil) => (
                  <TouchableOpacity key={oil} style={[styles.chip, oilType === oil && styles.chipActive]} onPress={() => setOilType(oil)}>
                    <Text style={[styles.chipText, oilType === oil && styles.chipTextActive]}>{oil}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Meat / Protein</Text>
              <View style={styles.chipRow}>
                {MEAT_TYPES.map((m) => (
                  <TouchableOpacity key={m} style={[styles.chip, meatType === m && styles.chipActive]} onPress={() => setMeatType(m)}>
                    <Text style={[styles.chipText, meatType === m && styles.chipTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Meal Photo (optional)</Text>
              <View style={styles.photoRow}>
                <TouchableOpacity style={styles.photoBtn} onPress={takeMealPhoto}>
                  <View style={styles.photoBtnInner}>
                    <Icon name="camera" size={16} color="#5C7340" />
                    <Text style={styles.photoBtnText}>Camera</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoBtn} onPress={pickMealPhoto}>
                  <View style={styles.photoBtnInner}>
                    <Icon name="photo" size={16} color="#5C7340" />
                    <Text style={styles.photoBtnText}>Library</Text>
                  </View>
                </TouchableOpacity>
              </View>
              {mealPhoto && (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: mealPhoto }} style={styles.previewImage} />
                  <Text style={styles.photoTimestamp}>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
                  <TouchableOpacity onPress={() => setMealPhoto(null)} style={styles.removePhoto}>
                    <View style={styles.removeInner}>
                      <Icon name="close" size={14} color="#B5451B" />
                      <Text style={styles.removePhotoText}>Remove</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {editingFood && (
                <TouchableOpacity style={styles.cancelBtn} onPress={() => {
                  setEditingFood(null)
                  setFoodDescription('')
                  setCookingMethod('')
                  setOilType('')
                  setMeatType('')
                  setIsFastFood(false)
                  setMealPhoto(null)
                }}>
                  <Text style={styles.cancelBtnText}>Cancel Edit</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[styles.logBtn, foodLoading && styles.logBtnDisabled]} onPress={handleFoodLog} disabled={foodLoading}>
                {foodLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.logBtnText}>{PREMIUM_PLANS.includes(plan) ? 'Analyzing...' : 'Saving...'}</Text>
                  </View>
                ) : (
                  <Text style={styles.logBtnText}>{editingFood ? 'Save Changes' : 'Log This Meal'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'sleep' && (
          <View>
            {sleepEntries.length > 0 && (
              <View style={styles.entriesSection}>
                <Text style={styles.entriesLabel}>{formatDisplayDate(selectedDate)}'s Sleep</Text>
                {sleepEntries.map((entry, index) => (
                  <Animated.View key={entry.id} entering={FadeInDown.delay(index * 50)} style={styles.entryCard}>
                    <View style={styles.entryMain}>
                      <View style={styles.entryInfo}>
                        <Text style={styles.entryDesc}>{entry.hours_slept} hours, {QUALITY_LABELS[entry.quality_rating]}</Text>
                        <View style={styles.sleepBarSmall}>
                          <View style={[styles.sleepBarFillSmall, {
                            width: `${Math.min((entry.hours_slept / 9) * 100, 100)}%`,
                            backgroundColor: entry.hours_slept >= 7 ? '#5C7340' : '#C4922A',
                          }]} />
                        </View>
                      </View>
                      <View style={styles.entryActions}>
                        <TouchableOpacity onPress={() => {
                          setEditingSleep(entry)
                          setHoursSlept(String(entry.hours_slept))
                          setSleepQuality(entry.quality_rating)
                        }} style={styles.actionBtn}>
                          <Icon name="edit" size={16} color="#8A7E72" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteSleep(entry.id)} style={styles.actionBtn}>
                          <Icon name="delete" size={16} color="#B5451B" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Animated.View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{editingSleep ? 'Edit Sleep' : 'Log Sleep'}</Text>

              <Text style={styles.fieldLabel}>Hours slept</Text>
              <TextInput
                style={styles.input}
                value={hoursSlept}
                onChangeText={setHoursSlept}
                keyboardType="decimal-pad"
                placeholder="e.g. 7.5"
                placeholderTextColor="#A89E90"
              />

              <Text style={styles.fieldLabel}>Sleep quality</Text>
              <View style={styles.qualityRow}>
                {[1, 2, 3, 4, 5].map((q) => (
                  <TouchableOpacity key={q} style={[styles.qualityBtn, sleepQuality === q && styles.qualityBtnActive]} onPress={() => setSleepQuality(q)}>
                    <Text style={[styles.qualityNum, sleepQuality === q && { color: '#fff' }]}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.qualityLabel}>{QUALITY_LABELS[sleepQuality]}</Text>

              <View style={styles.sleepBar}>
                <View style={[styles.sleepBarFill, {
                  width: `${Math.min((parseFloat(hoursSlept) / 9) * 100, 100)}%`,
                  backgroundColor: parseFloat(hoursSlept) >= 7 ? '#5C7340' : parseFloat(hoursSlept) >= 5 ? '#C4922A' : '#B5451B',
                }]} />
                <View style={styles.sleepBarTarget} />
              </View>
              <Text style={styles.sleepBarLabel}>
                Target: 7 to 9 hours, {parseFloat(hoursSlept) >= 7 ? 'on track' : 'below target'}
              </Text>

              {editingSleep && (
                <TouchableOpacity style={styles.cancelBtn} onPress={() => {
                  setEditingSleep(null)
                  setHoursSlept('7')
                  setSleepQuality(3)
                }}>
                  <Text style={styles.cancelBtnText}>Cancel Edit</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[styles.logBtn, sleepLoading && styles.logBtnDisabled]} onPress={handleSleepLog} disabled={sleepLoading}>
                {sleepLoading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.logBtnText}>{editingSleep ? 'Save Changes' : 'Log Sleep'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'workout' && (
          <View>
            {activityEntries.length > 0 && (
              <View style={styles.entriesSection}>
                <Text style={styles.entriesLabel}>{formatDisplayDate(selectedDate)}'s Workouts</Text>
                {activityEntries.map((entry, index) => (
                  <Animated.View key={entry.id} entering={FadeInDown.delay(index * 50)} style={styles.entryCard}>
                    <View style={styles.entryMain}>
                      <View style={styles.entryInfo}>
                        <View style={styles.workoutRow}>
                          <Icon name="trainer" size={15} color="#B5451B" />
                          <Text style={styles.entryDesc}>{entry.activity_type}, {entry.duration_minutes} mins</Text>
                        </View>
                      </View>
                      <View style={styles.entryActions}>
                        <TouchableOpacity onPress={() => {
                          setEditingActivity(entry)
                          setSelectedActivity(entry.activity_type)
                          setDuration(String(entry.duration_minutes))
                        }} style={styles.actionBtn}>
                          <Icon name="edit" size={16} color="#8A7E72" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteActivity(entry.id)} style={styles.actionBtn}>
                          <Icon name="delete" size={16} color="#B5451B" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Animated.View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{editingActivity ? 'Edit Workout' : 'Log Workout'}</Text>

              <Text style={styles.fieldLabel}>Activity type</Text>
              <View style={styles.activityGrid}>
                {ACTIVITIES.map((a) => (
                  <TouchableOpacity key={a} style={[styles.activityBtn, selectedActivity === a && styles.activityBtnActive]} onPress={() => setSelectedActivity(a)}>
                    <Text style={[styles.activityLabel, selectedActivity === a && styles.activityLabelActive]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Duration (minutes)</Text>
              <TextInput
                style={styles.input}
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
                placeholder="e.g. 45"
                placeholderTextColor="#A89E90"
              />

              {editingActivity && (
                <TouchableOpacity style={styles.cancelBtn} onPress={() => {
                  setEditingActivity(null)
                  setSelectedActivity('')
                  setDuration('30')
                }}>
                  <Text style={styles.cancelBtnText}>Cancel Edit</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[styles.logBtn, workoutLoading && styles.logBtnDisabled]} onPress={handleWorkoutLog} disabled={workoutLoading}>
                {workoutLoading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.logBtnText}>{editingActivity ? 'Save Changes' : 'Log Workout'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

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
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 24,
  },
  backBtn: { marginBottom: 8 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 16, color: '#5C7340', fontWeight: '600' },
  title: { fontFamily: 'Georgia', fontSize: 22, color: '#3D3229', marginBottom: 10 },
  datePicker: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateArrow: { padding: 4 },
  dateLabel: { fontSize: 14, fontWeight: '600', color: '#3D3229' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5DFD3',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#5C7340' },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#8A7E72' },
  tabTextActive: { color: '#5C7340' },
  content: { flex: 1 },

  insightCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E5DFD3' },
  insightHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  insightHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insightTitle: { fontFamily: 'Georgia', fontSize: 18, color: '#3D3229' },
  insightMeal: { fontSize: 13, color: '#5A4A38', marginBottom: 14, lineHeight: 19 },
  insightSection: { marginBottom: 12 },
  insightLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  insightDot: { width: 8, height: 8, borderRadius: 4 },
  insightLabel: { fontFamily: 'Georgia', fontSize: 14, color: '#3D3229' },
  insightBox: { borderRadius: 10, padding: 11 },
  insightText: { fontSize: 13, lineHeight: 19, marginBottom: 3 },
  insightFooter: { fontSize: 11, color: '#8A7E72', fontStyle: 'italic', lineHeight: 16, borderTopWidth: 1, borderTopColor: '#E5DFD3', paddingTop: 10, marginTop: 2 },

  entriesSection: { padding: 16, paddingBottom: 0 },
  entriesLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#8A7E72', marginBottom: 10 },
  entryCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5DFD3', overflow: 'hidden' },
  entryPhotoBar: { backgroundColor: '#F0EBE1', padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5DFD3' },
  photoBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entryPhotoText: { fontSize: 12, color: '#8A7E72' },
  entryTimestamp: { fontSize: 11, color: '#8A7E72' },
  entryMain: { flexDirection: 'row', alignItems: 'flex-start', padding: 13, gap: 8 },
  entryInfo: { flex: 1 },
  entryTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  entryMealType: { fontSize: 11, fontWeight: '700', color: '#8A7E72', textTransform: 'uppercase', letterSpacing: 0.5 },
  healthFlag: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  flagHealthy: { backgroundColor: '#EBEFE3' },
  flagModerate: { backgroundColor: '#F6EDDA' },
  flagUnhealthy: { backgroundColor: '#F5E2D8' },
  entryDesc: { fontSize: 13, color: '#3D3229', marginBottom: 5, lineHeight: 18 },
  workoutRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 5 },
  entryTag: { fontSize: 11, color: '#8A7E72', backgroundColor: '#F0EBE1', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  entryTime: { fontSize: 10, color: '#A89E90' },
  entryActions: { flexDirection: 'column', gap: 6 },
  actionBtn: { padding: 6 },
  section: { padding: 20 },
  sectionLabel: { fontFamily: 'Georgia', fontSize: 18, color: '#3D3229', marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#8A7E72', marginBottom: 8, marginTop: 14 },
  fastFoodBtn: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#E5DFD3', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 4 },
  fastFoodBtnActive: { backgroundColor: '#3D3229', borderColor: '#3D3229' },
  fastFoodInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fastFoodBtnText: { fontSize: 15, fontWeight: '700', color: '#3D3229' },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5DFD3' },
  chipActive: { backgroundColor: '#3D3229', borderColor: '#3D3229' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#8A7E72' },
  chipTextActive: { color: '#fff' },
  textArea: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5DFD3', borderRadius: 12, padding: 13, fontSize: 14, color: '#3D3229', minHeight: 80, textAlignVertical: 'top' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5DFD3', borderRadius: 10, padding: 13, fontSize: 15, color: '#3D3229' },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5DFD3', borderRadius: 10, padding: 12, alignItems: 'center' },
  photoBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  photoBtnText: { fontSize: 13, fontWeight: '600', color: '#5C7340' },
  photoPreview: { marginTop: 10, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#E5DFD3' },
  previewImage: { width: '100%', height: 180 },
  photoTimestamp: { fontSize: 11, color: '#8A7E72', padding: 8, backgroundColor: '#F0EBE1' },
  removePhoto: { padding: 8, alignItems: 'center', backgroundColor: '#F5E2D8' },
  removeInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  removePhotoText: { fontSize: 12, color: '#B5451B', fontWeight: '600' },
  cancelBtn: { marginTop: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5DFD3', alignItems: 'center' },
  cancelBtnText: { fontSize: 13, color: '#8A7E72', fontWeight: '600' },
  logBtn: { backgroundColor: '#5C7340', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 14 },
  logBtnDisabled: { opacity: 0.6 },
  logBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  qualityRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  qualityBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5DFD3', alignItems: 'center', justifyContent: 'center' },
  qualityBtnActive: { backgroundColor: '#3D3229', borderColor: '#3D3229' },
  qualityNum: { fontSize: 16, fontWeight: '700', color: '#3D3229' },
  qualityLabel: { fontSize: 13, color: '#8A7E72', marginBottom: 12 },
  sleepBar: { height: 8, backgroundColor: '#E5DFD3', borderRadius: 4, marginBottom: 6, position: 'relative', overflow: 'hidden' },
  sleepBarFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
  sleepBarTarget: { position: 'absolute', left: '77.8%', top: -2, bottom: -2, width: 2, backgroundColor: '#5C7340', opacity: 0.6 },
  sleepBarLabel: { fontSize: 12, color: '#8A7E72', marginBottom: 14 },
  sleepBarSmall: { height: 5, backgroundColor: '#E5DFD3', borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  sleepBarFillSmall: { height: '100%', borderRadius: 3 },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  activityBtn: { width: '30%', backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E5DFD3' },
  activityBtnActive: { backgroundColor: '#3D3229', borderColor: '#3D3229' },
  activityLabel: { fontSize: 12, fontWeight: '600', color: '#8A7E72', textAlign: 'center' },
  activityLabelActive: { color: '#fff' },
})