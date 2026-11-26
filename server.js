import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Hostinger NodeJS defaults port to 3000, 8080, or reads process.env.PORT
const PORT = process.env.PORT || 3000;

// Servir manifest.json dinámico aislado por tenant / catálogo
app.get('/manifest.json', (req, res) => {
  let tenant = req.query.tenant;
  if (!tenant && req.headers.referer) {
    try {
      const refUrl = new URL(req.headers.referer);
      const parts = refUrl.pathname.replace(/^\/+|\/+$/g, '').split('/');
      const first = parts[0];
      const systemRoutes = ['admin', 'superadmin', 'bodega', 'vender', 'pago', 'guia', 'menu', 'dist', 'assets', 'api'];
      if (first && !systemRoutes.includes(first.toLowerCase())) {
        tenant = first;
      }
    } catch (_) {}
  }

  const cleanTenant = (tenant || '').replace(/^\/+|\/+$/g, '').trim().toLowerCase();

  const KNOWN_STORE_LOGOS = {
    sublimados_majestic: 'https://dowbsbxvxjzjjhyqmyfr.supabase.co/storage/v1/object/public/archivos/logo_1788193731295.webp',
    lucerito: 'https://dowbsbxvxjzjjhyqmyfr.supabase.co/storage/v1/object/public/archivos/logo_1788197445120.webp',
    saramantha: 'https://dowbsbxvxjzjjhyqmyfr.supabase.co/storage/v1/object/public/archivos/logo_1788197423178.webp',
    lovely: 'https://dowbsbxvxjzjjhyqmyfr.supabase.co/storage/v1/object/public/archivos/logo_1788197761050.webp'
  };

  const KNOWN_STORE_NAMES = {
    sublimados_majestic: 'Sublimados Majestic',
    lucerito: 'Pijamas Lucerito',
    saramantha: 'Saramantha',
    lovely: 'Lovely'
  };

  const KNOWN_STORE_COLORS = {
    sublimados_majestic: '#f50081',
    lucerito: '#cd8dff',
    saramantha: '#ff0fdf',
    lovely: '#d561ff'
  };

  const name = req.query.name || KNOWN_STORE_NAMES[cleanTenant] || (cleanTenant ? cleanTenant.charAt(0).toUpperCase() + cleanTenant.slice(1).replace(/_/g, ' ') : 'Catálogo Digital');
  const color = req.query.color || req.query.theme || KNOWN_STORE_COLORS[cleanTenant] || '#6366f1';
  const icon = req.query.icon || KNOWN_STORE_LOGOS[cleanTenant] || '/indisutex-logo.png';
  const appPath = cleanTenant ? `/${cleanTenant}` : '/';

  const iconType = icon.toLowerCase().endsWith('.svg')
    ? 'image/svg+xml'
    : (icon.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/png');

  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({
    id: appPath,
    name: `${name} — Catálogo Digital`,
    short_name: name.length > 35 ? name.substring(0, 35).trim() : name,
    description: `Catálogo Digital e Interactivo de ${name}`,
    start_url: appPath,
    scope: appPath,
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: color,
    icons: [
      {
        src: icon,
        sizes: '192x192',
        type: iconType,
        purpose: 'any'
      },
      {
        src: icon,
        sizes: '512x512',
        type: iconType,
        purpose: 'any'
      }
    ]
  });
});

// Lectura de pedidos con IA (capturas/texto de WhatsApp).
// El módulo se carga SOLO cuando llega una petición: así nunca puede impedir que el sitio arranque
// (ni por una librería que falte ni por la forma en que el hosting carga este archivo).
let manejadorIA = null;
app.get('/api/leer-pedido/estado', (_req, res) => {
  res.json({ activo: Boolean(process.env.ANTHROPIC_API_KEY) });
});
app.post('/api/leer-pedido', express.json({ limit: '16mb' }), async (req, res) => {
  try {
    if (!manejadorIA) {
      const modulo = await import('./server/leerPedido.js');
      manejadorIA = modulo.crearManejador();
    }
    return await manejadorIA(req, res);
  } catch (e) {
    console.error('Lectura de pedidos con IA no disponible:', e && e.message ? e.message : e);
    return res.status(503).json({ ok: false, codigo: 'ia_apagada', error: 'La lectura con IA no está disponible por ahora.' });
  }
});

// Servir archivos estáticos generados por Vite (carpeta dist)
app.use(express.static(path.join(__dirname, 'dist')));

// Para que React Router funcione, siempre devolver index.html
app.use((req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    try {
      let html = fs.readFileSync(indexPath, 'utf-8');
      if (req.url && req.url.includes('/pago/')) {
        html = html
          .replace(/<title>.*?<\/title>/gi, '<title>💳 Subir Comprobante de Pago</title>')
          .replace(/<meta name="apple-mobile-web-app-title".*?>/gi, '<meta name="apple-mobile-web-app-title" content="Comprobante de Pago" />')
          .replace(/<meta property="og:title".*?>/gi, '<meta property="og:title" content="💳 Subir Comprobante de Pago" />')
          .replace(/<meta property="og:description".*?>/gi, '<meta property="og:description" content="Sube la captura de pantalla de tu pago para procesar tu pedido." />');
      }
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

export default app;
export { app };

