import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, Switch, ScrollView } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { useRouter } from 'expo-router'

export default function SettingsScreen() {
  const router = useRouter()
  const [biometrics, setBiometrics] = useState(true)
  const [pushNotifs, setPushNotifs] = useState(true)

  async function signOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('attesta_token')
          router.replace('/')
        },
      },
    ])
  }

  function Row({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
    return (
      <View style={s.row}>
        <Text style={s.rowLabel}>{label}</Text>
        <Switch value={value} onValueChange={onValueChange} trackColor={{ true: '#4f46e5' }} />
      </View>
    )
  }

  function Item({ label, sub, onPress, danger }: { label: string; sub?: string; onPress: () => void; danger?: boolean }) {
    return (
      <TouchableOpacity style={s.item} onPress={onPress}>
        <View>
          <Text style={[s.itemLabel, danger && { color: '#dc2626' }]}>{label}</Text>
          {sub && <Text style={s.itemSub}>{sub}</Text>}
        </View>
        <Text style={s.chevron}>›</Text>
      </TouchableOpacity>
    )
  }

  return (
    <ScrollView style={s.container}>
      <Text style={s.header}>Settings</Text>

      <Text style={s.section}>Security</Text>
      <Row label="Biometric unlock" value={biometrics} onValueChange={setBiometrics} />
      <Row label="Push notifications" value={pushNotifs} onValueChange={setPushNotifs} />

      <Text style={s.section}>Privacy</Text>
      <Item label="Download my data" sub="GDPR Article 20 — export all data" onPress={() => {}} />
      <Item label="Request account deletion" sub="GDPR Article 17 — erasure in 30 days" onPress={() => {}} danger />

      <Text style={s.section}>Protocol</Text>
      <Item label="OpenRep SDK" sub="@openrep/sdk v1.0.0 · MIT" onPress={() => {}} />
      <Item label="My DID document" sub="did:polygon:0x…" onPress={() => {}} />
      <Item label="DAO governance" sub="dao.openrep.io" onPress={() => {}} />

      <Text style={s.section}>About</Text>
      <Item label="Version" sub="ATTESTA 1.0.0 (Phase 12)" onPress={() => {}} />
      <Item label="Terms of Service" onPress={() => {}} />
      <Item label="Privacy Policy" onPress={() => {}} />

      <TouchableOpacity style={s.signOut} onPress={signOut}>
        <Text style={s.signOutText}>Sign out</Text>
      </TouchableOpacity>
      <View style={{ height: 60 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  header: { fontSize: 22, fontWeight: '800', color: '#111', marginTop: 60, marginBottom: 24 },
  section: { fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowLabel: { fontSize: 15, color: '#111' },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  itemLabel: { fontSize: 15, color: '#111' },
  itemSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  chevron: { fontSize: 20, color: '#d1d5db' },
  signOut: { marginTop: 32, padding: 16, backgroundColor: '#fef2f2', borderRadius: 12, alignItems: 'center' },
  signOutText: { fontSize: 15, fontWeight: '700', color: '#dc2626' },
})
