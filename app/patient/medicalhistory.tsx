import { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  Modal,
  Image,
  Linking,
  ImageBackground,
} from 'react-native'
import Animated, { FadeInDown, FadeIn, FadeInRight, SlideInRight, Layout } from 'react-native-reanimated'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { MoreVertical, Pencil, Trash2, ChevronDown, ChevronRight, Search, SlidersHorizontal, X, Check, Activity, AlertTriangle } from 'lucide-react-native'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import Icon from '../../components/Icon'

type ConsultationNote = {
  id: string
  chief_complaint: string
  diagnosis: string
  next_steps: string
  visit_date: string
  doctor_id: string | null
  doctor_name: string | null
  doctor_specialty: string | null
  facility_name: string | null
  visit_type: string | null
  source: string
  ai_validation_status: string
  ai_validation_notes: string | null
  medications_prescribed: string | null
  referred_to: string | null
  status: string | null
  status_notes: string | null
  status_updated_at: string | null
  is_emergency: boolean
}

type RelatedRecord = {
  id: string
  lab_facility: string
  record_date: string
  status: string
  photo_url: string
  page_urls: string[]
}

type AttachedFile = { uri: string; type: 'image' | 'pdf' }
type ExistingDocument = { id: string; lab_facility: string; record_date: string }
type SortMode = 'newest' | 'oldest' | 'az'
type DoctorFilter = 'all' | 'withDoctor' | 'selfReported'
type FilterCategory = 'specialty' | 'doctorPresence' | 'sort' | 'dateRange' | null

const VISIT_TYPES = ['Clinic', 'Hospital', 'Teleconsult']

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'az', label: 'A to Z' },
]

const DOCTOR_FILTER_OPTIONS: { key: DoctorFilter; label: string }[] = [
  { key: 'all', label: 'All entries' },
  { key: 'withDoctor', label: 'With a doctor on file' },
  { key: 'selfReported', label: 'Self-reported only' },
]

const STATUS_OPTIONS = ['Managed', 'Seeing a Doctor', 'Getting Better', 'Getting Worse', 'Still Figuring It Out']
const NO_REFERRAL_NEEDED_TEXT = 'No referral: doctor said none was needed'
const DAMA_TEXT = 'No referral: patient declined a suggested referral (discharged against medical advice)'

export default function MedicalHistoryScreen({ onBack }: { onBack: () => void }) {
  const session = useAuthStore((state) => state.session)
  const [notes, setNotes] = useState<ConsultationNote[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [relatedRecords, setRelatedRecords] = useState<Record<string, RelatedRecord[]>>({})
  const [loadingRecordsFor, setLoadingRecordsFor] = useState<string | null>(null)
  const [showingRecordsFor, setShowingRecordsFor] = useState<string | null>(null)
  const [viewerVisible, setViewerVisible] = useState(false)
  const [viewerUri, setViewerUri] = useState<string | null>(null)
  const [viewerIsPdf, setViewerIsPdf] = useState(false)
  const [viewerLoading, setViewerLoading] = useState(false)
  const [viewerError, setViewerError] = useState<string | null>(null)

  const [formCondition, setFormCondition] = useState('')
  const [formDate, setFormDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [formNotes, setFormNotes] = useState('')
  const [formDoctorName, setFormDoctorName] = useState('')
  const [formDoctorSpecialty, setFormDoctorSpecialty] = useState('')
  const [formFacilityName, setFormFacilityName] = useState('')
  const [formVisitType, setFormVisitType] = useState<string | null>(null)
  const [formMedications, setFormMedications] = useState('')
  const [formReferredTo, setFormReferredTo] = useState('')
  const [formIsEmergency, setFormIsEmergency] = useState(false)
  const [formReferralAnswer, setFormReferralAnswer] = useState<'yes' | 'no' | null>(null)
  const [referralModalVisible, setReferralModalVisible] = useState(false)
  const [referralServiceInput, setReferralServiceInput] = useState('')
  const [dischargeReasonModalVisible, setDischargeReasonModalVisible] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [existingDocuments, setExistingDocuments] = useState<ExistingDocument[]>([])
  const [loadingExistingDocs, setLoadingExistingDocs] = useState(false)

  const [noteMenuTarget, setNoteMenuTarget] = useState<ConsultationNote | null>(null)
  const [docMenuTarget, setDocMenuTarget] = useState<ExistingDocument | null>(null)
  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameTarget, setRenameTarget] = useState<ExistingDocument | null>(null)
  const [confirmModalVisible, setConfirmModalVisible] = useState(false)

  const [statusModalTarget, setStatusModalTarget] = useState<ConsultationNote | null>(null)
  const [statusChipSelected, setStatusChipSelected] = useState<string | null>(null)
  const [statusCustomText, setStatusCustomText] = useState('')
  const [statusNotesText, setStatusNotesText] = useState('')
  const [savingStatus, setSavingStatus] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState<string | null>(null)
  const [doctorFilter, setDoctorFilter] = useState<DoctorFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('newest')

  const [filterModalVisible, setFilterModalVisible] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<FilterCategory>(null)
  const [filterSearchQuery, setFilterSearchQuery] = useState('')
  const [dateRangeStart, setDateRangeStart] = useState<Date | null>(null)
  const [dateRangeEnd, setDateRangeEnd] = useState<Date | null>(null)
  const [showRangeStartPicker, setShowRangeStartPicker] = useState(false)
  const [showRangeEndPicker, setShowRangeEndPicker] = useState(false)

  useEffect(() => {
    if (session?.user.id) {
      fetchNotes(session.user.id)
    }
  }, [session])

  async function fetchNotes(userId: string) {
    setLoading(true)
    const { data, error } = await supabase
      .from('consultation_notes')
      .select('*')
      .eq('patient_id', userId)
      .order('visit_date', { ascending: false })

    if (!error && data) setNotes(data)
    setLoading(false)
  }

  function openStatusModal(note: ConsultationNote) {
    setStatusModalTarget(note)
    setStatusChipSelected(STATUS_OPTIONS.includes(note.status || '') ? note.status : null)
    setStatusCustomText(STATUS_OPTIONS.includes(note.status || '') ? '' : (note.status || ''))
    setStatusNotesText(note.status_notes || '')
  }

  function closeStatusModal() {
    setStatusModalTarget(null)
    setStatusChipSelected(null)
    setStatusCustomText('')
    setStatusNotesText('')
  }

  async function submitStatusUpdate() {
    if (!statusModalTarget) return
    const finalStatus = statusCustomText.trim() || statusChipSelected
    if (!finalStatus) {
      Alert.alert('Please select or type a status')
      return
    }
    setSavingStatus(true)
    const { error } = await supabase
      .from('consultation_notes')
      .update({
        status: finalStatus,
        status_notes: statusNotesText.trim() || null,
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', statusModalTarget.id)

    setSavingStatus(false)
    if (error) {
      Alert.alert('Update failed', error.message)
      return
    }
    setNotes(prev => prev.map(n => n.id === statusModalTarget.id
      ? { ...n, status: finalStatus, status_notes: statusNotesText.trim() || null, status_updated_at: new Date().toISOString() }
      : n
    ))
    closeStatusModal()
  }

  const specialties = useMemo(() => {
    const set = new Set<string>()
    notes.forEach(n => { if (n.doctor_specialty) set.add(n.doctor_specialty) })
    return Array.from(set).sort()
  }, [notes])

  const filteredSpecialties = useMemo(() => {
    if (!filterSearchQuery.trim()) return specialties
    const q = filterSearchQuery.trim().toLowerCase()
    return specialties.filter(s => s.toLowerCase().includes(q))
  }, [specialties, filterSearchQuery])

  const filteredNotes = useMemo(() => {
    let result = [...notes]

    if (specialtyFilter) {
      result = result.filter(n => n.doctor_specialty === specialtyFilter)
    }

    if (doctorFilter === 'withDoctor') {
      result = result.filter(n => n.source !== 'patient' || !!n.doctor_name)
    } else if (doctorFilter === 'selfReported') {
      result = result.filter(n => n.source === 'patient' && !n.doctor_name)
    }

    if (dateRangeStart) {
      const startStr = formatDateForDb(dateRangeStart)
      result = result.filter(n => n.visit_date >= startStr)
    }
    if (dateRangeEnd) {
      const endStr = formatDateForDb(dateRangeEnd)
      result = result.filter(n => n.visit_date <= endStr)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(n =>
        n.diagnosis?.toLowerCase().includes(q) ||
        n.chief_complaint?.toLowerCase().includes(q) ||
        n.next_steps?.toLowerCase().includes(q) ||
        n.doctor_name?.toLowerCase().includes(q) ||
        n.doctor_specialty?.toLowerCase().includes(q) ||
        n.facility_name?.toLowerCase().includes(q) ||
        n.medications_prescribed?.toLowerCase().includes(q) ||
        n.referred_to?.toLowerCase().includes(q) ||
        n.status?.toLowerCase().includes(q) ||
        n.status_notes?.toLowerCase().includes(q)
      )
    }

    if (sortMode === 'newest') {
      result.sort((a, b) => b.visit_date.localeCompare(a.visit_date))
    } else if (sortMode === 'oldest') {
      result.sort((a, b) => a.visit_date.localeCompare(b.visit_date))
    } else if (sortMode === 'az') {
      result.sort((a, b) => a.diagnosis.localeCompare(b.diagnosis))
    }

    return result
  }, [notes, specialtyFilter, doctorFilter, searchQuery, sortMode, dateRangeStart, dateRangeEnd])

  const activeFilterTags = useMemo(() => {
    const tags: { key: string; label: string; onRemove: () => void }[] = []
    if (specialtyFilter) {
      tags.push({ key: 'specialty', label: specialtyFilter, onRemove: () => setSpecialtyFilter(null) })
    }
    if (doctorFilter !== 'all') {
      const opt = DOCTOR_FILTER_OPTIONS.find(o => o.key === doctorFilter)
      tags.push({ key: 'doctor', label: opt?.label || '', onRemove: () => setDoctorFilter('all') })
    }
    if (sortMode !== 'newest') {
      const opt = SORT_OPTIONS.find(o => o.key === sortMode)
      tags.push({ key: 'sort', label: opt?.label || '', onRemove: () => setSortMode('newest') })
    }
    if (dateRangeStart || dateRangeEnd) {
      const startLabel = dateRangeStart ? formatDateForDb(dateRangeStart) : '…'
      const endLabel = dateRangeEnd ? formatDateForDb(dateRangeEnd) : '…'
      tags.push({
        key: 'dateRange',
        label: `${startLabel} to ${endLabel}`,
        onRemove: () => { setDateRangeStart(null); setDateRangeEnd(null) },
      })
    }
    return tags
  }, [specialtyFilter, doctorFilter, sortMode, dateRangeStart, dateRangeEnd])

  function toggleCategory(cat: FilterCategory) {
    setExpandedCategory(prev => prev === cat ? null : cat)
  }

  function openFilterModal() {
    setFilterSearchQuery('')
    setExpandedCategory(null)
    setFilterModalVisible(true)
  }

  async function fetchRelatedRecords(consultationId: string, forceRefresh: boolean = false) {
    if (showingRecordsFor === consultationId) {
      setShowingRecordsFor(null)
      return
    }
    if (relatedRecords[consultationId] && !forceRefresh) {
      setShowingRecordsFor(consultationId)
      return
    }
    setLoadingRecordsFor(consultationId)
    const { data, error } = await supabase
      .from('medical_records')
      .select('id, lab_facility, record_date, status, photo_url, page_urls')
      .eq('consultation_id', consultationId)

    if (error) {
      Alert.alert('Could not load records', error.message)
      setLoadingRecordsFor(null)
      return
    }

    setRelatedRecords(prev => ({ ...prev, [consultationId]: data || [] }))
    setShowingRecordsFor(consultationId)
    setLoadingRecordsFor(null)
  }

  async function openRecordFile(rec: RelatedRecord) {
    const path = rec.page_urls?.[0] || rec.photo_url
    if (!path) {
      Alert.alert('No file found', 'This record has no attached document.')
      return
    }
    setViewerLoading(true)
    setViewerVisible(true)
    setViewerError(null)
    const isPdf = path.toLowerCase().endsWith('.pdf')
    setViewerIsPdf(isPdf)

    const { data, error } = await supabase.storage
      .from('medical-records')
      .createSignedUrl(path, 3600)

    setViewerLoading(false)
    if (error || !data?.signedUrl) {
      setViewerError(`Could not generate a link: ${error?.message || 'unknown error'} (path: ${path})`)
      return
    }
    setViewerUri(data.signedUrl)
  }

  async function openExistingDocument(doc: ExistingDocument) {
    setViewerLoading(true)
    setViewerVisible(true)
    setViewerError(null)

    const { data: recordRow } = await supabase
      .from('medical_records')
      .select('photo_url, page_urls')
      .eq('id', doc.id)
      .single()

    const path = recordRow?.page_urls?.[0] || recordRow?.photo_url
    if (!path) {
      setViewerLoading(false)
      setViewerError('No file found for this document.')
      return
    }

    setViewerIsPdf(path.toLowerCase().endsWith('.pdf'))

    const { data, error } = await supabase.storage
      .from('medical-records')
      .createSignedUrl(path, 3600)

    setViewerLoading(false)
    if (error || !data?.signedUrl) {
      setViewerError(`Could not generate a link: ${error?.message || 'unknown error'}`)
      return
    }
    setViewerUri(data.signedUrl)
  }

  function closeViewer() {
    setViewerVisible(false)
    setViewerUri(null)
    setViewerError(null)
  }

  function openDocMenu(doc: ExistingDocument) {
    setDocMenuTarget(doc)
  }
  function closeDocMenu() {
    setDocMenuTarget(null)
  }
  function handleDocMenuRename() {
    if (!docMenuTarget) return
    setRenameTarget(docMenuTarget)
    setRenameValue(docMenuTarget.lab_facility)
    setDocMenuTarget(null)
    setRenameModalVisible(true)
  }
  function handleDocMenuDelete() {
    if (!docMenuTarget) return
    const target = docMenuTarget
    setDocMenuTarget(null)
    deleteExistingDocument(target.id)
  }

  async function submitRename() {
    if (!renameTarget || !renameValue.trim()) return
    const { error } = await supabase
      .from('medical_records')
      .update({ lab_facility: renameValue.trim() })
      .eq('id', renameTarget.id)
    if (error) {
      Alert.alert('Rename failed', error.message)
      return
    }
    setExistingDocuments(prev =>
      prev.map(d => d.id === renameTarget.id ? { ...d, lab_facility: renameValue.trim() } : d)
    )
    setRenameModalVisible(false)
    setRenameTarget(null)
    setRenameValue('')
  }

  function openNoteMenu(note: ConsultationNote) {
    setNoteMenuTarget(note)
  }
  function closeNoteMenu() {
    setNoteMenuTarget(null)
  }
  function handleNoteMenuEdit() {
    if (!noteMenuTarget) return
    const target = noteMenuTarget
    setNoteMenuTarget(null)
    startEdit(target)
  }
  function handleNoteMenuDelete() {
    if (!noteMenuTarget) return
    const target = noteMenuTarget
    setNoteMenuTarget(null)
    deleteNote(target.id)
  }

  async function deleteNote(noteId: string) {
    Alert.alert(
      'Delete this entry?',
      'This will also remove any documents attached to it. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('medical_records').delete().eq('consultation_id', noteId)
            const { error } = await supabase.from('consultation_notes').delete().eq('id', noteId)
            if (error) {
              Alert.alert('Delete failed', error.message)
              return
            }
            setNotes(prev => prev.filter(n => n.id !== noteId))
            setRelatedRecords(prev => {
              const updated = { ...prev }
              delete updated[noteId]
              return updated
            })
          },
        },
      ]
    )
  }

  function resetForm() {
    setFormCondition('')
    setFormDate(new Date())
    setFormNotes('')
    setFormDoctorName('')
    setFormDoctorSpecialty('')
    setFormFacilityName('')
    setFormVisitType(null)
    setFormMedications('')
    setFormReferredTo('')
    setFormIsEmergency(false)
    setFormReferralAnswer(null)
    setAttachedFiles([])
    setExistingDocuments([])
    setShowAddForm(false)
    setEditingId(null)
    setShowDatePicker(false)
  }

  async function startEdit(note: ConsultationNote) {
    setFormCondition(note.diagnosis)
    setFormDate(new Date(note.visit_date))
    setFormNotes(note.source === 'patient' ? note.next_steps : '')
    setFormDoctorName(note.doctor_name || '')
    setFormDoctorSpecialty(note.doctor_specialty || '')
    setFormFacilityName(note.facility_name || '')
    setFormVisitType(note.visit_type)
    setFormMedications(note.medications_prescribed || '')
    setFormReferredTo(note.referred_to || '')
    setFormIsEmergency(note.is_emergency || false)
    setFormReferralAnswer(
      note.referred_to === NO_REFERRAL_NEEDED_TEXT || note.referred_to === DAMA_TEXT
        ? 'no'
        : note.referred_to ? 'yes' : null
    )
    setAttachedFiles([])
    setEditingId(note.id)
    setShowAddForm(true)
    setExpandedId(null)

    setLoadingExistingDocs(true)
    const { data } = await supabase
      .from('medical_records')
      .select('id, lab_facility, record_date')
      .eq('consultation_id', note.id)
    setExistingDocuments(data || [])
    setLoadingExistingDocs(false)
  }

  async function deleteExistingDocument(recordId: string) {
    Alert.alert(
      'Delete this document?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('medical_records').delete().eq('id', recordId)
            if (error) {
              Alert.alert('Delete failed', error.message)
              return
            }
            setExistingDocuments(prev => prev.filter(d => d.id !== recordId))
            if (editingId) {
              setRelatedRecords(prev => {
                const updated = { ...prev }
                delete updated[editingId]
                return updated
              })
            }
          },
        },
      ]
    )
  }

  function formatDateForDisplay(date: Date) {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  function formatDateForDb(date: Date) {
    return date.toISOString().split('T')[0]
  }

  function handleReferralNo() {
    setDischargeReasonModalVisible(true)
  }

  function selectDischargeReason(reason: 'none_needed' | 'dama') {
    setFormReferralAnswer('no')
    setFormReferredTo(reason === 'dama' ? DAMA_TEXT : NO_REFERRAL_NEEDED_TEXT)
    setDischargeReasonModalVisible(false)
  }

  function handleReferralYesPress() {
    setReferralServiceInput(formReferralAnswer === 'yes' ? formReferredTo : '')
    setReferralModalVisible(true)
  }

  function submitReferralService() {
    if (!referralServiceInput.trim()) {
      Alert.alert('Please enter which service you were referred to')
      return
    }
    setFormReferralAnswer('yes')
    setFormReferredTo(referralServiceInput.trim())
    setReferralModalVisible(false)
  }

  function formatDateForCard(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  function getRelativeTime(dateStr: string): string | null {
    const then = new Date(dateStr + 'T00:00:00')
    const now = new Date()

    let years = now.getFullYear() - then.getFullYear()
    let months = now.getMonth() - then.getMonth()
    if (now.getDate() < then.getDate()) months -= 1
    if (months < 0) { years -= 1; months += 12 }

    const totalMonths = years * 12 + months
    if (totalMonths < 1) return null
    if (years >= 1) return `${years}y ago`
    return `${months}mo ago`
  }

  function handleAttachFile() {
    Alert.alert(
      'Attach a Document',
      'Add a discharge paper, old lab result, or other related file',
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
    if (!result.canceled) {
      setAttachedFiles(prev => [...prev, { uri: result.assets[0].uri, type: 'image' }])
    }
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
      selectionLimit: 5,
      quality: 1,
    })
    if (!result.canceled && result.assets.length > 0) {
      setAttachedFiles(prev => [
        ...prev,
        ...result.assets.map(a => ({ uri: a.uri, type: 'image' as const })),
      ])
    }
  }

  async function openFilePicker() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    })
    if (result.canceled) return
    const file = result.assets[0]
    setAttachedFiles(prev => [
      ...prev,
      { uri: file.uri, type: file.mimeType?.startsWith('image/') ? 'image' : 'pdf' },
    ])
  }

  function removeAttachedFile(index: number) {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  function handleSavePress() {
    if (!formCondition.trim()) {
      Alert.alert('Please enter a condition or diagnosis')
      return
    }
    setConfirmModalVisible(true)
  }

  function confirmSaveEntry() {
    setConfirmModalVisible(false)
    if (editingId) {
      handleUpdateDiagnosis()
    } else {
      handleSavePastDiagnosis()
    }
  }

  async function handleUpdateDiagnosis() {
    if (!editingId) return
    setSaving(true)
    const userId = session?.user.id!

    try {
      const { error } = await supabase
        .from('consultation_notes')
        .update({
          doctor_name: formDoctorName.trim() || null,
          doctor_specialty: formDoctorSpecialty.trim() || null,
          facility_name: formFacilityName.trim() || null,
          visit_type: formVisitType,
          chief_complaint: formCondition.trim(),
          diagnosis: formCondition.trim(),
          next_steps: formNotes.trim() || 'No further notes added.',
          visit_date: formatDateForDb(formDate),
          medications_prescribed: formMedications.trim() || null,
          referred_to: formReferredTo.trim() || null,
          is_emergency: formIsEmergency,
        })
        .eq('id', editingId)
        .eq('patient_id', userId)

      if (error) {
        Alert.alert('Update failed', error.message)
        setSaving(false)
        return
      }

      for (let i = 0; i < attachedFiles.length; i++) {
        const file = attachedFiles[i]
        const ext = file.type === 'pdf' ? 'pdf' : 'jpg'
        const contentType = file.type === 'pdf' ? 'application/pdf' : 'image/jpeg'
        const filePath = `${userId}/${Date.now()}_h${i + 1}.${ext}`

        const response = await fetch(file.uri)
        const blob = await response.blob()

        const { error: uploadError } = await supabase.storage
          .from('medical-records')
          .upload(filePath, blob, { contentType })

        if (uploadError) {
          console.log('File upload failed:', uploadError.message)
          continue
        }

        await supabase.from('medical_records').insert({
          patient_id: userId,
          photo_url: filePath,
          page_urls: [filePath],
          status: 'verified',
          lab_facility: `${formCondition.trim()} - ${formatDateForDb(formDate)} - ${formFacilityName.trim() || formDoctorSpecialty.trim() || 'No facility noted'}`,
          record_date: formatDateForDb(formDate),
          consultation_id: editingId,
        })
      }

      resetForm()
      fetchNotes(userId)
      setRelatedRecords({})
    } catch (e) {
      console.log(e)
      Alert.alert('Error', 'Something went wrong while updating.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePastDiagnosis() {
    setSaving(true)
    const userId = session?.user.id!

    try {
      const { data: noteData, error: noteError } = await supabase
        .from('consultation_notes')
        .insert({
          patient_id: userId,
          doctor_id: null,
          source: 'patient',
          doctor_name: formDoctorName.trim() || null,
          doctor_specialty: formDoctorSpecialty.trim() || null,
          facility_name: formFacilityName.trim() || null,
          visit_type: formVisitType,
          chief_complaint: formCondition.trim(),
          diagnosis: formCondition.trim(),
          next_steps: formNotes.trim() || 'No further notes added.',
          visit_date: formatDateForDb(formDate),
          ai_validation_status: attachedFiles.length > 0 ? 'pending' : 'no_documents',
          medications_prescribed: formMedications.trim() || null,
          referred_to: formReferredTo.trim() || null,
          is_emergency: formIsEmergency,
        })
        .select()
        .single()

      if (noteError) {
        Alert.alert('Save failed', noteError.message)
        setSaving(false)
        return
      }

      for (let i = 0; i < attachedFiles.length; i++) {
        const file = attachedFiles[i]
        const ext = file.type === 'pdf' ? 'pdf' : 'jpg'
        const contentType = file.type === 'pdf' ? 'application/pdf' : 'image/jpeg'
        const filePath = `${userId}/${Date.now()}_h${i + 1}.${ext}`

        const response = await fetch(file.uri)
        const blob = await response.blob()

        const { error: uploadError } = await supabase.storage
          .from('medical-records')
          .upload(filePath, blob, { contentType })

        if (uploadError) {
          console.log('File upload failed:', uploadError.message)
          continue
        }

        await supabase.from('medical_records').insert({
          patient_id: userId,
          photo_url: filePath,
          page_urls: [filePath],
          status: 'verified',
          lab_facility: `${formCondition.trim()} - ${formatDateForDb(formDate)} - ${formFacilityName.trim() || formDoctorSpecialty.trim() || 'No facility noted'}`,
          record_date: formatDateForDb(formDate),
          consultation_id: noteData.id,
        })
      }

      resetForm()
      fetchNotes(userId)
    } catch (e) {
      console.log(e)
      Alert.alert('Error', 'Something went wrong while saving.')
    } finally {
      setSaving(false)
    }
  }

  const viewerModal = (
    <Modal visible={viewerVisible} animationType="slide" onRequestClose={closeViewer}>
      <View style={styles.viewerContainer}>
        <View style={styles.viewerHeader}>
          <TouchableOpacity onPress={closeViewer}>
            <Text style={styles.viewerCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
        {viewerLoading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color="#fff" />
        ) : viewerError ? (
          <View style={styles.viewerPdfBox}>
            <Text style={styles.viewerPdfText}>{viewerError}</Text>
          </View>
        ) : viewerIsPdf && viewerUri ? (
          <View style={styles.viewerPdfBox}>
            <Text style={styles.viewerPdfText}>This is a PDF file.</Text>
            <TouchableOpacity style={styles.viewerPdfBtn} onPress={() => Linking.openURL(viewerUri)}>
              <Text style={styles.viewerPdfBtnText}>Open PDF</Text>
            </TouchableOpacity>
          </View>
        ) : viewerUri ? (
          <ScrollView contentContainerStyle={styles.viewerImageScroll} maximumZoomScale={3} minimumZoomScale={1}>
            <Image
              source={{ uri: viewerUri }}
              style={styles.viewerImage}
              resizeMode="contain"
              onError={(e) => setViewerError(`Image failed to load: ${e.nativeEvent.error}`)}
            />
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  )

  const docMenuModal = (
    <Modal visible={!!docMenuTarget} transparent animationType="fade" onRequestClose={closeDocMenu}>
      <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={closeDocMenu}>
        <View style={styles.sheetCard}>
          <Text style={styles.sheetTitle}>Manage Document</Text>
          <Text style={styles.sheetSubtitle} numberOfLines={1}>{docMenuTarget?.lab_facility}</Text>

          <TouchableOpacity style={styles.sheetOption} onPress={handleDocMenuRename}>
            <Pencil size={18} color="#5C7340" />
            <Text style={styles.sheetOptionText}>Rename</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetOption} onPress={handleDocMenuDelete}>
            <Trash2 size={18} color="#B5451B" />
            <Text style={[styles.sheetOptionText, styles.sheetOptionDanger]}>Delete</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeDocMenu}>
            <Text style={styles.sheetCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  )

  const noteMenuModal = (
    <Modal visible={!!noteMenuTarget} transparent animationType="fade" onRequestClose={closeNoteMenu}>
      <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={closeNoteMenu}>
        <View style={styles.sheetCard}>
          <Text style={styles.sheetTitle}>Manage Entry</Text>
          <Text style={styles.sheetSubtitle} numberOfLines={1}>{noteMenuTarget?.diagnosis}</Text>

          <TouchableOpacity style={styles.sheetOption} onPress={handleNoteMenuEdit}>
            <Pencil size={18} color="#5C7340" />
            <Text style={styles.sheetOptionText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetOption} onPress={handleNoteMenuDelete}>
            <Trash2 size={18} color="#B5451B" />
            <Text style={[styles.sheetOptionText, styles.sheetOptionDanger]}>Delete</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeNoteMenu}>
            <Text style={styles.sheetCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  )

  const renameModal = (
    <Modal visible={renameModalVisible} transparent animationType="fade" onRequestClose={() => setRenameModalVisible(false)}>
      <View style={styles.sheetOverlay}>
        <View style={styles.sheetCard}>
          <Text style={styles.sheetTitle}>Rename Document</Text>
          <TextInput
            style={styles.renameInput}
            value={renameValue}
            onChangeText={setRenameValue}
            placeholder="Document name"
            placeholderTextColor="#B0ACAA"
            autoFocus
          />
          <View style={styles.renameActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setRenameModalVisible(false); setRenameTarget(null) }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={submitRename}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )

  const confirmModal = (
    <Modal visible={confirmModalVisible} transparent animationType="fade" onRequestClose={() => setConfirmModalVisible(false)}>
      <View style={styles.sheetOverlay}>
        <View style={styles.sheetCard}>
          <Text style={styles.sheetTitle}>Confirm your entry</Text>
          <Text style={styles.confirmBody}>
            Do you confirm that this information is true? Entering false medical history violates the Bridgette user agreement.
          </Text>
          <TouchableOpacity style={styles.confirmPrimaryBtn} onPress={confirmSaveEntry}>
            <Text style={styles.confirmPrimaryBtnText}>Yes, this is accurate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setConfirmModalVisible(false)}>
            <Text style={styles.sheetCloseBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )

  const statusModal = (
    <Modal visible={!!statusModalTarget} transparent animationType="fade" onRequestClose={closeStatusModal}>
      <View style={styles.sheetOverlay}>
        <View style={styles.sheetCard}>
          <Text style={styles.sheetTitle}>How's it going?</Text>
          <Text style={styles.sheetSubtitle} numberOfLines={1}>{statusModalTarget?.diagnosis}</Text>

          <View style={styles.statusChipsWrap}>
            {STATUS_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[styles.statusChip, statusChipSelected === opt && styles.statusChipActive]}
                onPress={() => { setStatusChipSelected(opt); setStatusCustomText('') }}
              >
                <Text style={[styles.statusChipText, statusChipSelected === opt && styles.statusChipTextActive]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Or describe it your own way</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="Type your own status"
            placeholderTextColor="#B0ACAA"
            value={statusCustomText}
            onChangeText={(t) => { setStatusCustomText(t); if (t) setStatusChipSelected(null) }}
          />

          <Text style={styles.fieldLabel}>What did your doctor tell you to do? <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={[styles.fieldInput, styles.fieldInputMultiline]}
            placeholder="e.g. Keep taking metformin, follow up in 3 months"
            placeholderTextColor="#B0ACAA"
            value={statusNotesText}
            onChangeText={setStatusNotesText}
            multiline
            textAlignVertical="top"
          />

          <View style={styles.addFormActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={closeStatusModal}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, savingStatus && { opacity: 0.6 }]}
              onPress={submitStatusUpdate}
              disabled={savingStatus}
            >
              {savingStatus ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )

  const dischargeReasonModal = (
    <Modal visible={dischargeReasonModalVisible} transparent animationType="fade" onRequestClose={() => setDischargeReasonModalVisible(false)}>
      <View style={styles.sheetOverlay}>
        <View style={styles.sheetCard}>
          <Text style={styles.sheetTitle}>Why no referral?</Text>
          <Text style={styles.sheetSubtitle}>This helps keep your health story accurate</Text>

          <TouchableOpacity style={styles.sheetOption} onPress={() => selectDischargeReason('none_needed')}>
            <Text style={styles.sheetOptionText}>The doctor said no referral was needed</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetOption} onPress={() => selectDischargeReason('dama')}>
            <Text style={styles.sheetOptionText}>A referral was suggested, but I decided to go home instead</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setDischargeReasonModalVisible(false)}>
            <Text style={styles.sheetCloseBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )

  const referralModal = (
    <Modal visible={referralModalVisible} transparent animationType="fade" onRequestClose={() => setReferralModalVisible(false)}>
      <View style={styles.sheetOverlay}>
        <View style={styles.sheetCard}>
          <Text style={styles.sheetTitle}>Which service?</Text>
          <Text style={styles.sheetSubtitle}>Who or what were you referred to?</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="e.g. Dr. Cruz, Allergology"
            placeholderTextColor="#B0ACAA"
            value={referralServiceInput}
            onChangeText={setReferralServiceInput}
            autoFocus
          />
          <View style={styles.addFormActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setReferralModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={submitReferralService}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )

  const filterModal = (
    <Modal visible={filterModalVisible} transparent animationType="fade" onRequestClose={() => setFilterModalVisible(false)}>
      <View style={styles.sheetOverlay}>
        <View style={[styles.sheetCard, styles.filterModalCard]}>
          <Text style={styles.sheetTitle}>Filter & Sort</Text>

          <View style={styles.filterSearchBar}>
            <Search size={15} color="#8A7E72" />
            <TextInput
              style={styles.filterSearchInput}
              placeholder="Search filters..."
              placeholderTextColor="#B0ACAA"
              value={filterSearchQuery}
              onChangeText={setFilterSearchQuery}
            />
          </View>

          <ScrollView style={styles.filterCategoryScroll}>
            <TouchableOpacity style={styles.filterCategoryRow} onPress={() => toggleCategory('specialty')}>
              <Text style={styles.filterCategoryLabel}>Specialty</Text>
              {expandedCategory === 'specialty'
                ? <ChevronDown size={16} color="#8A7E72" />
                : <ChevronRight size={16} color="#8A7E72" />}
            </TouchableOpacity>
            {expandedCategory === 'specialty' && (
              <View style={styles.filterOptionsBox}>
                {filteredSpecialties.length === 0 ? (
                  <Text style={styles.filterEmptyText}>No specialties logged yet.</Text>
                ) : (
                  filteredSpecialties.map(s => (
                    <TouchableOpacity
                      key={s}
                      style={styles.filterOptionRow}
                      onPress={() => setSpecialtyFilter(specialtyFilter === s ? null : s)}
                    >
                      <Text style={styles.filterOptionText}>{s}</Text>
                      {specialtyFilter === s && <Check size={16} color="#5C7340" />}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            <TouchableOpacity style={styles.filterCategoryRow} onPress={() => toggleCategory('doctorPresence')}>
              <Text style={styles.filterCategoryLabel}>Doctor on File</Text>
              {expandedCategory === 'doctorPresence'
                ? <ChevronDown size={16} color="#8A7E72" />
                : <ChevronRight size={16} color="#8A7E72" />}
            </TouchableOpacity>
            {expandedCategory === 'doctorPresence' && (
              <View style={styles.filterOptionsBox}>
                {DOCTOR_FILTER_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={styles.filterOptionRow}
                    onPress={() => setDoctorFilter(opt.key)}
                  >
                    <Text style={styles.filterOptionText}>{opt.label}</Text>
                    {doctorFilter === opt.key && <Check size={16} color="#5C7340" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.filterCategoryRow} onPress={() => toggleCategory('sort')}>
              <Text style={styles.filterCategoryLabel}>Sort By</Text>
              {expandedCategory === 'sort'
                ? <ChevronDown size={16} color="#8A7E72" />
                : <ChevronRight size={16} color="#8A7E72" />}
            </TouchableOpacity>
            {expandedCategory === 'sort' && (
              <View style={styles.filterOptionsBox}>
                {SORT_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={styles.filterOptionRow}
                    onPress={() => setSortMode(opt.key)}
                  >
                    <Text style={styles.filterOptionText}>{opt.label}</Text>
                    {sortMode === opt.key && <Check size={16} color="#5C7340" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.filterCategoryRow} onPress={() => toggleCategory('dateRange')}>
              <Text style={styles.filterCategoryLabel}>Date Range</Text>
              {expandedCategory === 'dateRange'
                ? <ChevronDown size={16} color="#8A7E72" />
                : <ChevronRight size={16} color="#8A7E72" />}
            </TouchableOpacity>
            {expandedCategory === 'dateRange' && (
              <View style={styles.filterOptionsBox}>
                <Text style={styles.rangeLabel}>From</Text>
                <TouchableOpacity style={styles.rangeDateBtn} onPress={() => setShowRangeStartPicker(true)}>
                  <Text style={styles.rangeDateBtnText}>
                    {dateRangeStart ? formatDateForDisplay(dateRangeStart) : 'Select start date'}
                  </Text>
                </TouchableOpacity>
                {showRangeStartPicker && (
                  <DateTimePicker
                    value={dateRangeStart || new Date()}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      setShowRangeStartPicker(false)
                      if (selectedDate) setDateRangeStart(selectedDate)
                    }}
                  />
                )}

                <Text style={styles.rangeLabel}>To</Text>
                <TouchableOpacity style={styles.rangeDateBtn} onPress={() => setShowRangeEndPicker(true)}>
                  <Text style={styles.rangeDateBtnText}>
                    {dateRangeEnd ? formatDateForDisplay(dateRangeEnd) : 'Select end date'}
                  </Text>
                </TouchableOpacity>
                {showRangeEndPicker && (
                  <DateTimePicker
                    value={dateRangeEnd || new Date()}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      setShowRangeEndPicker(false)
                      if (selectedDate) setDateRangeEnd(selectedDate)
                    }}
                  />
                )}

                {(dateRangeStart || dateRangeEnd) && (
                  <TouchableOpacity
                    style={styles.rangeClearBtn}
                    onPress={() => { setDateRangeStart(null); setDateRangeEnd(null) }}
                  >
                    <Text style={styles.rangeClearBtnText}>Clear date range</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>

          <View style={styles.filterModalActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setSpecialtyFilter(null); setDoctorFilter('all'); setSortMode('newest'); setDateRangeStart(null); setDateRangeEnd(null) }}
            >
              <Text style={styles.cancelBtnText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={() => setFilterModalVisible(false)}>
              <Text style={styles.saveBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )

  // ── ADD / EDIT FORM SCREEN ──
  if (showAddForm) {
    return (
      <Animated.View entering={SlideInRight.duration(280)} style={styles.pageRoot}>
        <ImageBackground
          source={require('../../assets/medical-history-list-bg.jpg')}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        >
          <View style={styles.bgOverlay} />
        </ImageBackground>
        <ScrollView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={resetForm} style={styles.backBtn}>
              <View style={styles.backRow}>
                <Icon name="back" size={18} color="#5C7340" />
                <Text style={styles.backText}>Back</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.title}>{editingId ? 'Edit Past Diagnosis' : 'Add Past Diagnosis'}</Text>
            <Text style={styles.subtitle}>
              For conditions or visits from before Bridgette, or with a doctor not on the app
            </Text>
          </View>

          <Animated.View entering={FadeIn.duration(300).delay(80)} style={styles.formBody}>
            <Text style={styles.fieldLabel}>Condition / Diagnosis</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. Dengue, Appendectomy, Hypertension"
              placeholderTextColor="#B0ACAA"
              value={formCondition}
              onChangeText={setFormCondition}
            />

            <Text style={styles.fieldLabel}>Date</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
              <Icon name="record" size={16} color="#5C7340" />
              <Text style={styles.dateBtnText}>{formatDateForDisplay(formDate)}</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={formDate}
                mode="date"
                display="default"
                maximumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false)
                  if (selectedDate) setFormDate(selectedDate)
                }}
              />
            )}

            <Text style={styles.fieldLabel}>Doctor's Name <Text style={styles.optional}>(if you remember)</Text></Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. Dr. Santos"
              placeholderTextColor="#B0ACAA"
              value={formDoctorName}
              onChangeText={setFormDoctorName}
            />

            <Text style={styles.fieldLabel}>Specialty <Text style={styles.optional}>(if you remember)</Text></Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. Cardiologist, Pediatrician"
              placeholderTextColor="#B0ACAA"
              value={formDoctorSpecialty}
              onChangeText={setFormDoctorSpecialty}
            />

            <TouchableOpacity
              style={styles.emergencyToggleRow}
              onPress={() => setFormIsEmergency(!formIsEmergency)}
              activeOpacity={0.7}
            >
              <View style={[styles.emergencyCheckbox, formIsEmergency && styles.emergencyCheckboxActive]}>
                {formIsEmergency && <Check size={14} color="#fff" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emergencyToggleLabel}>This was an emergency / ER visit</Text>
                <Text style={styles.emergencyToggleHint}>e.g. rushed to the ER, urgent care visit</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Where did you visit?</Text>
            <View style={styles.visitTypeRow}>
              {VISIT_TYPES.map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.visitTypeChip, formVisitType === type && styles.visitTypeChipActive]}
                  onPress={() => setFormVisitType(formVisitType === type ? null : type)}
                >
                  <Text style={[styles.visitTypeChipText, formVisitType === type && styles.visitTypeChipTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Clinic / Hospital Name <Text style={styles.optional}>(if you remember)</Text></Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. Makati Medical Center"
              placeholderTextColor="#B0ACAA"
              value={formFacilityName}
              onChangeText={setFormFacilityName}
            />

            <Text style={styles.fieldLabel}>Medications Prescribed <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldInputMultiline]}
              placeholder="e.g. Cetirizine 10mg, Epinephrine auto-injector"
              placeholderTextColor="#B0ACAA"
              value={formMedications}
              onChangeText={setFormMedications}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Did you get referred to another service?</Text>
            <View style={styles.visitTypeRow}>
              <TouchableOpacity
                style={[styles.visitTypeChip, formReferralAnswer === 'yes' && styles.visitTypeChipActive]}
                onPress={handleReferralYesPress}
              >
                <Text style={[styles.visitTypeChipText, formReferralAnswer === 'yes' && styles.visitTypeChipTextActive]}>
                  Yes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.visitTypeChip, formReferralAnswer === 'no' && styles.visitTypeChipActive]}
                onPress={handleReferralNo}
              >
                <Text style={[styles.visitTypeChipText, formReferralAnswer === 'no' && styles.visitTypeChipTextActive]}>
                  No, I was discharged
                </Text>
              </TouchableOpacity>
            </View>
            {formReferralAnswer === 'yes' && formReferredTo ? (
              <TouchableOpacity style={styles.referralSummaryRow} onPress={handleReferralYesPress}>
                <Text style={styles.referralSummaryText}>Referred to: {formReferredTo}</Text>
                <Pencil size={13} color="#5C7340" />
              </TouchableOpacity>
            ) : null}

            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldInputMultiline]}
              placeholder="Any details you remember"
              placeholderTextColor="#B0ACAA"
              value={formNotes}
              onChangeText={setFormNotes}
              multiline
              textAlignVertical="top"
            />

            {editingId && (
              <>
                <Text style={styles.fieldLabel}>Existing Documents</Text>
                {loadingExistingDocs ? (
                  <ActivityIndicator size="small" color="#5C7340" style={{ marginBottom: 10 }} />
                ) : existingDocuments.length === 0 ? (
                  <Text style={styles.noRecordsText}>No documents attached yet.</Text>
                ) : (
                  existingDocuments.map((doc, i) => (
                    <Animated.View
                      key={doc.id}
                      entering={FadeInRight.duration(220).delay(i * 40)}
                      style={styles.attachedFileRow}
                    >
                      <TouchableOpacity
                        style={styles.attachedFileTouchable}
                        onPress={() => openExistingDocument(doc)}
                      >
                        <Text style={styles.attachedFileText} numberOfLines={1}>
                          {doc.lab_facility} · {doc.record_date}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => openDocMenu(doc)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={styles.menuDotsBtn}
                      >
                        <MoreVertical size={16} color="#8A7E72" />
                      </TouchableOpacity>
                    </Animated.View>
                  ))
                )}
              </>
            )}

            <Text style={styles.fieldLabel}>
              {editingId ? 'Add More Documents' : 'Related Documents'} <Text style={styles.optional}>(optional)</Text>
            </Text>
            {attachedFiles.map((file, index) => (
              <Animated.View
                key={index}
                entering={FadeInRight.duration(220)}
                style={styles.attachedFileRow}
              >
                <Text style={styles.attachedFileText} numberOfLines={1}>
                  {file.type === 'pdf' ? 'PDF document' : `Photo ${index + 1}`}
                </Text>
                <TouchableOpacity onPress={() => removeAttachedFile(index)}>
                  <Icon name="delete" size={16} color="#B5451B" />
                </TouchableOpacity>
              </Animated.View>
            ))}
            <TouchableOpacity style={styles.attachBtn} onPress={handleAttachFile} activeOpacity={0.7}>
              <Text style={styles.attachBtnText}>+ Attach Discharge Paper, Lab, etc.</Text>
            </TouchableOpacity>

            <Text style={styles.disclaimerText}>
              You are responsible for the accuracy of the information you provide here. Entering false or fabricated medical history is a violation of the Bridgette user agreement, and it can affect your relationship with your care team and lead to misdiagnosis from your doctors.
            </Text>

            <View style={styles.addFormActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={resetForm} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSavePress}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>{editingId ? 'Update' : 'Save'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
          <View style={{ height: 40 }} />
        </ScrollView>

        {viewerModal}
        {docMenuModal}
        {renameModal}
        {confirmModal}
        {referralModal}
        {dischargeReasonModal}
      </Animated.View>
    )
  }

  // ── LIST SCREEN ──
  return (
    <View style={styles.pageRoot}>
      <ImageBackground
        source={require('../../assets/medical-history-list-bg.jpg')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      >
        <View style={styles.bgOverlay} />
      </ImageBackground>
      <ScrollView style={styles.container}>
        <ImageBackground
          source={require('../../assets/medical-history-header.jpg')}
          style={styles.header}
          imageStyle={styles.headerImage}
        >
          <View style={styles.headerOverlay} />
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <View style={styles.backRow}>
              <Icon name="back" size={18} color="#fff" />
              <Text style={styles.backTextOnImage}>Back</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.titleOnImage}>Medical History</Text>
          <Text style={styles.subtitleOnImage}>
            {filteredNotes.length} of {notes.length} entr{notes.length !== 1 ? 'ies' : 'y'}
          </Text>
        </ImageBackground>

        <View style={styles.searchFilterRow}>
          <View style={styles.searchBar}>
            <Search size={16} color="#8A7E72" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search anything..."
              placeholderTextColor="#B0ACAA"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity style={styles.filterBtn} onPress={openFilterModal}>
            <SlidersHorizontal size={16} color="#5C7340" />
            {activeFilterTags.length > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterTags.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {activeFilterTags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeTagsRow}>
            {activeFilterTags.map(tag => (
              <View key={tag.key} style={styles.activeTag}>
                <Text style={styles.activeTagText}>{tag.label}</Text>
                <TouchableOpacity onPress={tag.onRemove} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <X size={12} color="#5C7340" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#5C7340" />
        ) : filteredNotes.length === 0 ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{notes.length === 0 ? 'No history yet' : 'No matching entries'}</Text>
            <Text style={styles.emptyText}>
              {notes.length === 0
                ? 'Notes from your doctors will appear here, or add a past diagnosis yourself'
                : 'Try adjusting your search or filters'}
            </Text>
          </Animated.View>
        ) : (
          <View style={styles.notesList}>
            {filteredNotes.map((note, index) => {
              const isExpanded = expandedId === note.id
              const isSelfReported = note.source === 'patient'
              const showingRecords = showingRecordsFor === note.id
              const recordsForThis = relatedRecords[note.id] || []

              return (
                <Animated.View
                  key={note.id}
                  entering={FadeInDown.duration(320).delay(index * 60)}
                  layout={Layout.springify()}
                  style={styles.noteCard}
                >
                  <TouchableOpacity
                    style={styles.noteHeader}
                    onPress={() => setExpandedId(isExpanded ? null : note.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.noteHeaderInfo}>
                      <View style={styles.noteDateRow}>
                        <Text style={styles.noteDate}>
                          {formatDateForCard(note.visit_date)}
                          {getRelativeTime(note.visit_date) ? ` · ${getRelativeTime(note.visit_date)}` : ''}
                        </Text>
                        {isSelfReported && (
                          <View style={styles.selfReportedBadge}>
                            <Text style={styles.selfReportedBadgeText}>Self-reported</Text>
                          </View>
                        )}
                        {note.is_emergency && (
                          <View style={styles.emergencyBadge}>
                            <AlertTriangle size={11} color="#fff" />
                            <Text style={styles.emergencyBadgeText}>Emergency</Text>
                          </View>
                        )}
                        {note.status && (
                          <View style={styles.statusBadge}>
                            <Text style={styles.statusBadgeText}>{note.status}</Text>
                          </View>
                        )}
                        {isSelfReported && note.ai_validation_status === 'matched' && (
                          <View style={styles.matchedBadge}>
                            <Text style={styles.matchedBadgeText}>Matches documents</Text>
                          </View>
                        )}
                        {isSelfReported && note.ai_validation_status === 'mismatch' && (
                          <View style={styles.mismatchBadge}>
                            <Text style={styles.mismatchBadgeText}>Check documents</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.noteComplaint} numberOfLines={isExpanded ? undefined : 1}>
                        {note.chief_complaint}
                      </Text>
                      {(note.facility_name || note.visit_type) && (
                        <Text style={styles.noteFacility}>
                          {note.facility_name || note.visit_type}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.updateStatusBtn}
                      onPress={(e) => { e.stopPropagation(); openStatusModal(note) }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Activity size={13} color="#5C7340" />
                      <Text style={styles.updateStatusBtnText}>{note.status ? 'Update' : "How's it going?"}</Text>
                    </TouchableOpacity>
                    <View style={styles.headerIconStack}>
                      {isSelfReported && (
                        <TouchableOpacity
                          onPress={(e) => { e.stopPropagation(); openNoteMenu(note) }}
                          hitSlop={{ top: 6, bottom: 6, left: 10, right: 10 }}
                        >
                          <MoreVertical size={18} color="#5C7340" />
                        </TouchableOpacity>
                      )}
                      <ChevronDown
                        size={18}
                        color="#8A7E72"
                        style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                      />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <Animated.View entering={FadeIn.duration(220)} style={styles.noteBody}>
                      {!isSelfReported && (
                        <View style={styles.noteSection}>
                          <Text style={styles.noteSectionLabel}>Chief Complaint</Text>
                          <Text style={styles.noteSectionText}>{note.chief_complaint}</Text>
                        </View>
                      )}
                      <View style={styles.noteSection}>
                        <Text style={styles.noteSectionLabel}>Diagnosis</Text>
                        <Text style={styles.noteSectionText}>{note.diagnosis}</Text>
                      </View>
                      <View style={styles.noteSection}>
                        <Text style={styles.noteSectionLabel}>Physician</Text>
                        <Text style={styles.noteSectionText}>
                          {note.doctor_name || note.doctor_specialty
                            ? `${note.doctor_name || ''}${note.doctor_name && note.doctor_specialty ? ' · ' : ''}${note.doctor_specialty || ''}`
                            : 'No Physician logged'}
                        </Text>
                      </View>
                      <View style={styles.noteSection}>
                        <Text style={styles.noteSectionLabel}>
                          {isSelfReported ? 'Notes' : 'Next Steps'}
                        </Text>
                        <Text style={styles.noteSectionText}>{note.next_steps}</Text>
                      </View>
                      {note.status_notes && (
                        <View style={styles.noteSection}>
                          <Text style={styles.noteSectionLabel}>What Your Doctor Said</Text>
                          <Text style={styles.noteSectionText}>{note.status_notes}</Text>
                        </View>
                      )}
                      {note.medications_prescribed && (
                        <View style={styles.noteSection}>
                          <Text style={styles.noteSectionLabel}>Medications Prescribed</Text>
                          <Text style={styles.noteSectionText}>{note.medications_prescribed}</Text>
                        </View>
                      )}
                      {note.referred_to && (
                        <View style={styles.noteSection}>
                          <Text style={styles.noteSectionLabel}>Referred To</Text>
                          <Text style={styles.noteSectionText}>{note.referred_to}</Text>
                        </View>
                      )}
                      {note.ai_validation_notes && (
                        <View style={styles.noteSection}>
                          <Text style={styles.noteSectionLabel}>Document Check</Text>
                          <Text style={styles.noteSectionText}>{note.ai_validation_notes}</Text>
                        </View>
                      )}

                      <TouchableOpacity
                        style={[styles.viewRecordsBtn, !showingRecords && styles.viewRecordsBtnActive]}
                        onPress={() => fetchRelatedRecords(note.id, true)}
                        activeOpacity={0.7}
                      >
                        {loadingRecordsFor === note.id ? (
                          <ActivityIndicator size="small" color={!showingRecords ? '#fff' : '#5C7340'} />
                        ) : (
                          <Text style={[styles.viewRecordsBtnText, !showingRecords && styles.viewRecordsBtnTextActive]}>
                            {showingRecords ? 'Hide Related Records' : 'View Related Records'}
                          </Text>
                        )}
                      </TouchableOpacity>

                      {showingRecords && (
                        recordsForThis.length === 0 ? (
                          <Text style={styles.noRecordsText}>No documents attached to this entry.</Text>
                        ) : (
                          <Animated.View entering={FadeIn.duration(220)} style={styles.relatedRecordsList}>
                            {recordsForThis.map((rec, i) => (
                              <Animated.View key={rec.id} entering={FadeInRight.duration(220).delay(i * 40)}>
                                <TouchableOpacity
                                  style={styles.relatedRecordRow}
                                  onPress={() => openRecordFile(rec)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.relatedRecordText}>
                                    {note.diagnosis} - {note.visit_date} - {note.facility_name || note.doctor_specialty || 'No facility noted'}
                                  </Text>
                                </TouchableOpacity>
                              </Animated.View>
                            ))}
                          </Animated.View>
                        )
                      )}
                    </Animated.View>
                  )}
                </Animated.View>
              )
            })}
          </View>
        )}

        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddForm(true)} activeOpacity={0.85}>
          <Text style={styles.addBtnText}>+ Add Past Diagnosis</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />

        {viewerModal}
        {noteMenuModal}
        {confirmModal}
        {filterModal}
        {statusModal}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  pageRoot: { flex: 1, backgroundColor: '#F5F2EC' },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(245,242,236,0.86)' },
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
  headerImage: { resizeMode: 'cover' },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(61,50,41,0.85)',
  },
  backTextOnImage: { fontSize: 16, color: '#fff', fontWeight: '600' },
  titleOnImage: { fontFamily: 'Georgia', fontSize: 22, color: '#fff', marginBottom: 3 },
  subtitleOnImage: { fontSize: 13, color: '#F0EAE0' },
  statusBadge: {
    backgroundColor: '#EBEFE3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '600', color: '#5C7340' },
  emergencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#B5451B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  emergencyBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  emergencyToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F9E5DE',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8C9AC',
  },
  emergencyCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#B5451B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyCheckboxActive: { backgroundColor: '#B5451B', borderColor: '#B5451B' },
  emergencyToggleLabel: { fontSize: 13, fontWeight: '600', color: '#3D3229' },
  emergencyToggleHint: { fontSize: 11, color: '#8A7E72', marginTop: 1 },
  referralSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EBEFE3',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  referralSummaryText: { fontSize: 13, color: '#3D3229', flex: 1 },
  updateStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#5C7340',
  },
  updateStatusBtnText: { fontSize: 11, fontWeight: '600', color: '#5C7340' },
  statusChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 4 },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5DFD3',
    backgroundColor: '#F5F2EC',
  },
  statusChipActive: { backgroundColor: '#5C7340', borderColor: '#5C7340' },
  statusChipText: { fontSize: 12, color: '#3D3229', fontWeight: '600' },
  statusChipTextActive: { color: '#fff' },
  searchFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5DFD3',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#3D3229' },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#5C7340',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#C4611A',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  activeTagsRow: { paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EBEFE3',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeTagText: { fontSize: 12, color: '#5C7340', fontWeight: '600' },
  formBody: { padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40, gap: 4 },
  emptyTitle: { fontFamily: 'Georgia', fontSize: 20, color: '#3D3229', marginTop: 12, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#8A7E72', textAlign: 'center', lineHeight: 20 },
  notesList: { padding: 16 },
  noteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#5C7340',
    overflow: 'hidden',
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 8,
  },
  noteHeaderInfo: { flex: 1 },
  noteDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' },
  noteDate: { fontSize: 12, color: '#8A7E72' },
  selfReportedBadge: {
    backgroundColor: '#F6EDDA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  selfReportedBadgeText: { fontSize: 10, fontWeight: '600', color: '#C4922A' },
  matchedBadge: {
    backgroundColor: '#EBEFE3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  matchedBadgeText: { fontSize: 10, fontWeight: '600', color: '#5C7340' },
  mismatchBadge: {
    backgroundColor: '#F9E5DE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  mismatchBadgeText: { fontSize: 10, fontWeight: '600', color: '#B5451B' },
  noteComplaint: { fontSize: 14, fontWeight: '700', color: '#1A1A16' },
  noteDoctor: { fontSize: 12, color: '#8A7E72', marginTop: 2 },
  noteFacility: { fontSize: 12, color: '#8A7E72', fontStyle: 'italic', marginTop: 1 },
  editIconBtn: { padding: 6 },
  headerIconStack: { alignItems: 'center', gap: 6 },
  noteBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#EFDCC7',
    paddingTop: 12,
    gap: 12,
  },
  noteSection: { gap: 4 },
  noteSectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: '#C4611A' },
  noteSectionText: { fontSize: 13, color: '#3D3229', lineHeight: 19 },
  viewRecordsBtn: {
    borderWidth: 1,
    borderColor: '#C4611A',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  viewRecordsBtnActive: {
    backgroundColor: '#C4611A',
  },
  viewRecordsBtnText: { fontSize: 13, color: '#C4611A', fontWeight: '600' },
  viewRecordsBtnTextActive: { color: '#fff' },
  noRecordsText: { fontSize: 12, color: '#8A7E72', fontStyle: 'italic' },
  relatedRecordsList: { gap: 6 },
  relatedRecordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
  },
  relatedRecordText: { flex: 1, fontSize: 12, color: '#3D3229' },
  addBtn: {
    backgroundColor: '#5C7340',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: '#8A7E72', marginBottom: 6, marginTop: 12 },
  optional: { fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
  fieldInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#3D3229',
    borderWidth: 1,
    borderColor: '#E5DFD3',
  },
  fieldInputMultiline: { minHeight: 80 },
  dateBtn: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5DFD3',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateBtnText: { fontSize: 14, color: '#3D3229' },
  visitTypeRow: { flexDirection: 'row', gap: 8 },
  visitTypeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5DFD3',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  visitTypeChipActive: {
    backgroundColor: '#5C7340',
    borderColor: '#5C7340',
  },
  visitTypeChipText: { fontSize: 13, color: '#3D3229', fontWeight: '600' },
  visitTypeChipTextActive: { color: '#fff' },
  attachedFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E5DFD3',
  },
  attachedFileTouchable: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  attachedFileText: { flex: 1, fontSize: 13, color: '#3D3229' },
  menuDotsBtn: { padding: 4 },
  attachBtn: {
    borderWidth: 1,
    borderColor: '#5C7340',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  attachBtnText: { fontSize: 13, color: '#5C7340', fontWeight: '600' },
  disclaimerText: {
    fontSize: 11,
    color: '#8A7E72',
    lineHeight: 16,
    marginTop: 14,
    fontStyle: 'italic',
  },
  addFormActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E5DFD3', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: '#8A7E72', fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: '#5C7340', padding: 14, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  viewerContainer: { flex: 1, backgroundColor: '#000' },
  viewerHeader: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 },
  viewerCloseText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  viewerImageScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: 500 },
  viewerPdfBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  viewerPdfText: { color: '#fff', fontSize: 15, marginBottom: 20, textAlign: 'center' },
  viewerPdfBtn: { backgroundColor: '#5C7340', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 10 },
  viewerPdfBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(61,50,41,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheetCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  sheetTitle: { fontFamily: 'Georgia', fontSize: 18, color: '#3D3229', marginBottom: 2 },
  sheetSubtitle: { fontSize: 13, color: '#8A7E72', marginBottom: 16 },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0EAE0',
  },
  sheetOptionText: { fontSize: 15, color: '#3D3229', fontWeight: '500' },
  sheetOptionDanger: { color: '#B5451B' },
  sheetCloseBtn: {
    marginTop: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F5F2EC',
    borderRadius: 10,
  },
  sheetCloseBtnText: { fontSize: 15, color: '#3D3229', fontWeight: '600' },
  renameInput: {
    backgroundColor: '#F5F2EC',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#3D3229',
    borderWidth: 1,
    borderColor: '#E5DFD3',
    marginBottom: 16,
  },
  renameActions: { flexDirection: 'row', gap: 10 },
  confirmBody: { fontSize: 14, color: '#3D3229', lineHeight: 20, marginBottom: 20 },
  confirmPrimaryBtn: {
    backgroundColor: '#5C7340',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmPrimaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  filterModalCard: { maxHeight: '80%' },
  filterSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F2EC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5DFD3',
  },
  filterSearchInput: { flex: 1, fontSize: 14, color: '#3D3229' },
  filterCategoryScroll: { maxHeight: 320 },
  filterCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0EAE0',
  },
  filterCategoryLabel: { fontSize: 14, color: '#3D3229', fontWeight: '600' },
  filterOptionsBox: { paddingBottom: 8, gap: 2 },
  filterOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F5F2EC',
    borderRadius: 8,
    marginBottom: 4,
  },
  filterOptionText: { fontSize: 13, color: '#3D3229' },
  filterEmptyText: { fontSize: 12, color: '#8A7E72', fontStyle: 'italic', paddingVertical: 8 },
  filterModalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  rangeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: '#8A7E72', marginBottom: 6, marginTop: 8 },
  rangeDateBtn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5DFD3',
  },
  rangeDateBtnText: { fontSize: 13, color: '#3D3229' },
  rangeClearBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 8 },
  rangeClearBtnText: { fontSize: 12, color: '#B5451B', fontWeight: '600' },
})