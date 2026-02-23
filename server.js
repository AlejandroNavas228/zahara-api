require('dotenv').config(); // 1. Activamos la lectura del archivo .env
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const axios = require('axios'); // Para que el servidor hable con ImgBB
const FormData = require('form-data'); // Para empaquetar la foto

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// CONFIGURACIÓN DE MULTER (Memoria RAM)
// Guardamos la foto en memoria un segundo para poder enviarla a ImgBB
const upload = multer({ storage: multer.memoryStorage() });

// BASE DE DATOS
const db = new sqlite3.Database('./database/tienda.db', (err) => {
    if (err) console.error(err.message);
    else console.log("📦 Conectado a SQLite.");
    // Aseguramos la tabla
    db.run(`CREATE TABLE IF NOT EXISTS productos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, precio REAL, imagen TEXT)`);
});

// --- RUTAS ---

// Obtener productos
app.get('/api/productos', (req, res) => {
    db.all("SELECT * FROM productos", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// NUEVA RUTA SEGURA: Crear producto
// upload.single('imagen') atrapa el archivo que envía el frontend
app.post('/api/productos', upload.single('imagen'), async (req, res) => {
    const { nombre, precio } = req.body;
    
    // Verificamos si llegó una imagen
    if (!req.file) {
        return res.status(400).json({ error: "No se envió ninguna imagen" });
    }

    try {
        // 1. EL SERVIDOR SUBE LA FOTO A IMGBB (Usando la llave oculta)
        const form = new FormData();
        // Convertimos el buffer de memoria a base64 que es lo que pide ImgBB a veces, 
        // o mandamos el buffer directo. Para ImgBB lo más fácil es base64:
        const imageBase64 = req.file.buffer.toString('base64');
        form.append('image', imageBase64);

        // Aquí usamos process.env.IMGBB_KEY (¡La llave invisible!)
        const responseImg = await axios.post(`https://api.imgbb.com/1/upload?key=${process.env.IMGBB_KEY}`, form, {
            headers: form.getHeaders()
        });

        const urlImagen = responseImg.data.data.url;
        console.log("Imagen subida por el servidor:", urlImagen);

        // 2. GUARDAMOS EN LA BASE DE DATOS
        const sql = `INSERT INTO productos (nombre, precio, imagen) VALUES (?, ?, ?)`;
        db.run(sql, [nombre, precio, urlImagen], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ mensaje: "Producto agregado con seguridad", id: this.lastID });
        });

    } catch (error) {
        console.error("Error subiendo a ImgBB:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Falló la subida a ImgBB" });
    }
});

// Eliminar producto
app.delete('/api/productos/:id', (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM productos WHERE id = ?", id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Producto eliminado" });
    });
});

// RUTA DE LOGIN (Segura)
app.post('/api/login', (req, res) => {
    const { usuario, password } = req.body;

    // Leemos las credenciales seguras del archivo .env
    const usuarioReal = process.env.ADMIN_USER;
    const passwordReal = process.env.ADMIN_PASS;

    // Comparamos
    if (usuario === usuarioReal && password === passwordReal) {
        res.json({ exito: true, mensaje: "¡Bienvenido a Zahara Admin!" });
    } else {
        res.status(401).json({ exito: false, error: "Credenciales incorrectas" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor seguro corriendo en puerto ${PORT}`);
});