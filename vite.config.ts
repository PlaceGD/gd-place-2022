import { defineConfig } from "vite"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import FullReload from "vite-plugin-full-reload"
import pages from "vite-plugin-pages-svelte"

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [svelte(), FullReload(["src/**/*"])],
    server: {
        port: 8080,
    },
})
