import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

type Mode = 'select' | 'patient-login' | 'provider-login' | 'provider-signup'

const SPECIALTIES = [
  'Family Medicine',
  'Internal Medicine',
  'Cardiology',
  'Endocrinology',
  'Obstetrics & Gynecology',
  'Dermatology',
  'Ophthalmology',
  'Nutritionist',
  'Physical Therapist',
  'Dentist',
  'Personal Trainer',
  'Other',
]

export default function LoginScreen() {
  const fetchProfile = useAuthStore((state) => state.fetchProfile)
  const [mode, setMode] = useState<Mode>('select')
  const [loading, setLoading] = useState(false)

  // Patient login
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  // Provider signup
  const [providerEmail, setProviderEmail] = useState('')
  const [providerPassword, setProviderPassword] = useState('')
  const [providerName, setProviderName] = useState('')
  const [providerSpecialty, setProviderSpecialty] = useState('')
  const [providerClinic, setProviderClinic] = useState('')
  const [providerPRC, setProviderPRC] = useState('')
  const [showSpecialtyPicker, setShowSpecialtyPicker] = useState(false)

  async function handlePatientAuth() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Please enter your email and password')
      return
    }
    setLoading(true)
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) { Alert.alert('Sign up failed', error.message); return }
        Alert.alert('Check your email', 'We sent you a confirmation link.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { Alert.alert('Login failed', error.message); return }
        await fetchProfile()
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleProviderSignup() {
    if (!providerEmail.trim() || !providerPassword.trim()) {
      Alert.alert('Please enter your email and password')
      return
    }
    if (!providerName.trim()) {
      Alert.alert('Please enter your full name')
      return
    }
    if (!providerSpecialty) {
      Alert.alert('Please select your specialty')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: providerEmail,
        password: providerPassword,
      })
      if (error) { Alert.alert('Sign up failed', error.message); return }
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: providerName,
          role: 'provider',
          specialty: providerSpecialty,
          clinic: providerClinic || null,
          prc_number: providerPRC || null,
        })
        await fetchProfile()
      }
      Alert.alert('Welcome to Bridgette!', 'Check your email to confirm your account.')
    } finally {
      setLoading(false)
    }
  }

  async function handleProviderLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Please enter your email and password')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { Alert.alert('Login failed', error.message); return }
      await fetchProfile()
    } finally {
      setLoading(false)
    }
  }

  // ── ROLE SELECTION SCREEN ──
  if (mode === 'select') {
    return (
      <View style={styles.container}>
        <View style={styles.selectContent}>
          <Text style={styles.logo}>bridgette</Text>
          <Text style={styles.selectTagline}>Your health, your story, your team.</Text>

          <View style={styles.roleCards}>
            <TouchableOpacity
              style={styles.roleCard}
              onPress={() => setMode('patient-login')}
            >
              <Text style={styles.roleEmoji}>🧬</Text>
              <Text style={styles.roleTitle}>I'm a Patient</Text>
              <Text style={styles.roleDesc}>Track your labs, lifestyle, and share with your care team</Text>
              <View style={styles.roleArrow}>
                <Text style={styles.roleArrowText}>Get started →</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleCard, styles.roleCardProvider]}
              onPress={() => setMode('provider-signup')}
            >
              <Text style={styles.roleEmoji}>🩺</Text>
              <Text style={[styles.roleTitle, { color: '#fff' }]}>I'm a Provider</Text>
              <Text style={[styles.roleDesc, { color: 'rgba(255,255,255,0.6)' }]}>Access your patients' health data and care history</Text>
              <View style={[styles.roleArrow, { borderColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={[styles.roleArrowText, { color: 'rgba(255,255,255,0.8)' }]}>Join as provider →</Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => setMode('provider-login')} style={styles.providerLoginLink}>
            <Text style={styles.providerLoginLinkText}>Already a provider? Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // ── PROVIDER SIGNUP SCREEN ──
  if (mode === 'provider-signup') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.formContent}>
          <TouchableOpacity onPress={() => setMode('select')} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.logo}>bridgette</Text>
          <Text style={styles.formTitle}>Provider Sign Up</Text>
          <Text style={styles.formSub}>Join Bridgette as a health provider</Text>

          <Text style={styles.fieldLabel}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Dr. Juan dela Cruz"
            placeholderTextColor="#999"
            value={providerName}
            onChangeText={setProviderName}
          />

          <Text style={styles.fieldLabel}>Specialty</Text>
          <TouchableOpacity
            style={[styles.input, styles.selectInput]}
            onPress={() => setShowSpecialtyPicker(!showSpecialtyPicker)}
          >
            <Text style={[styles.selectInputText, !providerSpecialty && { color: '#999' }]}>
              {providerSpecialty || 'Select your specialty'}
            </Text>
            <Text style={styles.selectArrow}>{showSpecialtyPicker ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showSpecialtyPicker && (
            <View style={styles.specialtyDropdown}>
              {SPECIALTIES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.specialtyItem, providerSpecialty === s && styles.specialtyItemActive]}
                  onPress={() => { setProviderSpecialty(s); setShowSpecialtyPicker(false) }}
                >
                  <Text style={[styles.specialtyItemText, providerSpecialty === s && styles.specialtyItemTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.fieldLabel}>Clinic / Hospital</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Makati Medical Center"
            placeholderTextColor="#999"
            value={providerClinic}
            onChangeText={setProviderClinic}
          />

          <Text style={styles.fieldLabel}>PRC License Number <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 0123456"
            placeholderTextColor="#999"
            value={providerPRC}
            onChangeText={setProviderPRC}
            keyboardType="number-pad"
          />

          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor="#999"
            value={providerEmail}
            onChangeText={setProviderEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Minimum 6 characters"
            placeholderTextColor="#999"
            value={providerPassword}
            onChangeText={setProviderPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
            onPress={handleProviderSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Create Provider Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode('provider-login')} style={styles.switchLink}>
            <Text style={styles.switchLinkText}>Already have an account? Sign in</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  // ── PROVIDER LOGIN SCREEN ──
  if (mode === 'provider-login') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.formContent}>
          <TouchableOpacity onPress={() => setMode('select')} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.logo}>bridgette</Text>
          <Text style={styles.formTitle}>Provider Sign In</Text>
          <Text style={styles.formSub}>Welcome back to your provider dashboard</Text>

          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Your password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: '#1A1A2E' }, loading && styles.primaryBtnDisabled]}
            onPress={handleProviderLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Sign In as Provider</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode('provider-signup')} style={styles.switchLink}>
            <Text style={styles.switchLinkText}>New provider? Create an account</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  // ── PATIENT LOGIN SCREEN ──
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.formContent}>
        <TouchableOpacity onPress={() => setMode('select')} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.logo}>bridgette</Text>
        <Text style={styles.formTitle}>{isSignUp ? 'Create Account' : 'Welcome back'}</Text>
        <Text style={styles.formSub}>{isSignUp ? 'Start your health wallet today' : 'Sign in to your health wallet'}</Text>

        <Text style={styles.fieldLabel}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="your@email.com"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.fieldLabel}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Your password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
          onPress={handlePatientAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.switchLink}>
          <Text style={styles.switchLinkText}>
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F4' },

  // Role selection
  selectContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  logo: {
    fontFamily: 'serif',
    fontSize: 32,
    color: '#C8524A',
    marginBottom: 8,
  },
  selectTagline: {
    fontSize: 14,
    color: '#7A7A9A',
    marginBottom: 48,
    fontWeight: '300',
  },
  roleCards: { gap: 16 },
  roleCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },
  roleCardProvider: {
    backgroundColor: '#1A1A2E',
    borderColor: '#1A1A2E',
  },
  roleEmoji: { fontSize: 32, marginBottom: 12 },
  roleTitle: {
    fontFamily: 'serif',
    fontSize: 22,
    color: '#1A1A2E',
    marginBottom: 8,
  },
  roleDesc: {
    fontSize: 14,
    color: '#7A7A9A',
    lineHeight: 20,
    fontWeight: '300',
    marginBottom: 20,
  },
  roleArrow: {
    borderTopWidth: 1,
    borderTopColor: '#E8E4DC',
    paddingTop: 14,
  },
  roleArrowText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C8524A',
  },
  providerLoginLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  providerLoginLinkText: {
    fontSize: 13,
    color: '#7A7A9A',
    fontWeight: '500',
  },

  // Forms
  formContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  backBtn: { marginBottom: 24 },
  backText: { fontSize: 15, color: '#C8524A', fontWeight: '600' },
  formTitle: {
    fontFamily: 'serif',
    fontSize: 28,
    color: '#1A1A2E',
    marginBottom: 6,
    marginTop: 16,
  },
  formSub: {
    fontSize: 14,
    color: '#7A7A9A',
    marginBottom: 32,
    fontWeight: '300',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#7A7A9A',
    marginBottom: 8,
    marginTop: 16,
  },
  optional: { fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E8E4DC',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#1A1A2E',
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectInputText: { fontSize: 15, color: '#1A1A2E' },
  selectArrow: { fontSize: 11, color: '#7A7A9A' },
  specialtyDropdown: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E4DC',
    marginTop: 4,
    overflow: 'hidden',
  },
  specialtyItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F2EE',
  },
  specialtyItemActive: { backgroundColor: '#F4F2EE' },
  specialtyItemText: { fontSize: 14, color: '#7A7A9A' },
  specialtyItemTextActive: { color: '#1A1A2E', fontWeight: '600' },
  primaryBtn: {
    backgroundColor: '#C8524A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  switchLink: { marginTop: 20, alignItems: 'center' },
  switchLinkText: { fontSize: 13, color: '#7A7A9A', fontWeight: '500' },
})