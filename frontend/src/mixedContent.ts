/**
 * Eine `http://`-Seite in einem Rahmen auf einer `https://`-Seite blockiert der Browser (gemischte
 * Inhalte); die Druck-App öffnet sich dann in einem eigenen Tab statt als leere Fläche.
 */
export const opensInTab = (url: string, protocol = window.location.protocol) =>
  protocol === 'https:' && url.toLowerCase().startsWith('http:')
