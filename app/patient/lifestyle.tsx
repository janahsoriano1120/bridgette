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
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

const ACTIVITIES = [
  { label: 'Pilates', emoji: '🧘' },
  { label: 'Treadmill', emoji: '🏃' },
  { label: 'Yoga', emoji: '🌿' },
  { label: 'Strength Training', emoji: '🏋️' },
  { label: 'Swimming', emoji: '🏊' },
  { label: 'Cycling', emoji: '🚴' },
  { label: 'Walking', emoji: '🚶' },
  { label: 'HIIT', emoji: '⚡' },
  { label: 'Dance', emoji: '💃' },
  { label: 'Sports', emoji: '⚽' },
]

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack']

const COOKING_METHODS = [
  { label: 'Fried', emoji: '🍳' },
  { label: 'Grilled', emoji: '🔥' },
  { label: 'Roasted', emoji: '♨️' },
  { label: 'Steamed', emoji: '💨' },
  { label: 'Boiled', emoji: '🫕' },
  { label: 'Raw', emoji: '🥗' },
]

const OIL_TYPES = ['Palm oil', 'Coconut oil', 'Olive oil', 'Lard', 'Butter', 'None']

const MEAT_TYPES = [
  { label: 'Fresh', emoji: '🥩' },
  { label: 'Frozen', emoji: '🧊' },
  { label: 'Processed', emoji: '🌭' },
  { label: 'No meat', emoji: '🥦' },
]

const QUALITY_LABELS: Record<number, string> = {
  1: '😴 Very poor',
  2: '😟 Poor',
  3: '😐 Okay',
  4: '😊 Good',
  5: '😄 Great',
}

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
  health_flag: string
  ai_notes: string | null
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
    fetchEntries()
  }, [selectedDate])

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

      // AI analysis
      let aiNotes: string | null = null
      let healthFlag = 'moderate'
      let analysis: any = null

      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': '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',
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            messages: [{
              role: 'user',
              content: `Meal: "${foodDescription}", Cooking: ${cookingMethod || 'unknown'}, Oil: ${oilType || 'unknown'}, Meat: ${meatType || 'unknown'}, Fast food: ${isFastFood}.
Return ONLY valid JSON with no other text:
{
  "health_flag": "healthy/moderate/unhealthy",
  "ai_notes": "one sentence about lipid or blood sugar impact",
  "protein_g": estimated protein in grams as a number,
  "carbs_g": estimated carbs in grams as a number,
  "fat_g": estimated fat in grams as a number,
  "fiber_g": estimated fiber in grams as a number
}`,
            }],
          }),
        })
        const data = await response.json()
        const text = data.content[0].text.replace(/```json|```/g, '').trim()
        analysis = JSON.parse(text)
        aiNotes = analysis.ai_notes
        healthFlag = analysis.health_flag
      } catch (e) {
        console.log('AI analysis skipped:', e)
        healthFlag = isFastFood ? 'unhealthy' : 'moderate'
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
        health_flag: healthFlag,
        ai_notes: aiNotes,
        protein_g: analysis?.protein_g || null,
        carbs_g: analysis?.carbs_g || null,
        fat_g: analysis?.fat_g || null,
        fiber_g: analysis?.fiber_g || null,
      }

      if (editingFood) {
        const { error } = await supabase.from('food_logs').update(insertData).eq('id', editingFood.id)
        if (error) { Alert.alert('Update failed', error.message); return }
        setEditingFood(null)
      } else {
        const { error } = await supabase.from('food_logs').insert(insertData)
        if (error) { Alert.alert('Save failed', error.message); return }
      }

      setFoodDescription('')
      setCookingMethod('')
      setOilType('')
      setMeatType('')
      setIsFastFood(false)
      setMealPhoto(null)
      await fetchEntries()
      Alert.alert(
        editingFood ? 'Updated!' : 'Logged!',
        aiNotes ?? 'Meal saved successfully.'
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
      Alert.alert(editingSleep ? 'Updated!' : 'Logged!', `${hours} hours · ${QUALITY_LABELS[sleepQuality]}`)
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
      Alert.alert(editingActivity ? 'Updated!' : 'Logged!', `${selectedActivity} · ${mins} minutes 💪`)
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Lifestyle Log</Text>
        <View style={styles.datePicker}>
          <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateArrow}>
            <Text style={styles.dateArrowText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.dateLabel}>{formatDisplayDate(selectedDate)}</Text>
          <TouchableOpacity
            onPress={() => changeDate(1)}
            style={styles.dateArrow}
            disabled={selectedDate >= new Date().toISOString().split('T')[0]}
          >
            <Text style={[styles.dateArrowText, selectedDate >= new Date().toISOString().split('T')[0] && { opacity: 0.3 }]}>›</Text>
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
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'food' ? '🍽 Food' : tab === 'sleep' ? '😴 Sleep' : '🏋️ Workout'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>

        {/* ── FOOD TAB ── */}
        {activeTab === 'food' && (
          <View>
            {foodEntries.length > 0 && (
              <View style={styles.entriesSection}>
                <Text style={styles.entriesLabel}>{formatDisplayDate(selectedDate)}'s Meals</Text>
                {foodEntries.map((entry) => (
                  <View key={entry.id} style={styles.entryCard}>
                    {entry.photo_url && (
                      <View style={styles.entryPhotoBar}>
                        <Text style={styles.entryPhotoText}>📷 Photo attached</Text>
                        <Text style={styles.entryTimestamp}>{formatTime(entry.created_at)}</Text>
                      </View>
                    )}
                    <View style={styles.entryMain}>
                      <View style={styles.entryInfo}>
                        <View style={styles.entryTopRow}>
                          <Text style={styles.entryMealType}>{entry.meal_type}</Text>
                          <View style={[
                            styles.healthFlag,
                            entry.health_flag === 'healthy' ? styles.flagHealthy :
                            entry.health_flag === 'unhealthy' ? styles.flagUnhealthy :
                            styles.flagModerate
                          ]}>
                            <Text style={styles.healthFlagText}>
                              {entry.health_flag === 'healthy' ? '✅' : entry.health_flag === 'unhealthy' ? '⚠️' : '📝'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.entryDesc}>{entry.description}</Text>
                        <View style={styles.entryTags}>
                          {entry.is_fast_food && <Text style={styles.entryTag}>🍔 Fast food</Text>}
                          {entry.cooking_method ? <Text style={styles.entryTag}>{entry.cooking_method}</Text> : null}
                          {entry.oil_type ? <Text style={styles.entryTag}>{entry.oil_type}</Text> : null}
                          {entry.meat_type ? <Text style={styles.entryTag}>{entry.meat_type}</Text> : null}
                        </View>
                        {entry.ai_notes && <Text style={styles.aiNote}>{entry.ai_notes}</Text>}
                        <Text style={styles.entryTime}>{formatTime(entry.created_at)}</Text>
                      </View>
                      <View style={styles.entryActions}>
                        <TouchableOpacity onPress={() => startEditFood(entry)} style={styles.actionBtn}>
                          <Text>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteFood(entry.id)} style={styles.actionBtn}>
                          <Text>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{editingFood ? '✏️ Edit Meal' : '+ Log a Meal'}</Text>

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
                <Text style={[styles.fastFoodBtnText, isFastFood && { color: '#fff' }]}>
                  {isFastFood ? '✓ Fast Food Selected' : '🍔 I ate fast food'}
                </Text>
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
                placeholderTextColor="#999"
                value={foodDescription}
                onChangeText={setFoodDescription}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.fieldLabel}>Cooking Method</Text>
              <View style={styles.chipRow}>
                {COOKING_METHODS.map((m) => (
                  <TouchableOpacity key={m.label} style={[styles.chip, cookingMethod === m.label && styles.chipActive]} onPress={() => setCookingMethod(m.label)}>
                    <Text style={[styles.chipText, cookingMethod === m.label && styles.chipTextActive]}>{m.emoji} {m.label}</Text>
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
                  <TouchableOpacity key={m.label} style={[styles.chip, meatType === m.label && styles.chipActive]} onPress={() => setMeatType(m.label)}>
                    <Text style={[styles.chipText, meatType === m.label && styles.chipTextActive]}>{m.emoji} {m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Meal Photo (optional)</Text>
              <View style={styles.photoRow}>
                <TouchableOpacity style={styles.photoBtn} onPress={takeMealPhoto}>
                  <Text style={styles.photoBtnText}>📷 Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoBtn} onPress={pickMealPhoto}>
                  <Text style={styles.photoBtnText}>🖼 Library</Text>
                </TouchableOpacity>
              </View>
              {mealPhoto && (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: mealPhoto }} style={styles.previewImage} />
                  <Text style={styles.photoTimestamp}>📍 {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
                  <TouchableOpacity onPress={() => setMealPhoto(null)} style={styles.removePhoto}>
                    <Text style={styles.removePhotoText}>✕ Remove</Text>
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
                    <Text style={styles.logBtnText}>Analyzing...</Text>
                  </View>
                ) : (
                  <Text style={styles.logBtnText}>{editingFood ? 'Save Changes' : 'Log This Meal'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── SLEEP TAB ── */}
        {activeTab === 'sleep' && (
          <View>
            {sleepEntries.length > 0 && (
              <View style={styles.entriesSection}>
                <Text style={styles.entriesLabel}>{formatDisplayDate(selectedDate)}'s Sleep</Text>
                {sleepEntries.map((entry) => (
                  <View key={entry.id} style={styles.entryCard}>
                    <View style={styles.entryMain}>
                      <View style={styles.entryInfo}>
                        <Text style={styles.entryDesc}>{entry.hours_slept} hours · {QUALITY_LABELS[entry.quality_rating]}</Text>
                        <View style={styles.sleepBarSmall}>
                          <View style={[styles.sleepBarFillSmall, {
                            width: `${Math.min((entry.hours_slept / 9) * 100, 100)}%`,
                            backgroundColor: entry.hours_slept >= 7 ? '#3D7A5E' : '#B5720A',
                          }]} />
                        </View>
                      </View>
                      <View style={styles.entryActions}>
                        <TouchableOpacity onPress={() => {
                          setEditingSleep(entry)
                          setHoursSlept(String(entry.hours_slept))
                          setSleepQuality(entry.quality_rating)
                        }} style={styles.actionBtn}>
                          <Text>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteSleep(entry.id)} style={styles.actionBtn}>
                          <Text>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{editingSleep ? '✏️ Edit Sleep' : '+ Log Sleep'}</Text>

              <Text style={styles.fieldLabel}>Hours slept</Text>
              <TextInput
                style={styles.input}
                value={hoursSlept}
                onChangeText={setHoursSlept}
                keyboardType="decimal-pad"
                placeholder="e.g. 7.5"
                placeholderTextColor="#999"
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
                  backgroundColor: parseFloat(hoursSlept) >= 7 ? '#3D7A5E' : parseFloat(hoursSlept) >= 5 ? '#B5720A' : '#C8524A',
                }]} />
                <View style={styles.sleepBarTarget} />
              </View>
              <Text style={styles.sleepBarLabel}>
                Target: 7–9 hours · {parseFloat(hoursSlept) >= 7 ? '✅ On track' : '⚠️ Below target'}
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

        {/* ── WORKOUT TAB ── */}
        {activeTab === 'workout' && (
          <View>
            {activityEntries.length > 0 && (
              <View style={styles.entriesSection}>
                <Text style={styles.entriesLabel}>{formatDisplayDate(selectedDate)}'s Workouts</Text>
                {activityEntries.map((entry) => (
                  <View key={entry.id} style={styles.entryCard}>
                    <View style={styles.entryMain}>
                      <View style={styles.entryInfo}>
                        <Text style={styles.entryDesc}>
                          {ACTIVITIES.find(a => a.label === entry.activity_type)?.emoji} {entry.activity_type} · {entry.duration_minutes} mins
                        </Text>
                      </View>
                      <View style={styles.entryActions}>
                        <TouchableOpacity onPress={() => {
                          setEditingActivity(entry)
                          setSelectedActivity(entry.activity_type)
                          setDuration(String(entry.duration_minutes))
                        }} style={styles.actionBtn}>
                          <Text>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteActivity(entry.id)} style={styles.actionBtn}>
                          <Text>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{editingActivity ? '✏️ Edit Workout' : '+ Log Workout'}</Text>

              <Text style={styles.fieldLabel}>Activity type</Text>
              <View style={styles.activityGrid}>
                {ACTIVITIES.map((a) => (
                  <TouchableOpacity key={a.label} style={[styles.activityBtn, selectedActivity === a.label && styles.activityBtnActive]} onPress={() => setSelectedActivity(a.label)}>
                    <Text style={styles.activityEmoji}>{a.emoji}</Text>
                    <Text style={[styles.activityLabel, selectedActivity === a.label && styles.activityLabelActive]}>{a.label}</Text>
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
                placeholderTextColor="#999"
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
  container: { flex: 1, backgroundColor: '#FAF8F4' },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4DC',
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 24,
  },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 16, color: '#C8524A', fontWeight: '600' },
  title: { fontFamily: 'serif', fontSize: 22, color: '#1A1A2E', marginBottom: 10 },
  datePicker: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateArrow: { padding: 4 },
  dateArrowText: { fontSize: 24, color: '#C8524A', fontWeight: '300' },
  dateLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4DC',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#C8524A' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#7A7A9A' },
  tabTextActive: { color: '#C8524A' },
  content: { flex: 1 },
  entriesSection: { padding: 16, paddingBottom: 0 },
  entriesLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#7A7A9A', marginBottom: 10 },
  entryCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E8E4DC', overflow: 'hidden' },
  entryPhotoBar: { backgroundColor: '#F4F2EE', padding: 10, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E8E4DC' },
  entryPhotoText: { fontSize: 12, color: '#7A7A9A' },
  entryTimestamp: { fontSize: 11, color: '#7A7A9A' },
  entryMain: { flexDirection: 'row', alignItems: 'flex-start', padding: 13, gap: 8 },
  entryInfo: { flex: 1 },
  entryTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  entryMealType: { fontSize: 11, fontWeight: '700', color: '#7A7A9A', textTransform: 'uppercase', letterSpacing: 0.5 },
  healthFlag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  flagHealthy: { backgroundColor: '#EAF4EE' },
  flagModerate: { backgroundColor: '#FDF3E3' },
  flagUnhealthy: { backgroundColor: '#FCEEED' },
  healthFlagText: { fontSize: 11 },
  entryDesc: { fontSize: 13, color: '#1A1A2E', marginBottom: 5, lineHeight: 18 },
  entryTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 5 },
  entryTag: { fontSize: 11, color: '#7A7A9A', backgroundColor: '#F4F2EE', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  aiNote: { fontSize: 12, color: '#3D7A5E', fontStyle: 'italic', marginBottom: 4, lineHeight: 17 },
  entryTime: { fontSize: 10, color: '#9A9AAA' },
  entryActions: { flexDirection: 'column', gap: 6 },
  actionBtn: { padding: 6 },
  section: { padding: 20 },
  sectionLabel: { fontFamily: 'serif', fontSize: 18, color: '#1A1A2E', marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#7A7A9A', marginBottom: 8, marginTop: 14 },
  fastFoodBtn: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#E8E4DC', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 4 },
  fastFoodBtnActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  fastFoodBtnText: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8E4DC' },
  chipActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#7A7A9A' },
  chipTextActive: { color: '#fff' },
  textArea: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8E4DC', borderRadius: 12, padding: 13, fontSize: 14, color: '#1A1A2E', minHeight: 80, textAlignVertical: 'top' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8E4DC', borderRadius: 10, padding: 13, fontSize: 15, color: '#1A1A2E' },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8E4DC', borderRadius: 10, padding: 12, alignItems: 'center' },
  photoBtnText: { fontSize: 13, fontWeight: '600', color: '#7A7A9A' },
  photoPreview: { marginTop: 10, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#E8E4DC' },
  previewImage: { width: '100%', height: 180 },
  photoTimestamp: { fontSize: 11, color: '#7A7A9A', padding: 8, backgroundColor: '#F4F2EE' },
  removePhoto: { padding: 8, alignItems: 'center', backgroundColor: '#FCEEED' },
  removePhotoText: { fontSize: 12, color: '#C8524A', fontWeight: '600' },
  cancelBtn: { marginTop: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E8E4DC', alignItems: 'center' },
  cancelBtnText: { fontSize: 13, color: '#7A7A9A', fontWeight: '600' },
  logBtn: { backgroundColor: '#C8524A', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 14 },
  logBtnDisabled: { opacity: 0.6 },
  logBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  qualityRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  qualityBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E8E4DC', alignItems: 'center', justifyContent: 'center' },
  qualityBtnActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  qualityNum: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  qualityLabel: { fontSize: 13, color: '#7A7A9A', marginBottom: 12 },
  sleepBar: { height: 8, backgroundColor: '#E8E4DC', borderRadius: 4, marginBottom: 6, position: 'relative', overflow: 'hidden' },
  sleepBarFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
  sleepBarTarget: { position: 'absolute', left: '77.8%', top: -2, bottom: -2, width: 2, backgroundColor: '#3D7A5E', opacity: 0.6 },
  sleepBarLabel: { fontSize: 12, color: '#7A7A9A', marginBottom: 14 },
  sleepBarSmall: { height: 5, backgroundColor: '#E8E4DC', borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  sleepBarFillSmall: { height: '100%', borderRadius: 3 },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  activityBtn: { width: '30%', backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E8E4DC' },
  activityBtnActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  activityEmoji: { fontSize: 22, marginBottom: 4 },
  activityLabel: { fontSize: 11, fontWeight: '600', color: '#7A7A9A', textAlign: 'center' },
  activityLabelActive: { color: '#fff' },
})