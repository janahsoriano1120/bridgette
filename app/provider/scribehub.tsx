import { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Audio } from 'expo-av'

type Patient = {
  id: string
  full_name: string
  isBridgette?: boolean
  email?: string
}

type SOAPNotes = {
  subjective: string
  objective: string
  assessment: string
  plan: string
}

type Mode = 'select_patient' | 'select_method' | 'record' | 'manual' | 'review' | 'sent'

const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_KEY
const ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_KEY

export default function ScribeHubScreen({
  patients,
  onBack,
}: {
  patients: Patient[]
  onBack: () => void
}) {
  const [mode, setMode] = useState<Mode>('select_patient')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [transcription, setTranscription] = useState('')
  const [transcribing, setTranscribing] = useState(false)
  const [recordingUri, setRecordingUri] = useState<string | null>(null)
  const [manualNotes, setManualNotes] = useState('')
  const [soap, setSoap] = useState<SOAPNotes | null>(null)
  const [generating, setGenerating] = useState(false)
  const [patientEmail, setPatientEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [nonBridgetteName, setNonBridgetteName] = useState('')
  const [nonBridgetteEmail, setNonBridgetteEmail] = useState('')
  const [showNonBridgetteForm, setShowNonBridgetteForm] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingRef = useRef<Audio.Recording | null>(null)
  const soundRef = useRef<Audio.Sound | null>(null)

  async function startRecording() {
    try {
      const { granted } = await Audio.requestPermissionsAsync()
      if (!granted) {
        Alert.alert('Microphone permission required', 'Please allow microphone access to record consultations.')
        return
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      recordingRef.current = recording
      setIsRecording(true)
      setRecordingSeconds(0)
      setRecordingUri(null)
      setTranscription('')
      timerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1)
      }, 1000)
    } catch (e) {
      Alert.alert('Error', 'Could not start recording. Please try again.')
    }
  }

  async function stopRecording() {
    if (!recordingRef.current) return
    setIsRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
    try {
      await recordingRef.current.stopAndUnloadAsync()
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false })
      const uri = recordingRef.current.getURI()
      recordingRef.current = null
      if (uri) {
        setRecordingUri(uri)
        await transcribeAudio(uri)
      }
    } catch (e) {
      Alert.alert('Error', 'Could not process recording.')
    }
  }

  async function playRecording() {
    if (!recordingUri) return
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync()
        soundRef.current = null
      }
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false })
      const { sound } = await Audio.Sound.createAsync({ uri: recordingUri })
      soundRef.current = sound
      setIsPlaying(true)
      await sound.playAsync()
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false)
        }
      })
    } catch (e) {
      Alert.alert('Error', 'Could not play recording.')
      setIsPlaying(false)
    }
  }

  async function pausePlayback() {
    if (soundRef.current) {
      await soundRef.current.pauseAsync()
      setIsPlaying(false)
    }
  }

  async function transcribeAudio(uri: string) {
    setTranscribing(true)
    try {
      const formData = new FormData()
      formData.append('file', {
        uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any)
      formData.append('model', 'whisper-large-v3')
      formData.append('language', 'tl')
      formData.append('response_format', 'text')

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_KEY}` },
        body: formData,
      })

      if (!response.ok) throw new Error(`Transcription failed: ${response.status}`)
      const text = await response.text()
      setTranscription(text)
    } catch (e) {
      console.log('Transcription error:', e)
      Alert.alert('Transcription failed', 'Could not transcribe audio. Please try the manual method.')
    } finally {
      setTranscribing(false)
    }
  }

  async function generateSOAP(text: string) {
    setGenerating(true)
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1500,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'You are a medical scribe. Always respond with valid JSON only. No explanations, no markdown.',
            },
            {
              role: 'user',
              content: `Convert these consultation notes (may be in Filipino, Tagalog, English, or Taglish) into a SOAP note in professional English. Return a JSON object with exactly these keys: subjective, objective, assessment, plan. Each value is a paragraph string.
  
  Notes:
  ${text}`,
            }
          ],
        }),
      })
      const data = await response.json()
      console.log('Groq response:', JSON.stringify(data))
      const raw = data.choices[0].message.content.trim()
      const parsed = JSON.parse(raw)
      setSoap(parsed)
      setMode('review')
    } catch (e) {
      console.log('SOAP generation error:', e)
      Alert.alert('Error', 'Could not generate SOAP notes. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function sendToPatient() {
    if (!selectedPatient?.isBridgette && !patientEmail.trim() && !selectedPatient?.email) {
      Alert.alert('Please enter the patient\'s email address')
      return
    }
    setSending(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    setSending(false)
    setMode('sent')
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  function reset() {
    setMode('select_patient')
    setSelectedPatient(null)
    setTranscription('')
    setManualNotes('')
    setSoap(null)
    setPatientEmail('')
    setRecordingSeconds(0)
    setIsRecording(false)
    setIsPlaying(false)
    setRecordingUri(null)
    setNonBridgetteName('')
    setNonBridgetteEmail('')
    setShowNonBridgetteForm(false)
    if (soundRef.current) { soundRef.current.unloadAsync(); soundRef.current = null }
  }

  function confirmNonBridgettePatient() {
    if (!nonBridgetteName.trim()) { Alert.alert('Please enter the patient\'s name'); return }
    setSelectedPatient({ id: 'non-bridgette', full_name: nonBridgetteName.trim(), isBridgette: false, email: nonBridgetteEmail.trim() })
    setMode('select_method')
  }

  // ── SELECT PATIENT ──
  if (mode === 'select_patient') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Dashboard</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Scribe Hub</Text>
          <Text style={styles.subtitle}>AI-powered consultation notes</Text>
        </View>
        <ScrollView style={styles.content}>
          <View style={styles.stepBanner}>
            <Text style={styles.stepNum}>01</Text>
            <View style={styles.stepInfo}>
              <Text style={styles.stepTitle}>Select a patient</Text>
              <Text style={styles.stepDesc}>Who is this consultation for?</Text>
            </View>
          </View>

          <Text style={styles.groupLabel}>BRIDGETTE PATIENTS</Text>
          {patients.map(patient => (
            <TouchableOpacity
              key={patient.id}
              style={styles.patientSelectCard}
              onPress={() => { setSelectedPatient({ ...patient, isBridgette: true }); setMode('select_method') }}
            >
              <View style={styles.patientSelectAvatar}>
                <Text style={styles.patientSelectAvatarText}>{patient.full_name.charAt(0)}</Text>
              </View>
              <View style={styles.patientSelectInfo}>
                <Text style={styles.patientSelectName}>{patient.full_name}</Text>
                <View style={styles.bridgetteBadge}>
                  <Text style={styles.bridgetteBadgeText}>On Bridgette</Text>
                </View>
              </View>
              <Text style={styles.patientSelectArrow}>→</Text>
            </TouchableOpacity>
          ))}

          <Text style={[styles.groupLabel, { marginTop: 20 }]}>NON-BRIDGETTE PATIENT</Text>
          {!showNonBridgetteForm ? (
            <TouchableOpacity style={styles.nonBridgetteBtn} onPress={() => setShowNonBridgetteForm(true)}>
              <Text style={styles.nonBridgetteBtnIcon}>➕</Text>
              <View>
                <Text style={styles.nonBridgetteBtnTitle}>Patient not on Bridgette?</Text>
                <Text style={styles.nonBridgetteBtnDesc}>Add their name and email to send notes</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.nonBridgetteForm}>
              <Text style={styles.fieldLabel}>Patient Name</Text>
              <TextInput style={styles.fieldInput} placeholder="e.g. Maria Santos" placeholderTextColor="#999" value={nonBridgetteName} onChangeText={setNonBridgetteName} />
              <Text style={styles.fieldLabel}>Email Address <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput style={styles.fieldInput} placeholder="patient@email.com" placeholderTextColor="#999" value={nonBridgetteEmail} onChangeText={setNonBridgetteEmail} keyboardType="email-address" autoCapitalize="none" />
              <View style={styles.nonBridgetteFormActions}>
                <TouchableOpacity style={styles.cancelSmallBtn} onPress={() => setShowNonBridgetteForm(false)}>
                  <Text style={styles.cancelSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmSmallBtn} onPress={confirmNonBridgettePatient}>
                  <Text style={styles.confirmSmallBtnText}>Continue →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    )
  }

  // ── SELECT METHOD ──
  if (mode === 'select_method') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('select_patient')} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Scribe Hub</Text>
          <Text style={styles.subtitle}>Notes for {selectedPatient?.full_name}</Text>
        </View>
        <ScrollView style={styles.content}>
          <View style={styles.stepBanner}>
            <Text style={styles.stepNum}>02</Text>
            <View style={styles.stepInfo}>
              <Text style={styles.stepTitle}>How would you like to create notes?</Text>
              <Text style={styles.stepDesc}>Choose your preferred method</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.methodCard} onPress={() => setMode('record')}>
            <View style={styles.methodIconBg}>
              <Text style={styles.methodIcon}>🎙</Text>
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodTitle}>Record & Transcribe</Text>
              <Text style={styles.methodDesc}>Speak in English, Filipino, or Taglish. Groq Whisper AI transcribes accurately then generates SOAP notes.</Text>
              <View style={styles.methodBadge}><Text style={styles.methodBadgeText}>✨ Recommended</Text></View>
            </View>
            <Text style={styles.methodArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.methodCard} onPress={() => setMode('manual')}>
            <View style={[styles.methodIconBg, { backgroundColor: '#F4F2EE' }]}>
              <Text style={styles.methodIcon}>✍️</Text>
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodTitle}>Write Manually</Text>
              <Text style={styles.methodDesc}>Type your notes in English or Filipino. AI will structure them into SOAP format.</Text>
            </View>
            <Text style={styles.methodArrow}>→</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    )
  }

  // ── RECORD ──
  if (mode === 'record') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('select_method')} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Record Consultation</Text>
          <Text style={styles.subtitle}>{selectedPatient?.full_name}</Text>
        </View>
        <ScrollView style={styles.content}>
          <View style={styles.stepBanner}>
            <Text style={styles.stepNum}>03</Text>
            <View style={styles.stepInfo}>
              <Text style={styles.stepTitle}>Record your consultation</Text>
              <Text style={styles.stepDesc}>Speak in English, Filipino, or Taglish</Text>
            </View>
          </View>

          <View style={styles.recordCard}>
            <View style={[styles.recordOrb, isRecording && styles.recordOrbActive]}>
              <Text style={styles.recordOrbIcon}>{isRecording ? '⏹' : '🎙'}</Text>
            </View>
            <Text style={styles.recordTimer}>{formatTime(recordingSeconds)}</Text>
            <Text style={styles.recordStatus}>
              {transcribing ? 'Transcribing your recording...' :
               isRecording ? 'Recording... speak clearly' :
               transcription ? 'Recording complete' :
               'Tap to start recording'}
            </Text>

            {transcribing && <ActivityIndicator color="#C8524A" style={{ marginTop: 8 }} />}

            {/* Record / Stop button */}
            {!transcribing && (
              !isRecording && !transcription ? (
                <TouchableOpacity style={styles.recordBtn} onPress={startRecording}>
                  <Text style={styles.recordBtnText}>Start Recording</Text>
                </TouchableOpacity>
              ) : isRecording ? (
                <TouchableOpacity style={[styles.recordBtn, { backgroundColor: '#C8524A' }]} onPress={stopRecording}>
                  <Text style={styles.recordBtnText}>Stop Recording</Text>
                </TouchableOpacity>
              ) : null
            )}

            {/* Playback controls — show after recording done */}
            {recordingUri && !isRecording && !transcribing && (
              <View style={styles.playbackRow}>
                <TouchableOpacity
                  style={styles.playBtn}
                  onPress={isPlaying ? pausePlayback : playRecording}
                >
                  <Text style={styles.playBtnIcon}>{isPlaying ? '⏸' : '▶️'}</Text>
                  <Text style={styles.playBtnText}>{isPlaying ? 'Pause' : 'Play Recording'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.reRecordBtn} onPress={startRecording}>
                  <Text style={styles.reRecordBtnText}>🔄 Re-record</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {transcription ? (
            <>
              <View style={styles.transcriptCard}>
                <Text style={styles.transcriptTitle}>📄 Transcription</Text>
                <Text style={styles.transcriptHint}>You can edit this before generating SOAP notes</Text>
                <TextInput
                  style={styles.transcriptInput}
                  multiline
                  value={transcription}
                  onChangeText={setTranscription}
                  textAlignVertical="top"
                />
              </View>

              {generating ? (
                <View style={styles.generatingCard}>
                  <ActivityIndicator color="#C8524A" />
                  <Text style={styles.generatingText}>Generating SOAP notes...</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.generateBtn} onPress={() => generateSOAP(transcription)}>
                  <Text style={styles.generateBtnText}>✨ Generate SOAP Notes</Text>
                </TouchableOpacity>
              )}
            </>
          ) : null}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    )
  }

  // ── MANUAL ──
  if (mode === 'manual') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('select_method')} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Write Notes</Text>
          <Text style={styles.subtitle}>{selectedPatient?.full_name}</Text>
        </View>
        <ScrollView style={styles.content}>
          <View style={styles.stepBanner}>
            <Text style={styles.stepNum}>03</Text>
            <View style={styles.stepInfo}>
              <Text style={styles.stepTitle}>Write your consultation notes</Text>
              <Text style={styles.stepDesc}>Type in English or Filipino — AI structures into SOAP format</Text>
            </View>
          </View>

          <TextInput
            style={styles.manualInput}
            placeholder={'Type your consultation notes here...\n\ne.g. Patient presents for follow-up. BP 120/80. Nagrereklamo ng slight fatigue...'}
            placeholderTextColor="#B0ACAA"
            multiline
            value={manualNotes}
            onChangeText={setManualNotes}
            textAlignVertical="top"
          />

          <View style={styles.manualActions}>
            <TouchableOpacity style={styles.saveNotesBtn} onPress={() => Alert.alert('Notes saved', 'Your notes have been saved.')}>
              <Text style={styles.saveNotesBtnText}>💾 Save Notes</Text>
            </TouchableOpacity>

            {manualNotes.length > 20 && (
              generating ? (
                <View style={styles.generatingCard}>
                  <ActivityIndicator color="#C8524A" />
                  <Text style={styles.generatingText}>Generating SOAP notes...</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.generateBtn} onPress={() => generateSOAP(manualNotes)}>
                  <Text style={styles.generateBtnText}>✨ Generate SOAP Notes</Text>
                </TouchableOpacity>
              )
            )}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    )
  }

  // ── REVIEW ──
  if (mode === 'review' && soap) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('select_method')} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Review SOAP Notes</Text>
          <Text style={styles.subtitle}>{selectedPatient?.full_name}</Text>
        </View>
        <ScrollView style={styles.content}>
          <View style={styles.stepBanner}>
            <Text style={styles.stepNum}>04</Text>
            <View style={styles.stepInfo}>
              <Text style={styles.stepTitle}>Review & send to patient</Text>
              <Text style={styles.stepDesc}>Edit if needed, then send to your patient</Text>
            </View>
          </View>

          {[
            { key: 'subjective', label: 'S — Subjective', color: '#3D7A5E' },
            { key: 'objective', label: 'O — Objective', color: '#2C5FAB' },
            { key: 'assessment', label: 'A — Assessment', color: '#B5720A' },
            { key: 'plan', label: 'P — Plan', color: '#C8524A' },
          ].map(section => (
            <View key={section.key} style={[styles.soapCard, { borderLeftColor: section.color }]}>
              <Text style={[styles.soapLabel, { color: section.color }]}>{section.label}</Text>
              <TextInput
                style={styles.soapInput}
                multiline
                value={soap[section.key as keyof SOAPNotes]}
                onChangeText={(text) => setSoap({ ...soap, [section.key]: text })}
                textAlignVertical="top"
              />
            </View>
          ))}

          <View style={styles.sendCard}>
            {selectedPatient?.isBridgette ? (
              <>
                <Text style={styles.sendTitle}>📱 Send via Bridgette</Text>
                <Text style={styles.sendDesc}>{selectedPatient.full_name} will receive their visit summary directly in the Bridgette app.</Text>
                <TouchableOpacity style={[styles.sendBtn, sending && { opacity: 0.6 }]} onPress={sendToPatient} disabled={sending}>
                  {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Save & Send via App</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.sendTitle}>📧 Send to patient's email</Text>
                <Text style={styles.sendDesc}>Patient will receive their visit summary by email with an invite to join Bridgette.</Text>
                <TextInput
                  style={styles.emailInput}
                  placeholder="Patient's email address"
                  placeholderTextColor="#999"
                  value={selectedPatient?.email || patientEmail}
                  onChangeText={setPatientEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TouchableOpacity style={[styles.sendBtn, sending && { opacity: 0.6 }]} onPress={sendToPatient} disabled={sending}>
                  {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Send Visit Summary</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    )
  }

  // ── SENT ──
  if (mode === 'sent') {
    return (
      <View style={styles.container}>
        <View style={styles.sentContent}>
          <Text style={styles.sentIcon}>✅</Text>
          <Text style={styles.sentTitle}>Visit summary sent!</Text>
          <Text style={styles.sentDesc}>
            {selectedPatient?.isBridgette
              ? `${selectedPatient?.full_name} will see their SOAP notes in the Bridgette app.`
              : `${selectedPatient?.full_name} will receive their SOAP notes at ${selectedPatient?.email || patientEmail}. The email includes an invite to join Bridgette.`
            }
          </Text>
          <TouchableOpacity style={styles.sentBtn} onPress={reset}>
            <Text style={styles.sentBtnText}>New Consultation</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sentBackBtn} onPress={onBack}>
            <Text style={styles.sentBackBtnText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return null
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F4' },
  header: {
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8E4DC',
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 14,
  },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 13, color: '#C8524A', fontWeight: '600' },
  title: { fontFamily: 'serif', fontSize: 22, color: '#1A1A2E', marginBottom: 2 },
  subtitle: { fontSize: 12, color: '#7A7A9A' },
  content: { flex: 1, padding: 16 },
  stepBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#1A1A2E', borderRadius: 12, padding: 16, marginBottom: 20,
  },
  stepNum: { fontFamily: 'serif', fontSize: 28, color: 'rgba(255,255,255,0.3)' },
  stepInfo: { flex: 1 },
  stepTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 3 },
  stepDesc: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  groupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#7A7A9A', marginBottom: 10 },
  patientSelectCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#E8E4DC',
  },
  patientSelectAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FCEEED', alignItems: 'center', justifyContent: 'center' },
  patientSelectAvatarText: { fontSize: 16, fontWeight: '700', color: '#C8524A' },
  patientSelectInfo: { flex: 1 },
  patientSelectName: { fontSize: 15, fontWeight: '600', color: '#1A1A2E', marginBottom: 4 },
  bridgetteBadge: { backgroundColor: '#EAF4EE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: 'flex-start' },
  bridgetteBadgeText: { fontSize: 10, fontWeight: '600', color: '#3D7A5E' },
  patientSelectArrow: { fontSize: 16, color: '#7A7A9A' },
  nonBridgetteBtn: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: '#E8E4DC', borderStyle: 'dashed',
  },
  nonBridgetteBtnIcon: { fontSize: 22 },
  nonBridgetteBtnTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 3 },
  nonBridgetteBtnDesc: { fontSize: 12, color: '#7A7A9A' },
  nonBridgetteForm: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E8E4DC' },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: '#7A7A9A', marginBottom: 8, marginTop: 12 },
  optional: { fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
  fieldInput: { backgroundColor: '#F4F2EE', borderRadius: 10, padding: 12, fontSize: 14, color: '#1A1A2E', borderWidth: 1, borderColor: '#E8E4DC' },
  nonBridgetteFormActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelSmallBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E8E4DC', alignItems: 'center' },
  cancelSmallBtnText: { fontSize: 13, color: '#7A7A9A', fontWeight: '600' },
  confirmSmallBtn: { flex: 2, backgroundColor: '#1A1A2E', padding: 12, borderRadius: 10, alignItems: 'center' },
  confirmSmallBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  methodCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 12,
    flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderWidth: 1, borderColor: '#E8E4DC',
  },
  methodIconBg: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#FCEEED', alignItems: 'center', justifyContent: 'center' },
  methodIcon: { fontSize: 24 },
  methodInfo: { flex: 1 },
  methodTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 6 },
  methodDesc: { fontSize: 13, color: '#7A7A9A', lineHeight: 19, marginBottom: 8 },
  methodBadge: { backgroundColor: '#EAF4EE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  methodBadgeText: { fontSize: 11, fontWeight: '700', color: '#3D7A5E' },
  methodArrow: { fontSize: 16, color: '#7A7A9A', marginTop: 4 },
  recordCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 32, marginBottom: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#E8E4DC',
  },
  recordOrb: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#F4F2EE', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  recordOrbActive: {
    backgroundColor: '#FCEEED',
    shadowColor: '#C8524A', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 20,
  },
  recordOrbIcon: { fontSize: 36 },
  recordTimer: { fontFamily: 'serif', fontSize: 32, color: '#1A1A2E', marginBottom: 8 },
  recordStatus: { fontSize: 13, color: '#7A7A9A', marginBottom: 24, textAlign: 'center' },
  recordBtn: { backgroundColor: '#1A1A2E', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  recordBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  playbackRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  playBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#1A1A2E', paddingVertical: 12, borderRadius: 12,
  },
  playBtnIcon: { fontSize: 16 },
  playBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  reRecordBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E8E4DC',
    backgroundColor: '#fff',
  },
  reRecordBtnText: { fontSize: 13, fontWeight: '600', color: '#7A7A9A' },
  transcriptCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E8E4DC' },
  transcriptTitle: { fontSize: 12, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  transcriptHint: { fontSize: 11, color: '#7A7A9A', marginBottom: 10, fontStyle: 'italic' },
  transcriptInput: { fontSize: 13, color: '#4A4A6A', lineHeight: 20, minHeight: 100 },
  manualInput: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    fontSize: 14, color: '#1A1A2E', lineHeight: 22,
    borderWidth: 1, borderColor: '#E8E4DC', minHeight: 220, marginBottom: 12,
  },
  manualActions: { gap: 10 },
  saveNotesBtn: { backgroundColor: '#F4F2EE', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E8E4DC' },
  saveNotesBtnText: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  generatingCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#E8E4DC' },
  generatingText: { fontSize: 13, color: '#7A7A9A' },
  generateBtn: { backgroundColor: '#1A1A2E', borderRadius: 12, padding: 16, alignItems: 'center' },
  generateBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  soapCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E8E4DC', borderLeftWidth: 3 },
  soapLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  soapInput: { fontSize: 13, color: '#1A1A2E', lineHeight: 20, minHeight: 80 },
  sendCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginTop: 8, borderWidth: 1, borderColor: '#E8E4DC' },
  sendTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 6 },
  sendDesc: { fontSize: 13, color: '#7A7A9A', lineHeight: 19, marginBottom: 16 },
  emailInput: { backgroundColor: '#F4F2EE', borderRadius: 10, padding: 14, fontSize: 14, color: '#1A1A2E', marginBottom: 14, borderWidth: 1, borderColor: '#E8E4DC' },
  sendBtn: { backgroundColor: '#C8524A', borderRadius: 12, padding: 16, alignItems: 'center' },
  sendBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  sentContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  sentIcon: { fontSize: 60, marginBottom: 20 },
  sentTitle: { fontFamily: 'serif', fontSize: 26, color: '#1A1A2E', marginBottom: 16, textAlign: 'center' },
  sentDesc: { fontSize: 14, color: '#7A7A9A', lineHeight: 22, textAlign: 'center', marginBottom: 40 },
  sentBtn: { backgroundColor: '#1A1A2E', borderRadius: 12, padding: 16, alignItems: 'center', width: '100%', marginBottom: 12 },
  sentBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  sentBackBtn: { padding: 14, alignItems: 'center', width: '100%' },
  sentBackBtnText: { fontSize: 14, color: '#7A7A9A', fontWeight: '500' },
})