import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isAndroidBuild = process.env.CAPACITOR_BUILD === "true";

export default defineConfig({
  // GitHub Pages serves from /Task/, while Capacitor loads bundled assets locally.
  base: isAndroidBuild ? "./" : "/Task/",
  plugins: [react()],
});
