import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { extractLabValues } from '../../lib/ocr'
import RecordDetail from './record'
import TrendsScreen from './trends'

type MedicalRecord = {
  id: string
  lab_facility: string
  record_date: string
  status: string
  created_at: string
}

export default function PatientHome() {
  const signOut = useAuthStore((state) => state.signOut)
  const session = useAuthStore((state) => state.session)
  const [uploading, setUploading] = useState(false)
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(true)
  const [processingText, setProcessingText] = useState('')
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null)
  const [showTrends, setShowTrends] = useState(false)

  useEffect(() => {
    if (session?.user.id) {
      fetchRecords(session.user.id)
    }
  }, [session])

  async function fetchRecords(userId: string) {
    setLoadingRecords(true)
    const { data, error } = await supabase
      .from('medical_records')
      .select('*')
      .eq('patient_id', userId)
      .order('created_at', { ascending: false })

    if (!error && data) setRecords(data)
    setLoadingRecords(false)
  }

  function handleScanLab() {
    Alert.alert(
      'Add Lab Result',
      'How would you like to add your lab result?',
      [
        { text: 'Take Photo', onPress: openCamera },
        { text: 'Choose from Library', onPress: openLibrary },
        { text: 'Attach File (PDF)', onPress: openFilePicker },
        { text: 'Cancel', style: 'cancel' },
      ]
    )
  }

  async function openCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    })
    if (!result.canceled) await uploadFile(result.assets[0].uri, 'image/jpeg')
  }

  async function openLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 1,
    })
    if (!result.canceled) await uploadFile(result.assets[0].uri, 'image/jpeg')
  }

  async function openFilePicker() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    })
    if (result.canceled) return
    const file = result.assets[0]
    await uploadFile(file.uri, file.mimeType ?? 'application/pdf')
  }

  async function uploadFile(uri: string, contentType: string) {
    setUploading(true)
    setProcessingText('Uploading...')

    try {
      const userId = session?.user.id!
      const extension = contentType === 'application/pdf' ? 'pdf' : 'jpg'
      const filePath = `${userId}/${Date.now()}.${extension}`
      const response = await fetch(uri)
      const blob = await response.blob()

      const { error: uploadError } = await supabase.storage
        .from('medical-records')
        .upload(filePath, blob, { contentType })

      if (uploadError) {
        Alert.alert('Upload failed', uploadError.message)
        return
      }

      let labFacility = 'Unknown'
      let recordDate = new Date().toISOString().split('T')[0]
      let extractedValues: any[] = []

      if (contentType === 'image/jpeg') {
        setProcessingText('Reading your lab results...')
        try {
          const ocrResult = await extractLabValues(uri)
          labFacility = ocrResult.lab_facility
          recordDate = ocrResult.record_date
          extractedValues = ocrResult.values
        } catch (ocrError) {
          console.log('OCR failed:', ocrError)
        }
      }

      setProcessingText('Saving...')
      const { data: recordData, error: dbError } = await supabase
        .from('medical_records')
        .insert({
          patient_id: userId,
          photo_url: filePath,
          status: extractedValues.length > 0 ? 'verified' : 'processing',
          lab_facility: labFacility,
          record_date: recordDate,
        })
        .select()
        .single()

      if (dbError) {
        Alert.alert('Save failed', dbError.message)
        return
      }

      if (extractedValues.length > 0 && recordData) {
        const labValueRows = extractedValues.map((v) => ({
          record_id: recordData.id,
          patient_id: userId,
          test_name: v.test_name,
          value: v.value,
          unit: v.unit,
          reference_low: v.reference_low,
          reference_high: v.reference_high,
          is_flagged: v.is_flagged,
          record_date: recordDate,
        }))
        await supabase.from('lab_values').insert(labValueRows)
      }

      await fetchRecords(userId)
      Alert.alert(
        'Done!',
        extractedValues.length > 0
          ? `Found ${extractedValues.length} lab values from ${labFacility}`
          : 'Lab result uploaded. Values will be processed shortly.'
      )
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.')
      console.log(e)
    } finally {
      setUploading(false)
      setProcessingText('')
    }
  }

  if (showTrends) {
    return <TrendsScreen onBack={() => setShowTrends(false)} />
  }

  if (selectedRecord) {
    return (
      <RecordDetail
        recordId={selectedRecord.id}
        labFacility={selectedRecord.lab_facility}
        recordDate={selectedRecord.record_date}
        onBack={() => setSelectedRecord(null)}
      />
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>bridgette</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Health Wallet</Text>
        <Text style={styles.sectionSub}>
          {records.length} record{records.length !== 1 ? 's' : ''} uploaded
        </Text>
      </View>

      {/* Trends button */}
      <TouchableOpacity
        style={styles.trendsBtn}
        onPress={() => setShowTrends(true)}
      >
        <Text style={styles.trendsBtnIcon}>📈</Text>
        <View style={styles.trendsBtnInfo}>
          <Text style={styles.trendsBtnTitle}>View Lab Trends</Text>
          <Text style={styles.trendsBtnSub}>Track how your values change over time</Text>
        </View>
        <Text style={styles.trendsBtnArrow}>→</Text>
      </TouchableOpacity>

      {uploading && (
        <View style={styles.processingBanner}>
          <ActivityIndicator color="#C8524A" size="small" />
          <Text style={styles.processingText}>{processingText}</Text>
        </View>
      )}

      {loadingRecords ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#C8524A" />
      ) : records.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🧪</Text>
          <Text style={styles.emptyTitle}>No records yet</Text>
          <Text style={styles.emptyText}>
            Upload your first lab result to get started
          </Text>
        </View>
      ) : (
        <View style={styles.recordsList}>
          {records.map((record) => (
            <TouchableOpacity
              key={record.id}
              style={styles.recordCard}
              onPress={() => setSelectedRecord(record)}
            >
              <View style={styles.recordLeft}>
                <Text style={styles.recordIcon}>📄</Text>
              </View>
              <View style={styles.recordInfo}>
                <Text style={styles.recordFacility}>{record.lab_facility}</Text>
                <Text style={styles.recordDate}>{record.record_date}</Text>
              </View>
              <View style={[
                styles.statusBadge,
                record.status === 'processing' ? styles.statusProcessing : styles.statusDone
              ]}>
                <Text style={styles.statusText}>{record.status}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
        onPress={handleScanLab}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.uploadBtnText}>+ Scan a Lab Result</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F4' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4DC',
  },
  logo: { fontFamily: 'serif', fontSize: 24, color: '#C8524A' },
  signOut: { fontSize: 14, color: '#7A7A9A' },
  section: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16 },
  sectionTitle: { fontFamily: 'serif', fontSize: 26, color: '#1A1A2E', marginBottom: 6 },
  sectionSub: { fontSize: 14, color: '#7A7A9A', lineHeight: 20 },
  trendsBtn: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E4DC',
    gap: 12,
  },
  trendsBtnIcon: { fontSize: 24 },
  trendsBtnInfo: { flex: 1 },
  trendsBtnTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 2 },
  trendsBtnSub: { fontSize: 12, color: '#7A7A9A' },
  trendsBtnArrow: { fontSize: 18, color: '#7A7A9A' },
  processingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    marginHorizontal: 24,
    marginBottom: 10,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },
  processingText: { fontSize: 14, color: '#1A1A2E' },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontFamily: 'serif', fontSize: 20, color: '#1A1A2E', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#7A7A9A', textAlign: 'center', lineHeight: 20 },
  recordsList: { paddingHorizontal: 24, marginBottom: 16 },
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },
  recordLeft: { marginRight: 12 },
  recordIcon: { fontSize: 28 },
  recordInfo: { flex: 1 },
  recordFacility: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 3 },
  recordDate: { fontSize: 12, color: '#7A7A9A' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusProcessing: { backgroundColor: '#FDF3E3' },
  statusDone: { backgroundColor: '#EAF4EE' },
  statusText: { fontSize: 11, fontWeight: '600', color: '#B5720A' },
  uploadBtn: {
    backgroundColor: '#C8524A',
    marginHorizontal: 24,
    marginBottom: 40,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})