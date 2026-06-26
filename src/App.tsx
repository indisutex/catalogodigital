import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MenuDigital from './pages/MenuDigital';
import Admin from './pages/Admin';

function App() {
  return (
    <Router>
      <Routes>
        {/* La nueva interfaz estilo app será la página principal */}
        <Route path="/" element={<MenuDigital />} />
        <Route path="/menu" element={<MenuDigital />} />
        
        {/* Panel de Administración */}
        <Route path="/admin" element={<Admin />} />

        {/* Fallback para URLs antiguas como /products */}
        <Route path="*" element={<MenuDigital />} />
      </Routes>
    </Router>
  );
}

export default App;
