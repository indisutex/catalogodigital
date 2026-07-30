import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const distPath = path.resolve(__dirname, 'dist');

// Servir todos los archivos estáticos de la build Vite
app.use(express.static(distPath, {
  maxAge: '1d',
  etag: true
}));

// Fallback SPA para todas las rutas (ej: /admin, /sublimados_majestic, etc.)
app.get('*', (req, res) => {
  res.sendFile(path.resolve(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor Node/Express corriendo en el puerto ${PORT}`);
});
