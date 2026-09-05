import { useState } from 'react'
import {
  ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'

import { FONT, R, S, T, toneColors, type as ty } from './theme'
import type { Tone } from './theme'
import { statusPhrase } from './shared'
import type { Doc } from './shared'
import type { Proof } from '../../app/src/lib/transition'

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const c = toneColors[tone]
  return (
    <View style={[s.pill, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={[s.dot, { backgroundColor: c.fg }]} />
      <Text style={[s.pillTx, { color: c.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  )
}

export function StatusPill({ doc }: { doc: Doc }) {
  const p = statusPhrase(doc)
  return <Pill label={p.en} tone={p.tone} />
}

export function Card({ title, subtitle, right, children }: {
  title?: string; subtitle?: string; right?: React.ReactNode; children?: React.ReactNode
}) {
  return (
    <View style={s.card}>
      {(title || right) && (
        <View style={s.cardH}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {!!title && <Text style={ty.h3}>{title}</Text>}
            {!!subtitle && <Text style={[ty.sub, { marginTop: 2 }]}>{subtitle}</Text>}
          </View>
          {right}
        </View>
      )}
      {children}
    </View>
  )
}

export function Btn({ label, onPress, tone = 'default', disabled, small }: {
  label: string
  onPress: () => void
  tone?: 'default' | 'primary' | 'danger'
  disabled?: boolean
  small?: boolean
}) {
  const bg = tone === 'primary' ? T.brand : tone === 'danger' ? T.crit : T.panel
  const fg = tone === 'default' ? T.ink2 : '#fff'
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSm,
        { backgroundColor: bg, borderColor: tone === 'default' ? T.line2 : bg },
        disabled && { opacity: 0.4 },
        pressed && !disabled && { opacity: 0.82, transform: [{ scale: 0.98 }] },
      ]}
    >
      <Text style={[s.btnTx, small && { fontSize: 12.5 }, { color: fg }]}>{label}</Text>
    </Pressable>
  )
}

export function Note({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: Tone }) {
  const c = toneColors[tone]
  return (
    <View style={[s.note, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[s.noteTx, { color: tone === 'neutral' ? T.ink2 : c.fg }]}>{children}</Text>
    </View>
  )
}

export function Loading({ label }: { label: string }) {
  return (
    <View style={s.loading}>
      <ActivityIndicator color={T.accent} />
      <Text style={ty.sub}>{label}</Text>
    </View>
  )
}

/**
 * Proof of custody, on a phone.
 *
 * The office's rule: outside its walls, nothing is recorded on a liaison's word
 * alone. This opens the camera, keeps the photo, and refuses to confirm until
 * there is one — the same gate as the web app, but pointed at the rear camera
 * because the liaison is standing in front of the document.
 */
export function ProofSheet({ visible, doc, title, description, askName, askRefNumber, confirmLabel, onClose, onConfirm }: {
  visible: boolean
  doc: Doc
  title: string
  description: string
  askName?: string
  /** when set, also collect the outside reference number this step produces —
   *  a step in the field can need both a photo and this number at once, so
   *  one sheet collects both rather than a second prompt that would skip the
   *  photo. */
  askRefNumber?: string
  confirmLabel: string
  onClose: () => void
  onConfirm: (proof: Proof, receivedBy: string, refNumber: string) => void
}) {
  const [uri, setUri] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [who, setWho] = useState('')
  const [refNumber, setRefNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const ready = uri !== null && (!askName || who.trim() !== '') && (!askRefNumber || refNumber.trim() !== '')

  function reset() { setUri(null); setName(''); setWho(''); setRefNumber(''); setErr('') }

  async function capture(fromLibrary: boolean) {
    setErr('')
    setBusy(true)
    try {
      const perm = fromLibrary
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        setErr(fromLibrary ? 'Photo access was declined.' : 'Camera access was declined.')
        return
      }
      const result = fromLibrary
        ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 })
        : await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 })
      if (result.canceled) return
      const a = result.assets[0]
      setUri(a.uri)
      setName(a.fileName ?? `${doc.controlNo}-received.jpg`)
    } catch {
      setErr('The camera could not be opened on this device.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onClose() }}>
      <View style={s.sheetBg}>
        <View style={s.sheet}>
          <ScrollView contentContainerStyle={{ padding: S[5], paddingBottom: S[2] }}>
            <Text style={ty.h2}>{title}</Text>
            <Text style={[ty.sub, { marginTop: S[1] }]}>{description}</Text>

            <Note>{doc.controlNo} — {doc.subject}</Note>

            {!!askName && (
              <View style={{ marginTop: S[4] }}>
                <Text style={[ty.label, { marginBottom: S[2] }]}>{askName} *</Text>
                <TextInput
                  style={s.input} value={who} onChangeText={setWho}
                  placeholder="e.g. Mila R." placeholderTextColor={T.muted2}
                />
              </View>
            )}

            {!!askRefNumber && (
              <View style={{ marginTop: S[4] }}>
                <Text style={[ty.label, { marginBottom: S[2] }]}>{askRefNumber} *</Text>
                <TextInput
                  style={[s.input, ty.mono]} value={refNumber} onChangeText={setRefNumber}
                  placeholder="As written on the paper" placeholderTextColor={T.muted2}
                />
              </View>
            )}

            <Text style={[ty.label, { marginTop: S[5], marginBottom: S[2] }]}>
              Photo of the document marked RECEIVED *
            </Text>

            {uri ? (
              <View style={s.shot}>
                <Image source={{ uri }} style={s.shotImg} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.shotName} numberOfLines={1}>{name}</Text>
                  <Pressable onPress={() => { setUri(null); setName('') }}>
                    <Text style={s.link}>Retake</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', gap: S[2] }}>
                  <View style={{ flex: 1 }}>
                    <Btn label={busy ? 'Opening…' : 'Take photo'} tone="primary" onPress={() => capture(false)} disabled={busy} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Btn label="From gallery" onPress={() => capture(true)} disabled={busy} />
                  </View>
                </View>
                <Text style={[ty.small, { marginTop: S[2], lineHeight: 17 }]}>
                  The stamp, sticker or the word RECEIVED written on the paper must be legible. This is
                  what proves the document changed hands.
                </Text>
              </>
            )}

            {!!err && <Note tone="crit">{err}</Note>}
          </ScrollView>

          <View style={s.sheetFoot}>
            <Btn label="Cancel" onPress={() => { reset(); onClose() }} />
            <Btn
              label={confirmLabel} tone="primary" disabled={!ready}
              onPress={() => {
                onConfirm({ name: name || `${doc.controlNo}-received.jpg`, thumb: uri ?? undefined }, who.trim(), refNumber.trim())
                reset()
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: S[2], alignSelf: 'flex-start',
    borderWidth: 1, borderRadius: R.xs, paddingVertical: S[1], paddingHorizontal: S[3],
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillTx: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },

  card: {
    backgroundColor: T.panel, borderWidth: 1, borderColor: T.line,
    borderRadius: R.md, padding: S[4], marginBottom: S[3],
  },
  cardH: { flexDirection: 'row', alignItems: 'flex-start', gap: S[3], marginBottom: S[3] },

  btn: {
    borderWidth: 1, borderRadius: R.sm, paddingVertical: S[3], paddingHorizontal: S[4],
    alignItems: 'center', justifyContent: 'center',
  },
  btnSm: { paddingVertical: S[2], paddingHorizontal: S[3] },
  btnTx: { fontFamily: FONT, fontSize: 14, fontWeight: '600' },

  note: { borderWidth: 1, borderRadius: R.sm, padding: S[3], marginTop: S[3] },
  noteTx: { fontFamily: FONT, fontSize: 13, lineHeight: 19 },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S[3] },

  sheetBg: { flex: 1, backgroundColor: 'rgba(28,27,24,0.34)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T.panel, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg,
    maxHeight: '92%', borderTopWidth: 3, borderTopColor: T.accent,
  },
  sheetFoot: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: S[2],
    padding: S[4], borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.sub,
  },

  input: {
    borderWidth: 1, borderColor: T.line2, borderRadius: R.sm,
    paddingVertical: S[3], paddingHorizontal: S[3],
    fontFamily: FONT, fontSize: 14.5, color: T.ink, backgroundColor: T.panel,
  },

  shot: {
    flexDirection: 'row', alignItems: 'center', gap: S[3], marginTop: S[2],
    borderWidth: 1, borderColor: T.line2, borderRadius: R.sm, padding: S[2],
  },
  shotImg: { width: 78, height: 58, borderRadius: R.sm, backgroundColor: T.sub2 },
  shotName: { fontFamily: FONT, fontSize: 13, color: T.ink, fontWeight: '600' },
  link: { fontFamily: FONT, color: T.accent, fontSize: 13, marginTop: 3, fontWeight: '600' },
})
