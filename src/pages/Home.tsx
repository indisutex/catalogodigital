import { ArrowRight, Star, Truck, ShieldCheck } from 'lucide-react';
import './Home.css';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero container animate-fade-in">
        <div className="hero-content glass-panel">
          <h1>Dulces Sueños para tus Pequeños</h1>
          <p className="hero-subtitle">
            Descubre nuestra colección exclusiva de productos para bebé y pijamas estampadas.
            Comodidad, estilo y ternura en cada prenda.
          </p>
          <div className="hero-actions">
            <Link to="/products" className="btn-primary">
              Ver Colección <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features container">
        <div className="feature-card glass-panel">
          <Truck className="feature-icon" size={32} />
          <h3>Envío Rápido</h3>
          <p>Llevamos tus productos a la puerta de tu casa en tiempo récord.</p>
        </div>
        <div className="feature-card glass-panel">
          <ShieldCheck className="feature-icon" size={32} />
          <h3>Compra Segura</h3>
          <p>Tu información y pagos están 100% protegidos.</p>
        </div>
        <div className="feature-card glass-panel">
          <Star className="feature-icon" size={32} />
          <h3>Calidad Premium</h3>
          <p>Materiales suaves y seguros, perfectos para la piel del bebé.</p>
        </div>
      </section>

      {/* Placeholder for Products */}
      <section className="featured-products container">
        <h2 className="section-title">Productos Destacados</h2>
        <div className="products-grid">
          {/* This is where Supabase products will map out */}
          <div className="product-card glass-panel">
            <div className="product-image-placeholder"></div>
            <div className="product-info">
              <h4>Pijama Estampada Dinosaurios</h4>
              <p className="product-price">$25.00</p>
              <button className="btn-primary">Añadir al carrito</button>
            </div>
          </div>
          <div className="product-card glass-panel">
            <div className="product-image-placeholder"></div>
            <div className="product-info">
              <h4>Conjunto Algodón Bebé</h4>
              <p className="product-price">$30.00</p>
              <button className="btn-primary">Añadir al carrito</button>
            </div>
          </div>
          <div className="product-card glass-panel">
            <div className="product-image-placeholder"></div>
            <div className="product-info">
              <h4>Manta Suave Estrellas</h4>
              <p className="product-price">$18.00</p>
              <button className="btn-primary">Añadir al carrito</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
