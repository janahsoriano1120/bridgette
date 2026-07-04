import { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'
import Icon from './Icon'

type Message = { id: string; sender_id: string; sender_role: string; sender_name: string | null; body: string; created_at: string }

export default function ChatThread({
  patientId,
  providerId,
  myId,
  myRole,
  myName,
  accent = '#5C7340',
  title,
  onBack,
}: {
  patientId: string
  providerId: string
  myId: string
  myRole: 'patient' | 'caregiver' | 'provider'
  myName: string
  accent?: string
  title: string
  onBack: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  async function load(scroll = false) {
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, sender_role, sender_name, body, created_at')
      .eq('patient_id', patientId)
      .eq('provider_id', providerId)
      .order('created_at', { ascending: true })
    setMessages((data as Message[]) || [])
    setLoading(false)
    if (scroll) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)
  }

  useEffect(() => {
    load(true)
    const t = setInterval(() => load(false), 4000)
    return () => clearInterval(t)
  }, [patientId, providerId])

  async function send() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setText('')
    const { error } = await supabase.from('messages').insert({
      patient_id: patientId,
      provider_id: providerId,
      sender_id: myId,
      sender_role: myRole,
      sender_name: myName,
      body,
    })
    setSending(false)
    if (error) { setText(body); return }
    await load(true)
  }

  function roleTag(role: string) {
    if (role === 'caregiver') return 'caregiver'
    if (role === 'provider') return 'doctor'
    return ''
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}><Icon name="back" size={22} color="#3D3229" /></TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      </View>

      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 8 }} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
        {loading ? (
          <ActivityIndicator color={accent} style={{ marginTop: 24 }} />
        ) : messages.length === 0 ? (
          <Text style={styles.emptyText}>No messages yet. Say hello.</Text>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === myId
            const tag = roleTag(m.sender_role)
            return (
              <View key={m.id} style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
                {!mine && (
                  <Text style={styles.senderLabel}>
                    {m.sender_name || 'Someone'}{tag ? <Text style={styles.senderTag}>{`  ${tag}`}</Text> : null}
                  </Text>
                )}
                <View style={[styles.bubble, mine ? { backgroundColor: accent } : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.body}</Text>
                </View>
              </View>
            )
          })
        )}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message"
          placeholderTextColor="#A89E8E"
          multiline
        />
        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: accent }, (!text.trim() || sending) && styles.sendBtnOff]} onPress={send} disabled={!text.trim() || sending}>
          <Icon name="forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F2EC' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5DFD3', paddingTop: 60, paddingBottom: 14, paddingHorizontal: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Georgia', fontSize: 18, color: '#3D3229', flex: 1 },
  scroll: { flex: 1 },
  emptyText: { fontSize: 13, color: '#8A7E72', textAlign: 'center', marginTop: 30 },
  bubbleWrap: { marginBottom: 12, maxWidth: '82%' },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleWrapTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  senderLabel: { fontSize: 11, color: '#8A7E72', marginBottom: 3, marginLeft: 4, fontWeight: '600' },
  senderTag: { color: '#C4611A', fontWeight: '700' },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleTheirs: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5DFD3' },
  bubbleText: { fontSize: 14, color: '#3D3229', lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 28, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5DFD3' },
  input: { flex: 1, maxHeight: 120, backgroundColor: '#F5F2EC', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#3D3229' },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { opacity: 0.4 },
})