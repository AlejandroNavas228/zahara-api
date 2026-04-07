require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const fs = require('fs');

// --- 1. IMPORTAMOS CLOUDINARY ---
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

// --- 2. MIDDLEWARES ---
app.use(cors({
  origin: ['https://zaharachurch.store', 'http://127.0.0.1:5500', 'http://localhost:5500'],
  credentials: true
}));
app.use(express.json());

// --- 3. CONFIGURAMOS CLOUDINARY ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'zahara_store',
        format: 'webp', // Fuerza la conversión a WebP
        transformation: [{ width: 1000, crop: "limit", quality: "auto" }],
    },
});

const upload = multer({ storage: storage });

// --- 4. BASE DE DATOS (BLINDADA Y ORGANIZADA) ---
if (!fs.existsSync('./database')) {
    fs.mkdirSync('./database');
    console.log("📁 Carpeta 'database' creada automáticamente.");
}

const db = new sqlite3.Database('./database/tienda.db', (err) => {
    if (err) {
        console.error("Error de base de datos:", err.message);
    } else {
        console.log("📦 Conectado a SQLite.");
        
        // Creamos la tabla con TODAS las columnas por si se crea desde cero
        db.run(`CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            precio REAL NOT NULL,
            imagen TEXT NOT NULL,
            descripcion TEXT,
            stock INTEGER DEFAULT 0
        )`);

        // Si la tabla ya existía, intentamos agregar las columnas nuevas.
        // El "() => {}" atrapa el error de columna duplicada y evita que el servidor colapse.
        db.run("ALTER TABLE productos ADD COLUMN descripcion TEXT", () => {});
        db.run("ALTER TABLE productos ADD COLUMN stock INTEGER DEFAULT 0", () => {});
        
        // Nos aseguramos de que exista la tabla de órdenes
        db.run(`CREATE TABLE IF NOT EXISTS ordenes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente TEXT,
            total REAL
        )`);
    }
});

// --- 5. RUTAS DE LA API ---

// [Ruta de Prueba]
app.get('/ping', (req, res) => {
  res.send('Servidor de Zahara activo');
});

// [Login de Administrador]
app.post('/api/login', (req, res) => {
    const { usuario, password } = req.body;
    if (usuario === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        res.json({ exito: true });
    } else {
        res.status(401).json({ exito: false });
    }
});

// [Obtener todos los Productos]
app.get('/api/productos', (req, res) => {
    db.all("SELECT * FROM productos", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// [Crear un Producto Nuevo]
app.post('/api/productos', (req, res) => {
    
    // Envolvemos la subida para atrapar errores de Cloudinary
    upload.single('imagen')(req, res, function (err) {
        if (err) {
            console.error("❌ Error de Cloudinary/Multer:", err);
            return res.status(500).json({ error: "Fallo al subir la foto. Revisa tus claves de Cloudinary en el archivo .env" });
        }

        const { nombre, precio, descripcion, stock } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ error: "No se seleccionó ninguna imagen." });
        }
        
        const imagenUrl = req.file.path;
        const sql = `INSERT INTO productos (nombre, precio, imagen, descripcion, stock) VALUES (?, ?, ?, ?, ?)`;
        
        db.run(sql, [nombre, precio, imagenUrl, descripcion, stock || 0], function(err) {
            if (err) {
                console.error("❌ Error de Base de Datos:", err.message);
                return res.status(500).json({ error: "Error en la base de datos: " + err.message });
            }
            
            console.log(`✅ Producto '${nombre}' guardado con éxito!`);
            res.json({ mensaje: "Producto creado con éxito", id: this.lastID });
        });
    });
});

// [Eliminar un Producto]
app.delete('/api/productos/:id', (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM productos WHERE id = ?", id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Producto eliminado" });
    });
});

// [Obtener todas las Órdenes]
app.get('/api/ordenes', (req, res) => {
    db.all("SELECT * FROM ordenes ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// [Eliminar una Orden]
app.delete('/api/ordenes/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM ordenes WHERE id = ?", id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Pedido eliminado correctamente" });
    });
});

// --- 6. INICIAR SERVIDOR ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor listo y corriendo en puerto ${PORT}`);
});