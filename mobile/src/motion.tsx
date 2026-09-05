import { useEffect, useRef } from 'react'
import { Animated, Easing, Pressable } from 'react-native'
import type { ViewStyle } from 'react-native'

/**
 * The transitions, in one place.
 *
 * The web app fades each screen up as it arrives and settles its cards a beat
 * behind. These do the same on the phone, with the platform's own driver so the
 * work happens off the JS thread and the animation survives a slow render.
 */

const DUR = 240
const EASE = Easing.bezier(0.4, 0, 0.2, 1)

/** A screen, or anything in one, arriving. `delay` staggers a list. */
export function Rise({ children, delay = 0, style }: {
  children: React.ReactNode
  delay?: number
  style?: ViewStyle | ViewStyle[]
}) {
  const t = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const a = Animated.timing(t, {
      toValue: 1, duration: DUR, delay, easing: EASE, useNativeDriver: true,
    })
    a.start()
    return () => a.stop()
  }, [t, delay])

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}

/** A row or card that answers a touch by pressing in. */
export function Tap({ children, onPress, style, disabled }: {
  children: React.ReactNode
  onPress: () => void
  style?: ViewStyle | ViewStyle[]
  disabled?: boolean
}) {
  const scale = useRef(new Animated.Value(1)).current

  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 0 }).start()

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => to(0.975)}
      onPressOut={() => to(1)}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  )
}

/** Cross-fade between whole screens, so a tab change is not a hard cut. */
export function Screen({ children, tag }: { children: React.ReactNode; tag: string }) {
  const t = useRef(new Animated.Value(0)).current
  const last = useRef(tag)

  useEffect(() => {
    t.setValue(0)
    last.current = tag
    const a = Animated.timing(t, { toValue: 1, duration: DUR, easing: EASE, useNativeDriver: true })
    a.start()
    return () => a.stop()
  }, [tag, t])

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: t,
        transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  )
}
