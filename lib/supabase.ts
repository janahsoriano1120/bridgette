import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rkyxxxmbrwvgrljiqzdp.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJreXh4eG1icnd2Z3JsamlxemRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODIxOTcsImV4cCI6MjA5MjQ1ODE5N30.RqiFDBTf3eipWLmWZYrAjCS-tSZuiky4vOJDLmdNNmE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
