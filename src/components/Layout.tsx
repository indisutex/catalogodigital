import { Outlet, Link } from 'react-router-dom';
import { ShoppingCart, Menu, Baby, PersonStanding, Puzzle, GraduationCap, Phone } from 'lucide-react';
import './Layout.css';

export default function Layout() {
  return (
    <div className="layout-wrapper">
      <header className="main-header">
        <div className="header-top container">
          <nav className="header-nav">
            <Link to="/" className="nav-link">Home</Link>
            <Link to="/blog" className="nav-link">Our Blog</Link>
            <Link to="/about" className="nav-link">About Us</Link>
            <Link to="/contact" className="nav-link">Contact Us</Link>
          </nav>
          
          <div className="logo-container">
            <Link to="/" className="brand-logo-img">
              <div className="logo-circle">
                <span className="logo-letter c1">M</span>
                <span className="logo-letter c2">o</span>
                <span className="logo-letter c3">z</span>
                <span className="logo-letter c4">t</span>
                <span className="logo-letter c1">a</span>
                <span className="logo-letter c2">c</span>
                <span className="logo-letter c3">i</span>
                <span className="logo-letter c4">t</span>
                <span className="logo-letter c1">o</span>
              </div>
              <span className="logo-text">Store</span>
            </Link>
          </div>

          <div className="header-actions">
            <div className="language-selector">
              <span>🇬🇧 ENG</span>
            </div>
            <button className="cart-btn" aria-label="Carrito de compras">
              <ShoppingCart size={22} />
              <span className="cart-badge">0</span>
            </button>
            <button className="mobile-menu-btn" aria-label="Menú">
              <Menu size={24} />
            </button>
          </div>
        </div>
      </header>

      <div className="layout-content container">
        <aside className="main-sidebar">
          <div className="sidebar-menu">
            <Link to="/products" className="sidebar-link">
              <div className="sidebar-icon-wrapper i1"><Baby size={20}/></div>
              Babies
            </Link>
            <Link to="/products" className="sidebar-link">
              <div className="sidebar-icon-wrapper i2"><PersonStanding size={20}/></div>
              Kids
            </Link>
            <Link to="/products" className="sidebar-link">
              <div className="sidebar-icon-wrapper i3"><Puzzle size={20}/></div>
              Puzzles
            </Link>
            <Link to="/products" className="sidebar-link">
              <div className="sidebar-icon-wrapper i4"><GraduationCap size={20}/></div>
              Educational Toys
            </Link>
            <Link to="/products" className="sidebar-link">
              <div className="sidebar-icon-wrapper i1"><Phone size={20}/></div>
              Pacifier
            </Link>
          </div>

          <div className="newsletter-box">
            <h4>Newsletter</h4>
            <p>Sign up for newsletter to receive special offers</p>
            <input type="email" placeholder="Enter Your Email" className="newsletter-input"/>
            <button className="btn-primary btn-small newsletter-btn">Subscribe</button>
          </div>
        </aside>

        <main className="main-area">
          <Outlet />
        </main>
      </div>
      
      <footer className="main-footer">
        <div className="container">
          <p>&copy; {new Date().getFullYear()} Bibo Store. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
