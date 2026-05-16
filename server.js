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

/// 🌟 RUTA ACTUALIZADA: Guarda el pedido y genera el link con Lumina Pay
app.post('/api/ordenes', async (req, res) => {
    const { cliente, telefono, total, detalleCarrito } = req.body;
    
    // 1. Guardamos la orden en SQLite (Zahara)
    const sql = `INSERT INTO ordenes (cliente, telefono, total, detalleCarrito) VALUES (?, ?, ?, ?)`;
    
    db.run(sql, [cliente, telefono, total, detalleCarrito], async function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        const ordenId = this.lastID; // El ID que se acaba de crear en Zahara

        try {
            // ==========================================
        // 2. EL BACKEND PIDE EL LINK A LUMINA PAY
        // ==========================================
        
        // 🚨 IMPORTANTE: Reemplaza esto con la URL de tu BACKEND de Lumina en Render
        // No pongas luminapay.xyz (ese es el frontend), pon el de la API.
        const URL_LUMINA = process.env.LUMINA_URL || 'https://lumina-backend-3pu1.onrender.com/api/checkout'; 
        
        const luminaRes = await fetch(URL_LUMINA, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Tu API KEY de Lumina Business
                'x-api-key': process.env.LUMINA_API_KEY || "zp_live_vqtcs94izri" 
            },
            body: JSON.stringify({
                monto: total,
                moneda: 'USD',
                descripcion: `Pedido en Zahara Store`,
                referenciaComercio: `ZAHARA-ORD-${ordenId}`,
                urlExito: 'https://zaharachurch.store/gracias.html' 
            })
        });

        // 🛡️ ESCUDO ANTI-CRASH: Leemos la respuesta como texto primero
        const textResponse = await luminaRes.text();
        let luminaData;
        
        try {
            // Intentamos convertir el texto a JSON. Si está vacío, creamos un objeto vacío.
            luminaData = textResponse ? JSON.parse(textResponse) : {};
        } catch (e) {
            console.error("Lumina no devolvió un JSON válido. Respuesta cruda:", textResponse);
            return res.status(500).json({ error: "Fallo de comunicación con la pasarela." });
        }

        // 3. Verificamos si Lumina nos dio el link correctamente
        if (luminaRes.ok && luminaData.url_pago) {
            res.json({ mensaje: "Orden registrada", url_pago: luminaData.url_pago });
        } else {
            console.error("Lumina rechazó la petición:", luminaData);
            res.status(400).json({ error: luminaData.error || "Lumina denegó el pago" });
        }

            const luminaData = await luminaRes.json();

            if (luminaRes.ok) {

                res.json({ 
                    mensaje: "Orden registrada", 
                    id: ordenId, 
                    url_pago: luminaData.url_pago 
                });
            } else {
                // Si Lumina falla, igual le avisamos al frontend (para que use WhatsApp de respaldo)
                console.error("Error de Lumina:", luminaData);
                res.status(400).json({ error: "No se pudo generar el link de pago", id: ordenId });
            }

        } catch (error) {
            console.error("Error conectando con Lumina:", error);
            res.status(500).json({ error: "Error de red hacia la pasarela", id: ordenId });
        }
    });
});


// ==========================================
// RUTA WEBHOOK: RECIBE AVISOS DE LUMINA PAY
// ==========================================
app.post('/api/webhook/lumina', async (req, res) => {
    try {
        const { evento, data } = req.body;

        if (evento === 'pago_exitoso') {
            const idTransaccionLumina = data.id;
            const montoPagado = data.monto;
            
            console.log(`🚨 WEBHOOK RECIBIDO: Pago exitoso de $${montoPagado} (Lumina ID: ${idTransaccionLumina})`);

            // 👇 CÓDIGO DE NOTIFICACIÓN POR WHATSAPP 👇
            const telefonoHermana = "+584143894452";
            const apikeyCallMeBot = "6098733"; 
        
            const mensaje = `🚨 *¡NUEVA VENTA EN ZAHARA!* 🚨%0A%0ASe ha confirmado un pago por *$${montoPagado}*.%0A%0A¡Entra al panel de administrador para revisar la orden!`;

            // Construimos la URL mágica que dispara el mensaje
            const urlWhatsapp = `https://api.callmebot.com/whatsapp.php?phone=${telefonoHermana}&text=${mensaje}&apikey=${apikeyCallMeBot}`;
            
            try {
                // Llamamos a la API del bot en silencio
                await fetch(urlWhatsapp);
                console.log("✅ Mensaje de WhatsApp enviado con éxito a la administradora.");
            } catch (error) {
                console.error("❌ Error al enviar el WhatsApp:", error);
            }
            // 👆 FIN DEL CÓDIGO DE NOTIFICACIÓN 👆

            res.status(200).json({ mensaje: 'Webhook y notificación procesados' });
        } else {
            res.status(200).json({ mensaje: 'Evento ignorado' });
        }
    } catch (error) {
        console.error('Error procesando el Webhook en Zahara:', error);
        res.status(500).json({ error: 'Error interno en el servidor de Zahara' });
    }
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