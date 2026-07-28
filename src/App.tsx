import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MenuDigital from './pages/MenuDigital';
import PagoNequi from './pages/PagoNequi';
import { ErrorBoundary } from './components/ErrorBoundary';

const Admin = lazy(() => import('./pages/Admin'));
const SuperAdmin = lazy(() => import('./pages/SuperAdmin'));

const LoadingFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: '48px', height: '48px', border: '4px solid #cbd5e1', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
      <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>Cargando panel...</span>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* La nueva interfaz estilo app será la página principal */}
          <Route path="/" element={<MenuDigital />} />
          <Route path="/menu" element={<MenuDigital />} />
          <Route path="/:tenant" element={<MenuDigital />} />
          <Route path="/:tenant/menu" element={<MenuDigital />} />
          
          {/* Panel de Administración */}
          <Route path="/admin" element={<ErrorBoundary><Admin /></ErrorBoundary>} />
          <Route path="/:tenant/admin" element={<ErrorBoundary><Admin /></ErrorBoundary>} />
          <Route path="/superadmin" element={<ErrorBoundary><SuperAdmin /></ErrorBoundary>} />

          {/* Pago Nequi - página pública para subir comprobante */}
          <Route path="/pago/:pedidoId" element={<PagoNequi />} />

          {/* Fallback para URLs antiguas como /products */}
          <Route path="*" element={<MenuDigital />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
