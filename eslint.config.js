import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public/mediapipe', 'playwright-report', 'test-results'] },
  js.configs.recommended, ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  { files: ['src/**/*.{ts,tsx}'], plugins: { 'react-hooks': hooks }, rules: { ...hooks.configs.recommended.rules } },
  // R3F owns mutable scene objects outside React's immutable render data.
  { files: ['src/features/model-viewer/Viewer.tsx'], rules: { 'react-hooks/immutability': 'off' } },
);
