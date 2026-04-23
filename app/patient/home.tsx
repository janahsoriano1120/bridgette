import { useState } from 'react'
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

export default function PatientHome() {
  const signOut = useAuthStore((state) => state.signOut)
  const session = useAuthStore((state) => state.session)
  const [uploading, setUploading] = useState(false)

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
    try {
      const userId = session?.user.id
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

      const { error: dbError } = await supabase
        .from('medical_records')
        .insert({
          patient_id: userId,
          photo_url: filePath,
          status: 'processing',
          lab_facility: 'Unknown',
          record_date: new Date().toISOString().split('T')[0],
        })

      if (dbError) {
        Alert.alert('Save failed', dbError.message)
        return
      }

      Alert.alert('Success!', 'Your lab result has been uploaded.')
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.')
      console.log(e)
    } finally {
      setUploading(false)
    }
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
        <Text style={styles.sectionSub}>Upload and track your lab results over time</Text>
      </View>

      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🧪</Text>
        <Text style={styles.emptyTitle}>No records yet</Text>
        <Text style={styles.emptyText}>
          Upload your first lab result to get started
        </Text>
      </View>

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
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontFamily: 'serif', fontSize: 20, color: '#1A1A2E', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#7A7A9A', textAlign: 'center', lineHeight: 20 },
  uploadBtn: {
    backgroundColor: '#C8524A',
    marginHorizontal: 24,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})