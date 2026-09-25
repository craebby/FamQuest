declare module 'virtual:task-icons' {
  /** SVG-Inhalte der Katalog-Icons (siehe vite.config.ts), Name → `<svg>`-Body. */
  const taskIcons: { width: number; height: number; icons: Record<string, string> }
  export default taskIcons
}
