// Applies the saved theme before first paint to avoid a flash. Kept as a separate file so the
// Content-Security-Policy can forbid inline scripts.
try {
  var t = localStorage.getItem('theme')
  if (t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  }
} catch {
  // storage unavailable: fall back to the default theme
}
