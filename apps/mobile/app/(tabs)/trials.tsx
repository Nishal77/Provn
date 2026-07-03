import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, RefreshControl, Linking } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { TRIAL_STATUS_LABELS, TRIAL_DOMAIN_LABELS } from '@attesta/shared'
import type { Trial } from '@attesta/shared'

export default function TrialsScreen() {
  const [trials, setTrials] = useState<Trial[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    const token = await SecureStore.getItemAsync('attesta_token')
    const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.attesta.io'
    const res = await fetch(`${apiUrl}/trials?role=candidate`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) { const d = await res.json(); setTrials(d.trials ?? []) }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  async function launchSandbox(trial: Trial) {
    if (trial.sandboxSessionUrl) {
      await Linking.openURL(trial.sandboxSessionUrl)
    }
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#4f46e5" /></View>

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true) }} />}
    >
      <Text style={s.header}>WorkProof Trials</Text>
      <Text style={s.sub}>Paid real-work sessions. Earn ${'{50–200}'} per trial.</Text>

      {trials.length === 0 && <Text style={s.empty}>No trials yet. Employers will invite you here.</Text>}

      {trials.map(t => {
        const avgScore = t.scores && t.scores.length > 0
          ? Math.round(t.scores.reduce((sum, d) => sum + d.score, 0) / t.scores.length)
          : null

        return (
          <View key={t.id} style={s.card}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{t.roleTitle}</Text>
                <Text style={s.sub2}>{TRIAL_DOMAIN_LABELS[t.domain]} · {t.durationMinutes}min · ${t.compensationCandidateUsd}</Text>
              </View>
              {avgScore !== null && (
                <View style={s.scorePill}>
                  <Text style={s.scoreNum}>{avgScore}</Text>
                </View>
              )}
            </View>

            <View style={s.statusRow}>
              <View style={s.statusBadge}>
                <Text style={s.statusText}>{TRIAL_STATUS_LABELS[t.status]}</Text>
              </View>
              {t.status === 'IN_PROGRESS' && t.sandboxSessionUrl && (
                <TouchableOpacity style={s.launchBtn} onPress={() => launchSandbox(t)}>
                  <Text style={s.launchBtnText}>Open Sandbox →</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Score bars */}
            {t.scores && t.scores.length > 0 && (
              <View style={s.barsRow}>
                {t.scores.map(score => (
                  <View key={score.dimension} style={{ flex: 1 }}>
                    <Text style={s.dimLabel}>{score.dimension.slice(0, 3)}</Text>
                    <View style={s.barBg}>
                      <View style={[s.barFill, { width: `${score.score}%` as `${number}%` }]} />
                    </View>
                    <Text style={s.dimScore}>{score.score}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )
      })}
      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { fontSize: 22, fontWeight: '800', color: '#111', marginTop: 60, marginBottom: 4 },
  sub: { fontSize: 13, color: '#6b7280', marginBottom: 20 },
  sub2: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  empty: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 40 },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  title: { fontSize: 15, fontWeight: '700', color: '#111' },
  scorePill: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: 16, fontWeight: '900', color: '#16a34a' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusBadge: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  launchBtn: { backgroundColor: '#4f46e5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
  launchBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  barsRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  dimLabel: { fontSize: 9, color: '#9ca3af', textAlign: 'center', marginBottom: 2 },
  barBg: { height: 4, backgroundColor: '#f3f4f6', borderRadius: 2 },
  barFill: { height: 4, backgroundColor: '#4f46e5', borderRadius: 2 },
  dimScore: { fontSize: 9, color: '#374151', textAlign: 'center', marginTop: 2 },
})
