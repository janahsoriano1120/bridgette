import { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import LoginScreen from './app/auth/login'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
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

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF8F4' }}>
      <Text style={{ fontSize: 24, color: '#C8524A', fontFamily: 'serif' }}>bridgette</Text>
      <Text style={{ fontSize: 16, color: '#7A7A9A', marginTop: 8 }}>Welcome, {session.user.email}</Text>
    </View>
  )
}