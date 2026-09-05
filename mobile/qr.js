/**
 * Prints the Expo tunnel QR in its own terminal window.
 *
 * The tunnel host is a fresh random name on every restart, so this reads the
 * live one out of Metro's own manifest instead of hard-coding it. Run it in a
 * second window while `npm run tunnel` holds the first — it waits for the
 * tunnel to finish handshaking rather than failing if it starts too early.
 */
const qr = require('qrcode-terminal')

const MANIFEST = 'http://127.0.0.1:8081/'
const HEADERS = {
  'expo-platform': 'android',
  accept: 'application/expo+json,application/json',
}

/** The `<slug>.exp.direct` host, once ngrok has published it. */
async function tunnelHost(triesLeft) {
  try {
    const res = await fetch(MANIFEST, { headers: HEADERS })
    const found = (await res.text()).match(/[a-z0-9-]+\.exp\.direct/)
    if (found) return found[0]
    // Metro answers well before ngrok does; keep waiting.
  } catch {
    // Metro is not listening yet.
  }
  if (triesLeft <= 0) return null
  await new Promise((resolve) => setTimeout(resolve, 2000))
  return tunnelHost(triesLeft - 1)
}

async function main() {
  console.log('\n  Waiting for the Expo tunnel to come up...')

  const host = await tunnelHost(90) // three minutes; ngrok is slow on first run
  if (!host) {
    console.log('\n  No tunnel found on port 8081.')
    console.log('  Start one first:  npm run tunnel\n')
    return
  }

  const url = `exp://${host}`
  console.log('\n  SUBAYBAY — liaison app\n')
  qr.generate(url, { small: true }, (code) => console.log(code))
  console.log(`  ${url}\n`)
  console.log('  Android — open Expo Go, tap "Scan QR code"')
  console.log('  iOS     — open the Camera app and point it at the QR')
  console.log('  Neither scanning? Type the URL into Expo Go by hand.\n')
}

main()
