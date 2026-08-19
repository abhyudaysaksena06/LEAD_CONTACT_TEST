import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

// ===== Pages imported from the SourcePage project (untouched) =====
import Home from './sections/Home/Home'
import Team from './sections/Team'
import ArcReactor from './sections/Sponsors/ArcReactor'
import Contact from './sections/Contact/ContactPage'
import Register from './sections/Register/RegisterPage'
import Admin from './sections/Admin/AdminPage'
import { SPONSORS_DATA } from './data/sponsorsData'

// ===== Pages imported from the SourcePage Events / PhotoGallery projects =====
import Events from './sections/EventsPage/App'
import GalleryTunnel from './sections/GalleryPage/components/TunnelSection'
import './sections/GalleryPage/styles/global.css'
import NotFound from './sections/NotFound/NotFound'

// ===== Standalone shell =====
import SiteNav from './components/SiteNav/SiteNav'
import CommandPalette from './components/CommandPalette/CommandPalette'
import Preloader from './components/Preloader/Preloader'
import RegisterPopup from './components/RegisterPopup/RegisterPopup'
import { CommandPaletteProvider, useCommandPalette } from './context/CommandPaletteContext'
import { prefetchSiteAssets } from './utils/prefetchAssets'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function SiteChrome() {
  // /admin is a standalone console — no marketing nav or persistent Home behind it.
  const { pathname } = useLocation()
  if (pathname === '/admin') return null
  return (
    <>
      <SiteNav />
      <GlobalCommandPalette />
      <PersistentHome />
    </>
  )
}

function GlobalCommandPalette() {
  const { isVisible } = useCommandPalette();
  return <CommandPalette visible={isVisible} />;
}

function PersistentHome() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  return (
    <div style={{ display: isHome ? 'block' : 'none' }}>
      <Home isHome={isHome} />
    </div>
  )
}

// Routes that are landed on directly — usually from a shared link — and should
// open straight away rather than behind the intro clip.
const SKIP_PRELOADER = ['/register']

function App() {
  const [booting, setBooting] = useState(() => {
    if (sessionStorage.getItem('preloader_shown')) return false
    return !SKIP_PRELOADER.includes(window.location.pathname)
  })

  // When the intro is skipped, mark it as seen so navigating to the rest of the
  // site later in the same session does not suddenly play it, and kick off the
  // asset warm-up that the preloader would normally have started.
  useEffect(() => {
    if (booting) return
    if (sessionStorage.getItem('preloader_shown')) return
    sessionStorage.setItem('preloader_shown', 'true')
    prefetchSiteAssets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePreloaderComplete = () => {
    sessionStorage.setItem('preloader_shown', 'true')
    setBooting(false)
  }

  return (
    <CommandPaletteProvider>
      {booting && <Preloader onComplete={handlePreloaderComplete} />}
      <BrowserRouter>
        <ScrollToTop />
        <SiteChrome />
        {!booting && <RegisterPopup />}
        <Routes>
          <Route path="/" element={null} />
          <Route path="/events" element={<Events />} />
          <Route path="/team" element={<Team />} />
          <Route path="/sponsors" element={<ArcReactor sponsors={SPONSORS_DATA} />} />
          <Route path="/gallery" element={<GalleryTunnel />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/register" element={<Register />} />
          {/* Unlisted: no nav entry, no sitemap. Protected by Supabase Auth + RLS. */}
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </CommandPaletteProvider>
  )
}

export default App
