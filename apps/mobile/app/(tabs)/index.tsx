/**
 * ProofWork Profile screen — mobile
 * Shows DID, KYC tier, trust score, verified skills and employment.
 * Tap any credential to see on-chain proof + ZK disclosure options.
 */
import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StyleSheet, RefreshControl,
} from 'react-native'
import * as SecureStore from 'expo-secure-store'

interface Profile {
  did: string
  kycTier: string
  overallTrustScore: number
  skills: Array<{ skillSlug: string; skillLevel: number; aiEvalScore: number; status: string }>
  employment: Array<{ companyName: string; role: string; verificationTier: string; chainTxHash?: string }>
}

const TIER_COLORS: Record<string, string> = {
  T1_GOVT: '#16a34a',
  T2_EMPLOYER: '#2563eb',
  T3_INSTITUTION: '#7c3aed',
  T4_PEER: '#d97706',
  T5_AI_INFERRED: '#6b7280',
  T6_SELF: '#9ca3af',
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchProfile(silent = false) {
    if (!silent) setLoading(true)
    try {
      const token = await SecureStore.getItemAsync('attesta_token')
      const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.attesta.io'
      const res = await fetch(`${apiUrl}/profile/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setProfile(data.profile)
      }
    } catch (e) {
      console.warn('Profile fetch failed:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchProfile() }, [])

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#4f46e5" />
    </View>
  )

  if (!profile) return (
    <View style={styles.center}>
      <Text style={styles.emptyText}>Sign in to view your ProofWork profile</Text>
    </View>
  )

  const tierColor = TIER_COLORS[profile.kycTier] ?? '#9ca3af'

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProfile(true) }} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile.did.slice(12, 14).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.didText} numberOfLines={1}>{profile.did}</Text>
          <View style={styles.tierRow}>
            <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
              <Text style={styles.tierBadgeText}>{profile.kycTier.replace('_', ' ')}</Text>
            </View>
            <Text style={styles.trustScore}>Trust {Math.round(profile.overallTrustScore)}/100</Text>
          </View>
        </View>
      </View>

      {/* Skills */}
      <Text style={styles.sectionTitle}>Verified Skills</Text>
      {profile.skills.length === 0 && <Text style={styles.emptyText}>No skills yet — add your first skill</Text>}
      {profile.skills.map(s => (
        <TouchableOpacity key={s.skillSlug} style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>{s.skillSlug.replace(/_/g, ' ')}</Text>
            <View style={[styles.scoreBadge, { backgroundColor: s.status === 'ANCHORED' ? '#dcfce7' : '#f3f4f6' }]}>
              <Text style={[styles.scoreText, { color: s.status === 'ANCHORED' ? '#16a34a' : '#6b7280' }]}>
                {s.aiEvalScore != null ? `${s.aiEvalScore}/100` : s.status}
              </Text>
            </View>
          </View>
          {s.skillLevel != null && (
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${s.skillLevel * 10}%` as `${number}%` }]} />
            </View>
          )}
        </TouchableOpacity>
      ))}

      {/* Employment */}
      <Text style={styles.sectionTitle}>Employment</Text>
      {profile.employment.length === 0 && <Text style={styles.emptyText}>No co-signed employment yet</Text>}
      {profile.employment.map((e, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.cardTitle}>{e.companyName}</Text>
          <Text style={styles.cardSub}>{e.role}</Text>
          <View style={styles.tierRow}>
            <View style={[styles.tierBadge, { backgroundColor: TIER_COLORS[e.verificationTier] ?? '#9ca3af' }]}>
              <Text style={styles.tierBadgeText}>{e.verificationTier.replace('_', ' ')}</Text>
            </View>
            {e.chainTxHash && <Text style={styles.hashText} numberOfLines={1}>⛓ On-chain</Text>}
          </View>
        </View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24, paddingTop: 60 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#4f46e5' },
  didText: { fontSize: 11, color: '#6b7280', fontFamily: 'monospace', marginBottom: 6 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  tierBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  trustScore: { fontSize: 12, color: '#374151', fontWeight: '600' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 20 },
  card: { borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 12, padding: 14, marginBottom: 8 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111', textTransform: 'capitalize' },
  cardSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  scoreBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  scoreText: { fontSize: 11, fontWeight: '700' },
  barBg: { height: 4, backgroundColor: '#f3f4f6', borderRadius: 2, marginTop: 10 },
  barFill: { height: 4, backgroundColor: '#4f46e5', borderRadius: 2 },
  hashText: { fontSize: 10, color: '#9ca3af' },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginVertical: 12 },
})
