import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Hostinger NodeJS defaults port to 3000, 8080, or reads process.env.PORT
const PORT = process.env.PORT || 3000;

// Servir archivos estáticos generados por Vite (carpeta dist)
app.use(express.static(path.join(__dirname, 'dist')));

// Para que React Router funcione, siempre devolver index.html
app.use((req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    try {
      const html = fs.readFileSync(indexPath, 'utf-8');
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (e) {
      res.status(500).send(`Error interno leyendo el archivo: ${e.message}`);
    }
  } else {
    res.status(404).send(`Error de Despliegue: No se encuentra el archivo compilado en ${indexPath}. Por favor, asegúrate de haber subido la carpeta 'dist'.`);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor de Node corriendo en el puerto ${PORT}`);
});
