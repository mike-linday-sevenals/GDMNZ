export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }
  },
  build: { outDir: "build", emptyOutDir: true }   // <-- important
});
