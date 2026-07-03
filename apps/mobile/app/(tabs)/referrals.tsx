import { useEffect, useState } from 'react'
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { REFERRAL_STATUS_LABELS, REFERRAL_STATUS_COLORS, TRANCHE_PERCENTAGES } from '@attesta/shared'
import type { Referral } from '@attesta/shared'

export default function ReferralsScreen() {
  const [referrals, setReferrals] = useState<(Referral & { role: { title: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    const token = await SecureStore.getItemAsync('attesta_token')
    const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.attesta.io'
    const res = await fetch(`${apiUrl}/referrals?role=referrer`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) { const d = await res.json(); setReferrals(d.referrals ?? []) }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  const totalEarned = referrals
    .filter(r => r.tranche1PaidAt)
    .reduce((s, r) => s + (r.bountyTotalUsd ?? 0) * 0.33, 0)

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#4f46e5" /></View>

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true) }} />}
    >
      <Text style={s.header}>TrustChain Referrals</Text>

      {/* Tranche info */}
      <View style={s.trancheRow}>
        {TRANCHE_PERCENTAGES.map((pct, i) => (
          <View key={i} style={s.trancheCard}>
            <Text style={s.tranchePct}>{pct}%</Text>
            <Text style={s.trancheLabel}>{i === 0 ? 'Hire' : i === 1 ? '90d' : '180d'}</Text>
          </View>
        ))}
      </View>

      {totalEarned > 0 && (
        <View style={s.earnedBanner}>
          <Text style={s.earnedLabel}>Total earned</Text>
          <Text style={s.earnedAmount}>${Math.round(totalEarned).toLocaleString()}</Text>
        </View>
      )}

      {referrals.length === 0 && (
        <Text style={s.empty}>No referrals yet. Browse the bounty board and refer contacts.</Text>
      )}

      {referrals.map(r => (
        <View key={r.id} style={s.card}>
          <View style={s.row}>
            <Text style={s.title}>{r.role?.title ?? 'Unknown role'}</Text>
            <View style={s.badge}>
              <Text style={s.badgeText}>{REFERRAL_STATUS_LABELS[r.status]}</Text>
            </View>
          </View>
          {r.bountyTotalUsd && (
            <Text style={s.bountyText}>${r.bountyTotalUsd.toLocaleString()} bounty</Text>
          )}
          {/* Tranche progress bars */}
          <View style={s.trancheProgress}>
            {[r.tranche1PaidAt, r.tranche2PaidAt, r.tranche3PaidAt].map((paid, i) => (
              <View key={i} style={[s.trancheBar, { backgroundColor: paid ? '#16a34a' : '#e5e7eb' }]} />
            ))}
          </View>
        </View>
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { fontSize: 22, fontWeight: '800', color: '#111', marginTop: 60, marginBottom: 16 },
  trancheRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  trancheCard: { flex: 1, backgroundColor: '#eef2ff', borderRadius: 10, padding: 10, alignItems: 'center' },
  tranchePct: { fontSize: 18, fontWeight: '900', color: '#4f46e5' },
  trancheLabel: { fontSize: 10, color: '#818cf8', marginTop: 2 },
  earnedBanner: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  earnedLabel: { fontSize: 13, color: '#166534', fontWeight: '600' },
  earnedAmount: { fontSize: 20, fontWeight: '900', color: '#16a34a' },
  empty: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 40 },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 14, fontWeight: '700', color: '#111', flex: 1 },
  badge: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#374151' },
  bountyText: { fontSize: 12, color: '#16a34a', fontWeight: '600', marginBottom: 8 },
  trancheProgress: { flexDirection: 'row', gap: 4 },
  trancheBar: { flex: 1, height: 4, borderRadius: 2 },
})
