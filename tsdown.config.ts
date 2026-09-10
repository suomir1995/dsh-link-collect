/**
 * Standalone tsdown config for the dsh-link-collect client bundle.
 *
 * Emits the closure-factory artifact the web shell expects:
 * `window.__ModuleLoader__.load({ id: "dsh-link-collect", factory: (require) => {...} })`,
 * with externals resolved through the injected require (the shell's module
 * table — react family only for this plugin; everything else is inlined).
 *
 * Mirrors the dsh-api-client / dsh-steam-deals standalone config (the
 * repository preset `packages/client/tsdown.client.ts` cannot be used from
 * an out-of-tree bundle because it resolves workspace manifests by name).
 */

const MODULE_TABLE_KEYS = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
])

/** Production build unless NODE_ENV says otherwise (matches the repo preset). */
const env = process.env.NODE_ENV ?? 'production'

export default {
  name: 'dsh-link-collect/client',
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  dts: false,
  clean: false,
  sourcemap: true,
  entryFileNames: 'client.js',
  deps: {
    neverBundle: (specifier: string) => MODULE_TABLE_KEYS.has(specifier),
    alwaysBundle: (specifier: string) => !MODULE_TABLE_KEYS.has(specifier),
  },
  inputOptions: {
    resolve: {
      conditionNames: [env === 'development' ? 'development' : 'production', 'browser', 'import', 'module', 'default'],
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(env),
    'import.meta.env.MODE': JSON.stringify(env),
    'import.meta.env': JSON.stringify({ MODE: env }),
  },
  banner: 'window.__ModuleLoader__.load({ id: "dsh-link-collect", factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;',
  footer: 'return module.exports; } });',
}
