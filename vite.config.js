import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        port: 8080,
        open: true
    },
    root: '.',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    }
});
