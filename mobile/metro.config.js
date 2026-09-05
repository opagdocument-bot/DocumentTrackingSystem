// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

/**
 * The mobile app shares the office's rules with the web prototype.
 *
 * `app/src/data/trail.ts`, `lib/workflow.ts`, `data/seed.ts` and `types.ts` are
 * plain TypeScript with no DOM in them, so both apps import the same files
 * rather than keeping two copies of the trail, the custody rule and the
 * numbering that would drift apart the first time either changed.
 *
 * Metro only bundles from inside the project by default, hence watchFolders.
 */
const projectRoot = __dirname
const sharedRoot = path.resolve(projectRoot, '..', 'app', 'src')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [sharedRoot]

// Nothing else is pinned here on purpose. The shared files import only their own
// relative neighbours — never a package — so Metro's normal lookup is safe, and
// restricting it breaks Expo's own nested dependencies.

module.exports = config
