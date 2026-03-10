require('dotenv').config(); // Permite leer el archivo .env
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const prisma = new PrismaClient();
const puerto = process.env.PORT || 3000;

// --- 1. SEGURIDAD Y CONFIGURACIÓN ---
app.use(cors({
  origin: ['https://zaharachurch.store', 'http://localhost:5173', 'http://localhost:3000'], // Agregué localhost por si estás haciendo pruebas locales
  credentials: true
}));
app.use(express.json());

// --- 2. CONFIGURACIÓN DE CLOUDINARY ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'zahara_store',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    },
});
const upload = multer({ storage: storage });

// --- 3. RUTAS DE ADMINISTRACIÓN (LOGIN) ---
app.post('/api/login', (req, res) => {
    const { usuario, password } = req.body;
    if (usuario === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        res.json({ exito: true });
    } else {
        res.status(401).json({ exito: false });
    }
});

// --- 4. RUTAS DEL CATÁLOGO DE ROPA ---
// Ver productos
app.get('/api/productos', async (req, res) => {
    const productos = await prisma.producto.findMany();
    res.json(productos);
});

// Crear producto (CON IMAGEN A CLOUDINARY)
app.post('/api/admin/productos', upload.single('imagen'), async (req, res) => {
    const { nombre, precio_usd, stock } = req.body;
    
    try {
        let imagenUrl = null;
        if (req.file) {
            imagenUrl = req.file.path; // ¡La URL mágica de Cloudinary!
        }

        // Guardamos en la base de datos PostgreSQL
        const nuevoProducto = await prisma.producto.create({
            data: {
                nombre: nombre,
                precio_usd: parseFloat(precio_usd), // Convertimos a número
                stock: stock ? parseInt(stock) : 0,
                imagen: imagenUrl
            }
        });

        console.log('¡Prenda guardada con foto en la nube!', nuevoProducto.nombre);
        res.json({ mensaje: 'Prenda agregada al catálogo', producto: nuevoProducto });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al guardar en la base de datos' });
    }
});

// --- 5. RUTAS DE PAGOS MÓVILES ---
// Recibir pago
app.post('/api/pagos', async (req, res) => {
    const reporte = req.body; 
    const nuevoPago = await prisma.pago.create({
        data: {
            banco: reporte.banco,
            referencia: reporte.referencia,
            monto_bs: reporte.monto
        }
    });
    console.log('¡Nuevo pago registrado!', nuevoPago.id);
    res.json({ mensaje: 'Tu reporte de pago ha sido recibido.', estado: nuevoPago.estado });
});

// Ver pagos (Admin)
app.get('/api/admin/pagos', async (req, res) => {
    const pagosRegistrados = await prisma.pago.findMany();
    res.json(pagosRegistrados);
});

// Aprobar pago (Admin)
app.put('/api/admin/pagos/:id', async (req, res) => {
    const idPago = parseInt(req.params.id);
    try {
        const pagoActualizado = await prisma.pago.update({
            where: { id: idPago },
            data: { estado: 'Aprobado' }
        });
        res.json({ mensaje: `Pago #${idPago} aprobado.`, pagoActualizado });
    } catch (error) {
        res.status(404).json({ error: 'Pago no encontrado' });
    }
});

// Encender el servidor
app.listen(puerto, () => {
    console.log(`🚀 Servidor conectado a BD y Cloudinary en puerto ${puerto}`);
});