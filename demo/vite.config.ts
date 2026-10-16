import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { 'react-native': 'react-native-web', 'workload-calculator': path.resolve(__dirname, '../src/index.ts') },
    extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.js'],
  },
  define: { __DEV__: 'true' },
});
