import { useEffect, useState } from 'react'
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { FIT_DIMENSION_WEIGHTS } from '@attesta/shared'

interface Match {
  fitScoreId: string
  overallScore: number
  capabilityScore: number
  cultureScore: number
  growthScore: number
  compScore: number
  careerScore: number
  employerInterest: boolean
  revealedAt?: string
  role: { title: string; domain: string; compensationMinUsd?: number; remote: boolean }
}

export default function MatchesScreen() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    const token = await SecureStore.getItemAsync('attesta_token')
    const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.attesta.io'
    const res = await fetch(`${apiUrl}/matches`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) { const d = await res.json(); setMatches(d.matches ?? []) }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#4f46e5" /></View>

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true) }} />}
    >
      <Text style={s.header}>RoleFit Matches</Text>
      <Text style={s.sub}>Matched to your verified skills — not keywords</Text>

      {matches.length === 0 && <Text style={s.empty}>No matches yet. Add more verified skills.</Text>}

      {matches.map(m => (
        <View key={m.fitScoreId} style={s.card}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.roleTitle}>{m.role.title}</Text>
              <Text style={s.roleSub}>
                {m.role.domain}{m.role.compensationMinUsd ? ` · $${(m.role.compensationMinUsd / 1000).toFixed(0)}K+` : ''}{m.role.remote ? ' · Remote' : ''}
              </Text>
            </View>
            <View style={s.scorePill}>
              <Text style={s.scoreNum}>{m.overallScore}</Text>
            </View>
          </View>

          <View style={s.barsRow}>
            {(Object.keys(FIT_DIMENSION_WEIGHTS) as (keyof typeof FIT_DIMENSION_WEIGHTS)[]).map(dim => {
              const score = m[`${dim.toLowerCase()}Score` as keyof Match] as number
              return (
                <View key={dim} style={{ flex: 1 }}>
                  <Text style={s.dimLabel}>{dim.slice(0, 3)}</Text>
                  <View style={s.barBg}>
                    <View style={[s.barFill, { width: `${score}%` as `${number}%` }]} />
                  </View>
                  <Text style={s.dimScore}>{score}</Text>
                </View>
              )
            })}
          </View>

          {m.employerInterest && !m.revealedAt && (
            <View style={s.interestBanner}>
              <Text style={s.interestText}>⚡ Employer interested — check dashboard to reveal</Text>
            </View>
          )}
        </View>
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { fontSize: 22, fontWeight: '800', color: '#111', marginTop: 60, marginBottom: 4 },
  sub: { fontSize: 13, color: '#6b7280', marginBottom: 20 },
  empty: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 40 },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  roleTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  roleSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  scorePill: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: 16, fontWeight: '900', color: '#4f46e5' },
  barsRow: { flexDirection: 'row', gap: 6 },
  dimLabel: { fontSize: 9, color: '#9ca3af', textAlign: 'center', marginBottom: 2 },
  barBg: { height: 4, backgroundColor: '#f3f4f6', borderRadius: 2 },
  barFill: { height: 4, backgroundColor: '#818cf8', borderRadius: 2 },
  dimScore: { fontSize: 9, color: '#374151', textAlign: 'center', marginTop: 2 },
  interestBanner: { backgroundColor: '#fef3c7', borderRadius: 8, padding: 8, marginTop: 10 },
  interestText: { fontSize: 11, color: '#92400e', fontWeight: '600' },
})
