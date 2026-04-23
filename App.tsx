import { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { supabase } from './lib/supabase'
import LoginScreen from './app/auth/login'
import PatientHome from './app/patient/home'

export default function App() {
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        setLoggedIn(true)
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.session.user.id)
          .single()
        setRole(profile?.role ?? 'patient')
      }
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setLoggedIn(true)
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        setRole(profile?.role ?? 'patient')
      } else {
        setLoggedIn(false)
        setRole(null)
      }
      setLoading(false)
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

  if (!loggedIn) {
    return <LoginScreen />
  }

  // Logged in — show role
  return <PatientHome />
}