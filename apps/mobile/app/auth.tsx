/**
 * Auth screen — email/Google/SIWE wallet login
 * On success: stores JWT in SecureStore, navigates to tabs
 */
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { useRouter } from 'expo-router'

export default function AuthScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function login() {
    if (!email || !password) { Alert.alert('Enter email and password'); return }
    setLoading(true)
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.attesta.io'
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { Alert.alert('Login failed', data.message ?? 'Unknown error'); return }
      await SecureStore.setItemAsync('attesta_token', data.accessToken)
      router.replace('/(tabs)')
    } catch (e) {
      Alert.alert('Error', 'Could not connect to ATTESTA')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.logo}>
        <Text style={s.logoText}>ATTESTA</Text>
        <Text style={s.tagline}>The Trust Infrastructure of Professional Work</Text>
      </View>

      <TextInput
        style={s.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholderTextColor="#9ca3af"
      />
      <TextInput
        style={s.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor="#9ca3af"
      />

      <TouchableOpacity style={[s.btn, loading && { opacity: 0.6 }]} onPress={login} disabled={loading}>
        <Text style={s.btnText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
      </TouchableOpacity>

      <View style={s.divider}>
        <View style={s.divLine} />
        <Text style={s.divText}>or continue with</Text>
        <View style={s.divLine} />
      </View>

      <TouchableOpacity style={s.walletBtn}>
        <Text style={s.walletBtnText}>🔐  Connect Wallet (SIWE)</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, justifyContent: 'center' },
  logo: { alignItems: 'center', marginBottom: 48 },
  logoText: { fontSize: 32, fontWeight: '900', color: '#4f46e5', letterSpacing: -1 },
  tagline: { fontSize: 12, color: '#9ca3af', marginTop: 4, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, fontSize: 15, marginBottom: 12, color: '#111' },
  btn: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24, gap: 12 },
  divLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  divText: { fontSize: 12, color: '#9ca3af' },
  walletBtn: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, alignItems: 'center' },
  walletBtnText: { fontSize: 15, color: '#111', fontWeight: '600' },
})
