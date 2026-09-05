import { useEffect, useMemo, useState } from 'react'
import {
  Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'

import { FONT, R, S, T, type as ty } from './theme'
import { Btn, Card, Note, Pill, ProofSheet, StatusPill } from './ui'
import { Rise, Tap } from './motion'
import { useMyLoad, useStore } from './store'
import {
  OFFICE_SHORT, SIGNATORY_LABEL, TRAIL_OFFICES, availableActions, currentStep,
  daysAtCurrentStep, eventPhrase, loadBucket, needsRefNumberNow, statusPhrase, stepState, stepsOf, trailFor, users,
} from './shared'
import type { Action, Doc } from './shared'
import type { Proof } from '../../app/src/lib/transition'

/* ------------------------------------------------------------------ login */

export function Login() {
  const { signIn } = useStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const liaisons = users.filter((u) => u.roles[0] === 'liaison')

  return (
    <ScrollView contentContainerStyle={s.loginWrap} keyboardShouldPersistTaps="handled">
      <View style={s.brand}>
        <View style={s.mark}><Text style={s.markTx}>SB</Text></View>
        <View>
          <Text style={s.brandName}>SUBAYBAY</Text>
          <Text style={s.brandSub}>Liaison Officer · OPAg Aurora</Text>
        </View>
      </View>

      <Text style={s.h1}>Sign in</Text>
      <Text style={s.lede}>This app is for liaison officers. Everyone else works from the web.</Text>

      <Text style={s.label}>Username</Text>
      <TextInput
        style={s.input} value={username} onChangeText={(v) => { setUsername(v); setError('') }}
        autoCapitalize="none" autoCorrect={false} placeholder="e.g. aescobar" placeholderTextColor={T.muted2}
      />
      <Text style={[s.label, { marginTop: S[4] }]}>Password</Text>
      <TextInput
        style={s.input} value={password} onChangeText={(v) => { setPassword(v); setError('') }}
        secureTextEntry autoCapitalize="none" placeholder="••••••••" placeholderTextColor={T.muted2}
      />

      {!!error && <Note tone="crit">{error}</Note>}

      <View style={{ marginTop: S[5] }}>
        <Btn
          label="Sign in" tone="primary"
          onPress={() => setError(signIn(username, password) ?? '')}
        />
      </View>

      <Text style={[s.label, { marginTop: S[7] }]}>Demo accounts</Text>
      <Text style={s.hint}>
        Prototype only — these credentials are in the app itself and secure nothing.
      </Text>
      {liaisons.map((u) => (
        <Pressable
          key={u.id} style={s.acct}
          onPress={() => { setUsername(u.username); setPassword(u.password); setError('') }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.acctName}>{u.name}</Text>
            <Text style={s.acctPos}>{u.position}</Text>
          </View>
          <Text style={s.acctCred}>{u.username}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

/* ---------------------------------------------------------------- my load */

const BUCKETS = [
  { k: 'carry', title: 'Ready to carry', sub: 'Waiting for you to take them out' },
  { k: 'field', title: 'Out of the office', sub: 'In your custody until each office finishes' },
  { k: 'office', title: 'Back in the office', sub: 'The Encoder holds these — nothing for you yet' },
] as const

export function MyLoad({ onOpen }: { onOpen: (id: string) => void }) {
  const mine = useMyLoad()
  const { isUntouched } = useStore()

  const groups = useMemo(
    () => BUCKETS.map((b) => ({ ...b, docs: mine.filter((d) => loadBucket(d) === b.k) })),
    [mine],
  )
  const fresh = mine.filter(isUntouched).length

  return (
    <ScrollView contentContainerStyle={s.body}>
      <View style={s.headRow}>
        <Text style={s.h1}>My load</Text>
        {fresh > 0 && <View style={s.newTag}><Text style={s.newTagTx}>{fresh} NEW</Text></View>}
      </View>
      <Text style={s.lede}>{mine.length} document{mine.length === 1 ? '' : 's'} assigned to you</Text>

      {mine.length === 0 && (
        <Card><Text style={s.empty}>Nothing assigned to you right now.</Text></Card>
      )}

      {groups.map((g, gi) => g.docs.length > 0 && (
        <Rise key={g.k} delay={40 + gi * 55} style={{ marginTop: S[1] }}>
          <Text style={s.section}>{g.title}</Text>
          <Text style={s.sectionSub}>{g.sub}</Text>
          {g.docs.map((d) => <DocRow key={d.id} doc={d} onOpen={onOpen} isNew={isUntouched(d)} />)}
        </Rise>
      ))}
    </ScrollView>
  )
}

function DocRow({ doc, onOpen, isNew }: { doc: Doc; onOpen: (id: string) => void; isNew: boolean }) {
  const step = currentStep(doc)
  return (
    <Tap onPress={() => onOpen(doc.id)} style={s.row}>
      <View style={s.rowTop}>
        <Text style={s.rowNo}>{doc.controlNo}</Text>
        {isNew && <View style={s.newTagSm}><Text style={s.newTagTx}>NEW</Text></View>}
      </View>
      <Text style={s.rowSubject} numberOfLines={2}>{doc.subject}</Text>
      {!!step && (
        <Text style={s.rowStep} numberOfLines={1}>
          {step.requirement} · {SIGNATORY_LABEL[step.signatory]}
        </Text>
      )}
      <View style={s.rowFoot}>
        <StatusPill doc={doc} />
        <Text style={s.rowDays}>{daysAtCurrentStep(doc)}d</Text>
      </View>
    </Tap>
  )
}

/* ----------------------------------------------------------- notifications */

export function Notifications({ onOpen }: { onOpen: (id: string) => void }) {
  const mine = useMyLoad()
  const { isUntouched, isUnseen } = useStore()

  // A new assignment clears here the moment it's opened — that's what a
  // notification is. My load's own NEW tag is a different signal (it wants
  // acted on, not just looked at) and keeps using isUntouched.
  const assigned = mine.filter(isUnseen)
  const followUps = mine
    .flatMap((d) => (d.pokes ?? []).map((p) => ({ doc: d, poke: p })))
    .filter(({ doc }) => isUntouched(doc))

  return (
    <ScrollView contentContainerStyle={s.body}>
      <Text style={s.h1}>Notifications</Text>
      <Text style={s.lede}>
        {assigned.length + followUps.length === 0
          ? 'Nothing waiting.'
          : `${assigned.length + followUps.length} waiting`}
      </Text>

      {followUps.length > 0 && (
        <>
          <Text style={s.section}>Follow-ups</Text>
          {followUps.map(({ doc, poke }) => (
            <Pressable key={poke.id} onPress={() => onOpen(doc.id)} style={s.row}>
              <Pill label={`${poke.by} is following up`} tone="warn" />
              {!!poke.note && <Text style={[s.rowSubject, { marginTop: S[2] }]}>{poke.note}</Text>}
              <Text style={s.rowStep}>{doc.controlNo} · {poke.at}</Text>
            </Pressable>
          ))}
        </>
      )}

      {assigned.length > 0 && (
        <>
          <Text style={s.section}>Newly assigned to you</Text>
          {assigned.map((d) => (
            <Pressable key={d.id} onPress={() => onOpen(d.id)} style={s.row}>
              <Text style={s.rowNo}>{d.controlNo}</Text>
              <Text style={s.rowSubject} numberOfLines={2}>{d.subject}</Text>
              <View style={{ marginTop: S[2] }}><StatusPill doc={d} /></View>
            </Pressable>
          ))}
        </>
      )}

      {assigned.length + followUps.length === 0 && (
        <Card>
          <Text style={s.empty}>
            New assignments and coordinator follow-ups appear here. A follow-up clears when you
            update the document.
          </Text>
        </Card>
      )}
    </ScrollView>
  )
}

/* -------------------------------------------------------------- a document */

export function DocumentScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const { docs, me, depart, receive, recordSigned, markSeen, addExternalRef } = useStore()
  const [proving, setProving] = useState<Action | null>(null)

  // Opening the document is what clears its Notifications entry — see markSeen.
  useEffect(() => { markSeen(id) }, [id, markSeen])

  const doc = docs.find((d) => d.id === id)
  if (!doc) {
    return (
      <ScrollView contentContainerStyle={s.body}>
        <Btn label="← Back" onPress={onBack} small />
        <Card><Text style={s.empty}>Document not found.</Text></Card>
      </ScrollView>
    )
  }

  const steps = stepsOf(doc)
  const step = currentStep(doc)
  const actions = availableActions(doc, 'liaison', me?.id)

  function run(a: Action) {
    if (a.needsProof) { setProving(a); return }
    if (a.kind === 'depart') depart(doc!.id)
  }

  function confirm(proof: Proof, receivedBy: string, refNumber: string) {
    if (!proving) return
    const origin = trailFor(doc!.trailCode)?.refNumberOrigin
    if (refNumber && origin) {
      addExternalRef(doc!.id, { officeCode: origin, label: `${trailFor(doc!.trailCode)!.name} number`, number: refNumber })
    }
    if (proving.kind === 'receive') receive(doc!.id, receivedBy, proof)
    else recordSigned(doc!.id, proof)
    setProving(null)
  }

  return (
    <>
      <ScrollView contentContainerStyle={s.body}>
        <Btn label="← Back" onPress={onBack} small />

        <Text style={[s.docNo, { marginTop: S[4] }]}>{doc.controlNo}</Text>
        <Text style={s.lede}>{doc.subject}</Text>
        <View style={{ marginTop: S[3] }}><StatusPill doc={doc} /></View>

        <Card title="Where it is">
          <Text style={s.big}>{statusPhrase(doc).en}</Text>
          {!!step && (
            <Text style={s.rowStep}>
              Step {step.seq} of {steps.length} · {step.requirement} · {SIGNATORY_LABEL[step.signatory]}
            </Text>
          )}
          {!!doc.refNumber && <Text style={s.rowStep}>Reference no. {doc.refNumber}</Text>}
        </Card>

        {actions.length > 0 ? (
          <Card title="Record an update" subtitle="Every update outside the office needs a photo of the paper">
            {actions.map((a) => (
              <View key={a.id} style={{ marginTop: S[2] }}>
                <Btn label={a.label} tone="primary" onPress={() => run(a)} />
              </View>
            ))}
          </Card>
        ) : (
          <Note>This document is not yours to update right now.</Note>
        )}

        <Card title="Trail" subtitle={`${trailFor(doc.trailCode)?.name ?? ''} · ${steps.length} steps`}>
          {steps.map((st) => {
            const state = stepState(doc, st)
            return (
              <View key={st.seq} style={s.step}>
                <View style={[
                  s.stepDot,
                  state === 'done' && { backgroundColor: T.ok, borderColor: T.ok },
                  state === 'current' && { backgroundColor: T.accent, borderColor: T.accent },
                ]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.stepTx, state === 'pending' && { color: T.muted }]}>{st.requirement}</Text>
                  <Text style={s.stepMeta}>
                    {OFFICE_SHORT[st.officeCode] ?? st.officeCode}
                    {st.days != null ? ` · ${st.days}d` : ''}
                  </Text>
                </View>
              </View>
            )
          })}
        </Card>

        <Card title="History" subtitle="Append-only — nothing here can be edited">
          {[...doc.events].reverse().map((e) => {
            const file = e.fileId ? doc.files.find((f) => f.id === e.fileId) : undefined
            return (
              <View key={e.id} style={s.ev}>
                <Text style={s.evWhat}>{eventPhrase(doc, e)}</Text>
                <Text style={s.evMeta}>{e.actorName} · {e.at} · {e.source}</Text>
                {!!e.note && <Text style={s.evNote}>{e.note}</Text>}
                {!!file?.thumb && <Image source={{ uri: file.thumb }} style={s.evShot} />}
              </View>
            )
          })}
        </Card>
      </ScrollView>

      {!!proving && (
        <ProofSheet
          visible
          doc={doc}
          title={proving.label}
          description={
            proving.kind === 'receive'
              ? 'Confirm the office has taken the document in, and photograph the RECEIVED mark.'
              : 'Record that the signatory has signed. The document moves to its next step automatically.'
          }
          askName={proving.kind === 'receive' ? 'Received by (name)' : undefined}
          askRefNumber={
            proving.needsRef && needsRefNumberNow(doc) && trailFor(doc.trailCode)?.refNumberOrigin
              ? `${trailFor(doc.trailCode)!.name} number, from ${TRAIL_OFFICES[trailFor(doc.trailCode)!.refNumberOrigin!] ?? trailFor(doc.trailCode)!.refNumberOrigin}`
              : undefined
          }
          confirmLabel="Record it"
          onClose={() => setProving(null)}
          onConfirm={confirm}
        />
      )}
    </>
  )
}

const s = StyleSheet.create({
  body: { padding: S[4], paddingBottom: S[8] },
  loginWrap: { padding: S[6], paddingTop: S[8], paddingBottom: S[8] * 2 },

  brand: { flexDirection: 'row', alignItems: 'center', gap: S[3], marginBottom: S[7] },
  mark: {
    width: 36, height: 36, borderRadius: R.xs, backgroundColor: T.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  markTx: { fontFamily: FONT, color: '#fff', fontWeight: '700', fontSize: 12 },
  brandName: { fontFamily: FONT, fontSize: 16, fontWeight: '700', color: T.ink, letterSpacing: 0.3 },
  brandSub: { fontFamily: FONT, fontSize: 12, color: T.muted },

  h1: ty.h1,
  lede: { ...ty.sub, marginTop: S[1] },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: S[2] },

  label: { ...ty.label, marginBottom: S[2], marginTop: S[4] },
  input: {
    borderWidth: 1, borderColor: T.line2, borderRadius: R.sm,
    paddingVertical: S[3], paddingHorizontal: S[3],
    fontFamily: FONT, fontSize: 15, color: T.ink, backgroundColor: T.panel,
  },
  hint: { ...ty.small, lineHeight: 17, marginBottom: S[2] },

  acct: {
    flexDirection: 'row', alignItems: 'center', gap: S[3],
    borderWidth: 1, borderColor: T.line, backgroundColor: T.panel,
    borderRadius: R.sm, padding: S[3], marginTop: S[2],
  },
  acctName: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: T.ink },
  acctPos: { fontFamily: FONT, fontSize: 12, color: T.muted },
  acctCred: { fontFamily: FONT, fontSize: 12.5, color: T.accent, fontWeight: '600' },

  section: { ...ty.label, marginTop: S[6] },
  sectionSub: { fontFamily: FONT, fontSize: 12, color: T.muted2, marginBottom: S[3] },
  empty: { ...ty.sub },

  row: {
    backgroundColor: T.panel, borderWidth: 1, borderColor: T.line,
    borderRadius: R.md, padding: S[4], marginBottom: S[3],
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: S[2] },
  rowNo: { fontFamily: FONT, fontSize: 13, fontWeight: '700', color: T.ink, letterSpacing: 0.2 },
  rowSubject: { fontFamily: FONT, fontSize: 15, color: T.ink, marginTop: S[1], lineHeight: 21 },
  rowStep: { fontFamily: FONT, fontSize: 12.5, color: T.muted, marginTop: S[1], lineHeight: 18 },
  rowFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: S[3] },
  rowDays: { fontFamily: FONT, fontSize: 12.5, color: T.muted },

  newTag: { backgroundColor: T.accent, borderRadius: R.pill, paddingHorizontal: S[2], paddingVertical: 2 },
  newTagSm: { backgroundColor: T.accent, borderRadius: R.pill, paddingHorizontal: S[1] + 2, paddingVertical: 1 },
  newTagTx: { fontFamily: FONT, color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  docNo: { fontFamily: FONT, fontSize: 19, fontWeight: '700', color: T.ink, letterSpacing: 0.3 },
  big: { fontFamily: FONT, fontSize: 15.5, fontWeight: '600', color: T.ink },

  step: { flexDirection: 'row', gap: S[3], paddingVertical: S[2], borderTopWidth: 1, borderTopColor: T.line },
  stepDot: {
    width: 11, height: 11, borderRadius: 6, marginTop: 5,
    borderWidth: 1, borderColor: T.line2, backgroundColor: T.panel,
  },
  stepTx: { fontFamily: FONT, fontSize: 13.5, color: T.ink, lineHeight: 19 },
  stepMeta: { ...ty.small, marginTop: 1 },

  ev: { paddingVertical: S[3], borderTopWidth: 1, borderTopColor: T.line },
  evWhat: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: T.ink },
  evMeta: { ...ty.small, marginTop: 2 },
  evNote: { fontFamily: FONT, fontSize: 13, color: T.ink2, marginTop: S[1], lineHeight: 19 },
  evShot: { width: 114, height: 84, borderRadius: R.sm, marginTop: S[2], backgroundColor: T.sub2 },
})
