import { Outlet, Link } from 'react-router-dom';
import { ShoppingCart, Menu } from 'lucide-react';
import './Layout.css';

export default function Layout() {
  return (
    <div className="layout-container">
      <header className="header glass-panel">
        <div className="container flex items-center justify-between header-content">
          <Link to="/" className="brand-logo">
            <span>Bebé</span> & Pijamas
          </Link>
          
          <nav className="desktop-nav">
            <Link to="/" className="nav-link">Inicio</Link>
            <Link to="/products" className="nav-link">Catálogo</Link>
            <Link to="/contact" className="nav-link">Contacto</Link>
          </nav>
          
          <div className="header-actions">
            <button className="cart-btn" aria-label="Carrito de compras">
              <ShoppingCart size={24} />
              <span className="cart-badge">0</span>
            </button>
            <button className="mobile-menu-btn" aria-label="Menú">
              <Menu size={24} />
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container">
          <p>&copy; {new Date().getFullYear()} Tienda Bebé & Pijamas. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
