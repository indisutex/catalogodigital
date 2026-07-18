import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MenuDigital from './pages/MenuDigital';
import Admin from './pages/Admin';
import SuperAdmin from './pages/SuperAdmin';
import PagoNequi from './pages/PagoNequi';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <Router>
      <Routes>
        {/* La nueva interfaz estilo app será la página principal */}
        <Route path="/" element={<MenuDigital />} />
        <Route path="/menu" element={<MenuDigital />} />
        
        {/* Panel de Administración */}
        <Route path="/admin" element={<ErrorBoundary><Admin /></ErrorBoundary>} />
        <Route path="/:tenant/admin" element={<ErrorBoundary><Admin /></ErrorBoundary>} />
        <Route path="/superadmin" element={<ErrorBoundary><SuperAdmin /></ErrorBoundary>} />

        {/* Pago Nequi - página pública para subir comprobante */}
        <Route path="/pago/:pedidoId" element={<PagoNequi />} />

        {/* Fallback para URLs antiguas como /products */}
        <Route path="*" element={<MenuDigital />} />
      </Routes>
    </Router>
  );
}

export default App;
