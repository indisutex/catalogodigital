import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Products from './pages/Products';
import MenuDigital from './pages/MenuDigital';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/menu" element={<MenuDigital />} />
        
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="products" element={<Products />} />
          {/* Add more routes here like /cart */}
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
