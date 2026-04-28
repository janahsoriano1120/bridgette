import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import LoginScreen from './app/auth/login'
import PatientHome from './app/patient/home'
import ProviderDashboard from './app/provider/dashboard'

export default function App() {
  const setSession = useAuthStore((state) => state.setSession)
  const fetchProfile = useAuthStore((state) => state.fetchProfile)
  const session = useAuthStore((state) => state.session)
  const profile = useAuthStore((state) => state.profile)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setSession(data.session)
        await fetchProfile(data.session.user.id)
      }
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setSession(session)
        await fetchProfile(session.user.id)
      } else {
        setSession(null)
      }
    })

    return () => data.subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF8F4' }}>
        <ActivityIndicator size="large" color="#C8524A" />
      </View>
    )
  }

  if (!session) {
    return <LoginScreen />
  }

  console.log('Profile role check:', profile?.role, profile?.full_name)

  if (profile?.role === 'provider') {
    return <ProviderDashboard />
  }

  return <PatientHome />
}