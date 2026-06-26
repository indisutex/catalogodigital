import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MenuDigital from './pages/MenuDigital';

function App() {
  return (
    <Router>
      <Routes>
        {/* La nueva interfaz estilo app será la página principal */}
        <Route path="/" element={<MenuDigital />} />
        <Route path="/menu" element={<MenuDigital />} />
      </Routes>
    </Router>
  );
}

export default App;
