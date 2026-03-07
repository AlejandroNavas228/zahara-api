require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');

// --- 1. IMPORTAMOS CLOUDINARY ---
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: 'https://zaharachurch.store', // Tu nuevo dominio exacto
  credentials: true
}));
app.use(express.json());

// --- 2. CONFIGURAMOS CLOUDINARY ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- 3. CONFIGURAMOS EL ALMACENAMIENTO ---
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'zahara_store', // Nombre de la carpeta en tu nube
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    },
});

const upload = multer({ storage: storage });

// BASE DE DATOS
const db = new sqlite3.Database('./database/tienda.db', (err) => {
    if (err) console.error(err.message);
    else {
        console.log("📦 Conectado a SQLite.");
        db.run(`CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            precio REAL NOT NULL,
            imagen TEXT NOT NULL
        )`);
    }
});

// --- RUTAS ---

// Login
app.post('/api/login', (req, res) => {
    const { usuario, password } = req.body;
    if (usuario === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        res.json({ exito: true });
    } else {
        res.status(401).json({ exito: false });
    }
});

// Obtener productos
app.get('/api/productos', (req, res) => {
    db.all("SELECT * FROM productos", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// CREAR PRODUCTO (NUEVO MÉTODO CLOUDINARY)
app.post('/api/productos', upload.single('imagen'), (req, res) => {
    // Si llegamos aquí, Cloudinary YA subió la foto y nos dio la URL en req.file.path
    const { nombre, precio } = req.body;
    
    if (!req.file) {
        return res.status(400).json({ error: "No se envió ninguna imagen" });
    }

    const imagenUrl = req.file.path; // ¡La URL de Cloudinary!

    const sql = `INSERT INTO productos (nombre, precio, imagen) VALUES (?, ?, ?)`;
    db.run(sql, [nombre, precio, imagenUrl], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Producto subido a Cloudinary", id: this.lastID });
    });
});

// Eliminar producto
app.delete('/api/productos/:id', (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM productos WHERE id = ?", id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Producto eliminado" });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Cloudinary listo en puerto ${PORT}`);
});