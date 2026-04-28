import { create } from 'zustand'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type Profile = {
  id: string
  role: 'patient' | 'provider'
  full_name: string | null
  subscription_tier: string
  specialty: string | null
  clinic: string | null
  prc_number: string | null
}

type AuthStore = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  setSession: (session: Session | null) => void
  fetchProfile: (userId: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  profile: null,
  loading: true,

  setSession: (session) => set({ session }),

  fetchProfile: async (userId: string) => {
    try {
      if (!userId || userId === 'undefined') {
        console.log('fetchProfile called with invalid userId:', userId)
        set({ loading: false })
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (data) {
        console.log('Profile loaded:', data.full_name, data.role)
        set({ profile: data, loading: false })
      } else {
        console.log('Profile fetch error:', error)
        set({ loading: false })
      }
    } catch (e) {
      console.log('Profile fetch exception:', e)
      set({ loading: false })
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, profile: null })
  },
}))