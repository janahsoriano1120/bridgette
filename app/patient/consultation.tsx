import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
  } from 'react-native'
  
  type Consultation = {
    date: string
    summary: string
    notes: string
    actionItems: string[]
    prescriptions: { name: string; dosage: string; instructions: string }[]
    nextSteps: string[]
    referredTo: string[]
  }
  
  type Doctor = {
    role: string
    name: string
    emoji: string
    color: string
    bg: string
    consultations: Consultation[]
  }
  
  type Props = {
    doctor: Doctor
    consultation: Consultation
    onBack: () => void
    onChangeConsult: (c: Consultation) => void
  }
  
  export default function ConsultationScreen({ doctor, consultation, onBack, onChangeConsult }: Props) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Care Team</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <View style={[styles.doctorIcon, { backgroundColor: doctor.bg }]}>
              <Text style={styles.doctorEmoji}>{doctor.emoji}</Text>
            </View>
            <View>
              <Text style={styles.doctorName}>{doctor.name}</Text>
              <Text style={styles.doctorRole}>{doctor.role}</Text>
            </View>
          </View>
        </View>
  
        {/* Consultation date selector */}
        {doctor.consultations.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dateSelectorScroll}
            contentContainerStyle={styles.dateSelectorContent}
          >
            {doctor.consultations.map((c, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.dateChip,
                  consultation.date === c.date && styles.dateChipActive,
                ]}
                onPress={() => onChangeConsult(c)}
              >
                <Text style={[
                  styles.dateChipText,
                  consultation.date === c.date && styles.dateChipTextActive,
                ]}>
                  {c.date}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
  
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
  
          {/* Summary */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>📝</Text>
              <Text style={styles.sectionTitle}>Consultation Summary</Text>
            </View>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionText}>{consultation.summary}</Text>
            </View>
          </View>
  
          {/* Doctor's Notes */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>🩺</Text>
              <Text style={styles.sectionTitle}>Doctor's Notes</Text>
            </View>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionText}>{consultation.notes}</Text>
            </View>
          </View>
  
          {/* Prescriptions */}
          {consultation.prescriptions.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>💊</Text>
                <Text style={styles.sectionTitle}>Prescriptions</Text>
              </View>
              {consultation.prescriptions.map((rx, i) => (
                <View key={i} style={styles.rxCard}>
                  <View style={styles.rxTop}>
                    <Text style={styles.rxName}>{rx.name}</Text>
                    <View style={styles.rxDosageBadge}>
                      <Text style={styles.rxDosageText}>{rx.dosage}</Text>
                    </View>
                  </View>
                  <Text style={styles.rxInstructions}>{rx.instructions}</Text>
                </View>
              ))}
            </View>
          )}
  
          {/* Action Items */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>✅</Text>
              <Text style={styles.sectionTitle}>Action Items</Text>
            </View>
            <View style={styles.sectionCard}>
              {consultation.actionItems.map((item, i) => (
                <View key={i} style={styles.actionItem}>
                  <View style={[styles.actionDot, { backgroundColor: doctor.color }]} />
                  <Text style={styles.actionText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
  
          {/* Next Steps */}
          {consultation.nextSteps.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>🗓</Text>
                <Text style={styles.sectionTitle}>Next Steps</Text>
              </View>
              <View style={styles.sectionCard}>
                {consultation.nextSteps.map((step, i) => (
                  <View key={i} style={styles.actionItem}>
                    <View style={[styles.actionDot, { backgroundColor: '#2C5FAB' }]} />
                    <Text style={styles.actionText}>{step}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
  
          {/* Referred To */}
          {consultation.referredTo.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>🔗</Text>
                <Text style={styles.sectionTitle}>Referred To</Text>
              </View>
              <View style={styles.referralRow}>
                {consultation.referredTo.map((ref, i) => (
                  <View key={i} style={styles.referralChip}>
                    <Text style={styles.referralText}>{ref}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
  
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    )
  }
  
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAF8F4' },
    header: {
      backgroundColor: '#fff',
      borderBottomWidth: 1,
      borderBottomColor: '#E8E4DC',
      paddingTop: 60,
      paddingBottom: 16,
      paddingHorizontal: 24,
    },
    backBtn: { marginBottom: 14 },
    backText: { fontSize: 15, color: '#C8524A', fontWeight: '600' },
    headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    doctorIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doctorEmoji: { fontSize: 24 },
    doctorName: { fontFamily: 'serif', fontSize: 18, color: '#1A1A2E', marginBottom: 2 },
    doctorRole: { fontSize: 12, color: '#7A7A9A' },
    dateSelectorScroll: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E8E4DC', maxHeight: 52 },
dateSelectorContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' },
dateChip: {
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 20,
  backgroundColor: '#F4F2EE',
  borderWidth: 1,
  borderColor: '#E8E4DC',
  alignSelf: 'flex-start',
},
    dateChipActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
    dateChipText: { fontSize: 13, fontWeight: '600', color: '#7A7A9A' },
    dateChipTextActive: { color: '#fff' },
    content: { flex: 1, padding: 16 },
    section: { marginBottom: 16 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    sectionIcon: { fontSize: 16 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: '#1A1A2E',
      letterSpacing: 0.3,
    },
    sectionCard: {
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: '#E8E4DC',
    },
    sectionText: {
      fontSize: 14,
      color: '#4A4A6A',
      lineHeight: 22,
      fontWeight: '300',
    },
    rxCard: {
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: '#E8E4DC',
      marginBottom: 8,
    },
    rxTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    rxName: { fontSize: 15, fontWeight: '600', color: '#1A1A2E', flex: 1 },
    rxDosageBadge: {
      backgroundColor: '#EAF4EE',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    rxDosageText: { fontSize: 12, fontWeight: '600', color: '#3D7A5E' },
    rxInstructions: { fontSize: 13, color: '#7A7A9A', lineHeight: 19, fontWeight: '300' },
    actionItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 10,
    },
    actionDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginTop: 7,
      flexShrink: 0,
    },
    actionText: { fontSize: 14, color: '#4A4A6A', lineHeight: 21, flex: 1, fontWeight: '300' },
    referralRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    referralChip: {
      backgroundColor: '#EBF1FB',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#C5D5F0',
    },
    referralText: { fontSize: 13, fontWeight: '600', color: '#2C5FAB' },
  })