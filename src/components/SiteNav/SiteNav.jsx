import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import '../Navbar/Navbar.css'
import './SiteNav.css'
import leadLogo from '../../assets/LEAD.png'

// Route-driven version of the SourcePage Home navbar — same markup and styles,
// with the scroll-spy swapped for router links.
const centerItems = [
  { to: '/events', label: 'Highlights' },
  { to: '/team', label: 'Leadership' },
  { to: '/sponsors', label: 'Network' },
  { to: '/gallery', label: 'Archive' },
]

const contactItem = { to: '/contact', label: "Let's Connect" }

// All items for the mobile menu
const navItems = [...centerItems, contactItem]

const SiteNav = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  // Close the mobile menu whenever the route changes
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // Close menu on ESC
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <>
      <div className="navbar-container">
        <nav className="floating-navbar">

          {/* Logo */}
          <div className="nav-logo-section">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-logo-link ${isActive ? 'active-logo' : ''}`}
            >
              <img src={leadLogo} alt="LEAD Logo" className="nav-logo" />
            </NavLink>
          </div>

          {/* Desktop Centre Links: Highlights → Archive */}
          <div className="nav-links-section">
            {centerItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Right Side: Let's Connect — mirrors the logo section on the left */}
          <div className="nav-contact-section">
            <NavLink
              to={contactItem.to}
              className={({ isActive }) =>
                `nav-item nav-item--contact ${isActive ? 'active' : ''}`
              }
            >
              {contactItem.label}
            </NavLink>
          </div>

          {/* Hamburger Button (mobile only) */}
          <button
            className={`hamburger-btn ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

        </nav>
      </div>

      {/* Mobile Dropdown Menu */}
      <div className={`mobile-menu ${menuOpen ? 'mobile-menu--open' : ''}`}>
        <div className="mobile-menu-inner">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Backdrop */}
      {menuOpen && (
        <div className="mobile-menu-backdrop" onClick={() => setMenuOpen(false)} />
      )}
    </>
  )
}

export default SiteNav
