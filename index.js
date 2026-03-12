require('dotenv').config(); // Para leer tus variables de entorno (.env)
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

// --- LIBRERÍAS PARA SUBIR FOTOS (Cloudinary) ---
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const prisma = new PrismaClient();

// ==========================================
// ☁️ CONFIGURACIÓN DE CLOUDINARY
// ==========================================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'zahara_store', // La carpeta en tu Cloudinary
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp']
    }
});

// ¡LA MAGIA! Configuramos multer para que acepte archivos
const upload = multer({ storage: storage });


// --- MIDDLEWARES ---
app.use(cors()); 
app.use(express.json()); 


// ==========================================
// 🔐 SEGURIDAD Y LOGIN (Versión Segura con .env)
// ==========================================
app.post('/api/login', (req, res) => {
    const { usuario, password } = req.body;
    
    // Traemos las credenciales verdaderas desde el archivo oculto .env
    const usuarioCorrecto = process.env.ADMIN_USER;
    const claveCorrecta = process.env.ADMIN_PASS;
    
    // Comparamos lo que escribió tu hermana con lo que está en el .env
    if (usuario === usuarioCorrecto && password === claveCorrecta) { 
        res.json({ exito: true, mensaje: "Bienvenida jefa" });
    } else {
        res.json({ exito: false, error: "Credenciales inválidas" });
    }
});

// ==========================================
// 👕 RUTAS DEL CATÁLOGO DE PRODUCTOS
// ==========================================

// 1. Obtener todos los productos
app.get('/api/productos', async (req, res) => {
    try {
        const productos = await prisma.producto.findMany();
        res.json(productos);
    } catch (error) {
        console.error("Error al obtener productos:", error);
        res.status(500).json({ error: "Error al obtener productos" });
    }
});

// 2. Crear un producto (AHORA RECIBE HASTA 5 FOTOS A LA VEZ)
// Fíjate que usamos upload.array('imagenes', 5) en lugar de upload.single
app.post('/api/admin/productos', upload.array('imagenes', 5), async (req, res) => {
    const { nombre, precio_usd, stock } = req.body; 
    
    // req.files contiene todas las fotos que se subieron a Cloudinary
    // Extraemos solo los links (URLs) de esas fotos para guardarlos en la base de datos
    const linksImagenes = req.files ? req.files.map(file => file.path) : [];
    
    try {
        const nuevoProducto = await prisma.producto.create({
            data: {
                nombre,
                precio_usd: parseFloat(precio_usd),
                imagenes: linksImagenes, // Guardamos la lista completa de links
                stock: parseInt(stock) || 0
            }
        });
        res.json({ mensaje: "Producto creado con éxito", producto: nuevoProducto });
    } catch (error) {
        console.error("Error al crear producto:", error);
        res.status(500).json({ error: "Error al crear producto en la base de datos" });
    }
});

// 3. Eliminar un producto 
app.delete('/api/admin/productos/:id', async (req, res) => {
    try {
        await prisma.producto.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ mensaje: "Producto eliminado correctamente" });
    } catch (error) {
        console.error("Error al eliminar producto:", error);
        res.status(500).json({ error: "Error al eliminar producto" });
    }
});


// ==========================================
// 📦 RUTAS DE ÓRDENES E INVENTARIO
// ==========================================

app.post('/api/ordenes', async (req, res) => {
    const { clienteNombre, clienteTelefono, metodoPago, referencia, totalPagado, detalleCarrito } = req.body;
    try {
        const nuevaOrden = await prisma.orden.create({
            data: {
                clienteNombre, clienteTelefono, metodoPago, referencia,
                totalPagado: parseFloat(totalPagado),
                detalleCarrito: detalleCarrito, 
                estado: "Pendiente" 
            }
        });
        res.json(nuevaOrden);
    } catch (error) {
        console.error("Error al registrar la orden:", error);
        res.status(500).json({ error: "Error al procesar la orden en la base de datos" });
    }
});

app.get('/api/ordenes', async (req, res) => {
    try {
        const ordenes = await prisma.orden.findMany({
            orderBy: { fechaCreacion: 'desc' }
        });
        res.json(ordenes);
    } catch (error) {
        console.error("Error al cargar órdenes:", error);
        res.status(500).json({ error: "Error al cargar las órdenes" });
    }
});

app.put('/api/ordenes/:id/aprobar', async (req, res) => {
    const ordenId = parseInt(req.params.id);
    try {
        const orden = await prisma.orden.findUnique({ where: { id: ordenId } });
        if (!orden || orden.estado !== "Pendiente") return res.status(400).json({ error: "La orden no existe o ya fue procesada." });

        const operaciones = [];
        const carrito = typeof orden.detalleCarrito === 'string' ? JSON.parse(orden.detalleCarrito) : orden.detalleCarrito;
        
        for (const item of carrito) {
            operaciones.push(
                prisma.producto.update({
                    where: { id: item.id },
                    data: { stock: { decrement: 1 } }
                })
            );
        }

        operaciones.push(
            prisma.orden.update({
                where: { id: ordenId },
                data: { estado: "Aprobada" }
            })
        );

        await prisma.$transaction(operaciones);
        res.json({ mensaje: "¡Orden aprobada y stock descontado con éxito!" });

    } catch (error) {
        console.error("Error al aprobar orden:", error);
        res.status(500).json({ error: "Hubo un problema al descontar el inventario." });
    }
});

// --- ENCENDER EL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor de Zahara Store corriendo a toda máquina en el puerto ${PORT}`);
});