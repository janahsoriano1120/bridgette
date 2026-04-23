import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import LoginScreen from './app/auth/login'
import PatientHome from './app/patient/home'

export default function App() {
  const setSession = useAuthStore((state) => state.setSession)
  const session = useAuthStore((state) => state.session)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session)
      }
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
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

  return <PatientHome />
}