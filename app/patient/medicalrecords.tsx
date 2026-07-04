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
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { extractLabValues } from '../../lib/ocr'
import RecordDetail from './record'
import Icon from '../../components/Icon'

type MedicalRecord = {
  id: string
  lab_facility: string
  record_date: string
  status: string
  created_at: string
}

export default function MedicalRecordsScreen({ onBack }: { onBack: () => void }) {
  const session = useAuthStore((state) => state.session)
  const [uploading, setUploading] = useState(false)
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(true)
  const [processingText, setProcessingText] = useState('')
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null)

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
      .order('record_date', { ascending: false })

    if (!error && data) setRecords(data)
    setLoadingRecords(false)
  }

  async function handleDelete(recordId: string) {
    Alert.alert(
      'Delete Record',
      'Are you sure you want to delete this record? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('lab_values').delete().eq('record_id', recordId)
            await supabase.from('medical_records').delete().eq('id', recordId)
            fetchRecords(session?.user.id!)
          },
        },
      ]
    )
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
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 1 })
    if (!result.canceled) await uploadImages([result.assets[0].uri])
  }

  async function openLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      orderedSelection: true,
      quality: 1,
    })
    if (!result.canceled && result.assets.length > 0) {
      await uploadImages(result.assets.map((a) => a.uri))
    }
  }

  async function openFilePicker() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    })
    if (result.canceled) return
    const file = result.assets[0]
    if (file.mimeType?.startsWith('image/')) {
      await uploadImages([file.uri])
    } else {
      await uploadPdf(file.uri)
    }
  }

  async function uploadImages(uris: string[]) {
    setUploading(true)
    try {
      const userId = session?.user.id!
      const batchStamp = Date.now()
      const pagePaths: string[] = []

      for (let i = 0; i < uris.length; i++) {
        setProcessingText(
          uris.length > 1
            ? `Uploading page ${i + 1} of ${uris.length}...`
            : 'Uploading...'
        )
        const filePath = `${userId}/${batchStamp}_p${i + 1}.jpg`
        const response = await fetch(uris[i])
        const blob = await response.blob()

        const { error: uploadError } = await supabase.storage
          .from('medical-records')
          .upload(filePath, blob, { contentType: 'image/jpeg' })

        if (uploadError) {
          Alert.alert('Upload failed', uploadError.message)
          return
        }
        pagePaths.push(filePath)
      }

      let labFacility = 'Unknown'
      let recordDate = new Date().toISOString().split('T')[0]
      let extractedValues: any[] = []

      setProcessingText(
        uris.length > 1
          ? `Reading ${uris.length} pages...`
          : 'Reading your lab results...'
      )
      try {
        const ocrResult = await extractLabValues(uris)
        labFacility = ocrResult.lab_facility
        recordDate = ocrResult.record_date
        extractedValues = ocrResult.values
      } catch (ocrError) {
        console.log('OCR failed:', ocrError)
      }

      setProcessingText('Saving...')
      const { data: recordData, error: dbError } = await supabase
        .from('medical_records')
        .insert({
          patient_id: userId,
          photo_url: pagePaths[0],
          page_urls: pagePaths,
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
        const { error: lvError } = await supabase.from('lab_values').insert(labValueRows)
        if (lvError) {
          console.log('lab_values insert failed:', lvError.message)
          Alert.alert('Heads up', 'Record saved, but the lab values could not be stored.')
        }
      }

      await fetchRecords(userId)
      Alert.alert(
        'Done!',
        extractedValues.length > 0
          ? `Found ${extractedValues.length} lab values from ${labFacility}${uris.length > 1 ? ` across ${uris.length} pages` : ''}`
          : 'Lab result uploaded.'
      )
    } catch (e) {
      Alert.alert('Error', 'Something went wrong.')
      console.log(e)
    } finally {
      setUploading(false)
      setProcessingText('')
    }
  }

  async function uploadPdf(uri: string) {
    setUploading(true)
    setProcessingText('Uploading...')
    try {
      const userId = session?.user.id!
      const filePath = `${userId}/${Date.now()}.pdf`
      const response = await fetch(uri)
      const blob = await response.blob()

      const { error: uploadError } = await supabase.storage
        .from('medical-records')
        .upload(filePath, blob, { contentType: 'application/pdf' })

      if (uploadError) {
        Alert.alert('Upload failed', uploadError.message)
        return
      }

      const { error: dbError } = await supabase
        .from('medical_records')
        .insert({
          patient_id: userId,
          photo_url: filePath,
          page_urls: [filePath],
          status: 'processing',
          lab_facility: 'Unknown',
          record_date: new Date().toISOString().split('T')[0],
        })

      if (dbError) {
        Alert.alert('Save failed', dbError.message)
        return
      }

      await fetchRecords(userId)
      Alert.alert(
        'Uploaded',
        'PDF saved. Tip: PDFs are not read automatically yet. For automatic reading, screenshot the PDF pages and upload them as photos.'
      )
    } catch (e) {
      Alert.alert('Error', 'Something went wrong.')
      console.log(e)
    } finally {
      setUploading(false)
      setProcessingText('')
    }
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
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <View style={styles.backRow}>
            <Icon name="back" size={18} color="#5C7340" />
            <Text style={styles.backText}>Back</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>Medical Records</Text>
        <Text style={styles.subtitle}>
          {records.length} record{records.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {uploading && (
        <View style={styles.processingBanner}>
          <ActivityIndicator color="#5C7340" size="small" />
          <Text style={styles.processingText}>{processingText}</Text>
        </View>
      )}

      {loadingRecords ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#5C7340" />
      ) : records.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="lab" size={40} color="#8A7E72" />
          <Text style={styles.emptyTitle}>No records yet</Text>
          <Text style={styles.emptyText}>Upload your first lab result to get started</Text>
        </View>
      ) : (
        <View style={styles.recordsList}>
          {records.map((record, index) => (
            <Animated.View key={record.id} entering={FadeInDown.delay(index * 60)} style={styles.recordCard}>
              <TouchableOpacity
                style={styles.recordMain}
                onPress={() => setSelectedRecord(record)}
              >
                <Icon name="record" size={24} color="#5C7340" />
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
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(record.id)}
              >
                <Icon name="delete" size={20} color="#B5451B" />
              </TouchableOpacity>
            </Animated.View>
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
          <Text style={styles.uploadBtnText}>+ Add Lab Result</Text>
        )}
      </TouchableOpacity>
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
  processingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    margin: 16,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5DFD3',
  },
  processingText: { fontSize: 14, color: '#3D3229' },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40, gap: 4 },
  emptyTitle: { fontFamily: 'Georgia', fontSize: 20, color: '#3D3229', marginTop: 12, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#8A7E72', textAlign: 'center', lineHeight: 20 },
  recordsList: { padding: 16 },
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5DFD3',
    overflow: 'hidden',
  },
  recordMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  recordInfo: { flex: 1 },
  recordFacility: { fontSize: 14, fontWeight: '600', color: '#3D3229', marginBottom: 3 },
  recordDate: { fontSize: 12, color: '#8A7E72' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusProcessing: { backgroundColor: '#F6EDDA' },
  statusDone: { backgroundColor: '#EBEFE3' },
  statusText: { fontSize: 11, fontWeight: '600', color: '#C4922A' },
  deleteBtn: {
    padding: 16,
    borderLeftWidth: 1,
    borderLeftColor: '#E5DFD3',
  },
  uploadBtn: {
    backgroundColor: '#5C7340',
    marginHorizontal: 16,
    marginBottom: 40,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})