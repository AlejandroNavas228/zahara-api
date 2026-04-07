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
        format: 'webp',
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
        
        db.run(`CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            precio REAL NOT NULL,
            imagen TEXT NOT NULL,
            descripcion TEXT,
            stock INTEGER DEFAULT 0
        )`);

        db.run("ALTER TABLE productos ADD COLUMN descripcion TEXT", () => {});
        db.run("ALTER TABLE productos ADD COLUMN stock INTEGER DEFAULT 0", () => {});
        
        // 🌟 TABLA DE ÓRDENES ACTUALIZADA PARA GUARDAR ROPA Y TELÉFONO
        db.run(`CREATE TABLE IF NOT EXISTS ordenes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente TEXT,
            telefono TEXT,
            total REAL,
            detalleCarrito TEXT
        )`);

        // Si la tabla vieja ya existía, le agregamos las columnas nuevas sin romper nada
        db.run("ALTER TABLE ordenes ADD COLUMN telefono TEXT", () => {});
        db.run("ALTER TABLE ordenes ADD COLUMN detalleCarrito TEXT", () => {});
    }
});

// --- 5. RUTAS DE LA API ---

app.get('/ping', (req, res) => {
  res.send('Servidor de Zahara activo');
});

app.post('/api/login', (req, res) => {
    const { usuario, password } = req.body;
    if (usuario === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        res.json({ exito: true });
    } else {
        res.status(401).json({ exito: false });
    }
});

app.get('/api/productos', (req, res) => {
    db.all("SELECT * FROM productos", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/productos', (req, res) => {
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
            res.json({ mensaje: "Producto creado con éxito", id: this.lastID });
        });
    });
});

app.delete('/api/productos/:id', (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM productos WHERE id = ?", id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Producto eliminado" });
    });
});

// 🌟 ESTA ES LA RUTA NUEVA QUE FALTABA PARA RECIBIR LOS PEDIDOS
app.post('/api/ordenes', (req, res) => {
    const { cliente, telefono, total, detalleCarrito } = req.body;
    
    const sql = `INSERT INTO ordenes (cliente, telefono, total, detalleCarrito) VALUES (?, ?, ?, ?)`;
    db.run(sql, [cliente, telefono, total, detalleCarrito], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Orden registrada con éxito", id: this.lastID });
    });
});

app.get('/api/ordenes', (req, res) => {
    db.all("SELECT * FROM ordenes ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

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