import { useState } from 'react'
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'

import { StoreProvider, useMyLoad, useStore } from './src/store'
import { DocumentScreen, Login, MyLoad, Notifications } from './src/screens'
import { Loading } from './src/ui'
import { Screen } from './src/motion'
import { FONT, R, S, T } from './src/theme'

type Tab = 'load' | 'alerts'

/**
 * SUBAYBAY, on the liaison's phone.
 *
 * Only the liaison works from here — the Encoder, the Provincial Agriculturist
 * and viewers all use the web app. The trail, the custody rule, the statuses and
 * the transitions are imported from `app/src`, not reimplemented, so a document
 * moved from this screen behaves exactly as it would in the office.
 *
 * The layout follows the web app: a dark rail carrying identity and navigation,
 * a light sheet carrying the work. On a phone the rail sits at the bottom, where
 * a thumb reaches.
 *
 * `SafeAreaView` comes from react-native-safe-area-context, not from
 * react-native itself — core RN's version is a documented no-op on Android, so
 * the top bar rendered flush under the status bar and camera cutout with
 * nothing reserving space for either.
 */
function Shell() {
  const { me, signOut, isUntouched, isUnseen } = useStore()
  const [tab, setTab] = useState<Tab>('load')
  const [docId, setDocId] = useState<string | null>(null)

  const mine = useMyLoad()
  // The same two things the Notifications screen lists, counted the same way
  // it counts them: new assignments not yet opened, and follow-ups on
  // documents she has not yet acted on.
  const assignedCount = mine.filter(isUnseen).length
  const followUpCount = mine.filter(isUntouched).reduce((n, d) => n + (d.pokes?.length ?? 0), 0)
  const unread = assignedCount + followUpCount

  const where = docId ?? tab

  return (
    <SafeAreaView style={s.app}>
      <View style={s.top}>
        <View style={s.av}><Text style={s.avTx}>SB</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.topName} numberOfLines={1}>{me?.name}</Text>
          <Text style={s.topRole}>Liaison Officer · OPAg Aurora</Text>
        </View>
        <Pressable onPress={signOut} hitSlop={10} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={s.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <View style={s.sheet}>
        <Screen tag={where}>
          {docId
            ? <DocumentScreen id={docId} onBack={() => setDocId(null)} />
            : tab === 'load'
              ? <MyLoad onOpen={setDocId} />
              : <Notifications onOpen={setDocId} />}
        </Screen>
      </View>

      <View style={s.rail}>
        <TabBtn label="My load" count={mine.length} on={tab === 'load' && !docId}
          onPress={() => { setTab('load'); setDocId(null) }} />
        <TabBtn label="Notifications" count={unread} alert={unread > 0} on={tab === 'alerts' && !docId}
          onPress={() => { setTab('alerts'); setDocId(null) }} />
      </View>
    </SafeAreaView>
  )
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function TabBtn({ label, count, on, alert, onPress }: {
  label: string; count: number; on: boolean; alert?: boolean; onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.tab, on && s.tabOn, pressed && { opacity: 0.75 }]}
    >
      <Text style={[s.tabTx, on && s.tabTxOn]}>{label}</Text>
      <View style={[s.tabN, on && s.tabNOn, alert && { backgroundColor: T.crit }]}>
        <Text style={[s.tabNTx, (on || alert) && { color: '#fff' }]}>{count}</Text>
      </View>
    </Pressable>
  )
}

function Gate() {
  const { ready, me } = useStore()
  if (!ready) return <SafeAreaView style={s.app}><Loading label="Loading your documents…" /></SafeAreaView>
  if (!me) return <SafeAreaView style={[s.app, { backgroundColor: T.panel }]}><Login /></SafeAreaView>
  return <Shell />
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar barStyle="dark-content" backgroundColor={T.desk} />
        <Gate />
      </StoreProvider>
    </SafeAreaProvider>
  )
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: T.desk },

  top: {
    flexDirection: 'row', alignItems: 'center', gap: S[3],
    paddingHorizontal: S[4], paddingVertical: S[3],
    backgroundColor: T.desk, borderBottomWidth: 1, borderBottomColor: T.line,
  },
  av: {
    width: 30, height: 30, borderRadius: R.sm, backgroundColor: T.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  avTx: { fontFamily: FONT, color: '#fff', fontSize: 10.5, fontWeight: '700' },
  topName: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: T.ink },
  topRole: { fontFamily: FONT, fontSize: 11.5, color: T.muted2 },
  signOut: { fontFamily: FONT, fontSize: 12, color: T.muted, fontWeight: '500' },

  // the light sheet, inset from the dark frame exactly as on the web
  sheet: {
    flex: 1, backgroundColor: T.desk, overflow: 'hidden',
  },

  rail: {
    flexDirection: 'row', gap: 0, padding: S[2],
    backgroundColor: T.panel, borderTopWidth: 1, borderTopColor: T.line,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S[2],
    paddingVertical: S[2], borderRadius: R.sm,
  },
  tabOn: { backgroundColor: T.brand },
  tabTx: { fontFamily: FONT, fontSize: 12.5, fontWeight: '500', color: T.muted },
  tabTxOn: { color: '#fff' },
  tabN: {
    minWidth: 22, paddingHorizontal: S[2], paddingVertical: 1,
    borderRadius: R.xs, backgroundColor: T.sub2,
  },
  tabNOn: { backgroundColor: 'rgba(255,255,255,0.22)' },
  tabNTx: { fontFamily: FONT, fontSize: 10.5, fontWeight: '700', color: T.muted, textAlign: 'center' },
})
