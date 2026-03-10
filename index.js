const express = require('express');
const app = express();
const puerto = 3000;
// Esto permite que el servidor entienda la información que le envían
app.use(express.json());
// Simulamos una base de datos temporal en memoria
const pagosRegistrados = [];

// 1. Ruta principal (La que hicimos primero)
app.get('/', (req, res) => {
    res.send('¡Hola! El backend de Zahara está funcionando perfectamente.');
});

// 2. Ruta para obtener el catálogo de productos (La nueva)
app.get('/api/productos', (req, res) => {
    const productos = [
        { id: 1, nombre: 'Franela Oversize Negra', precio_usd: 15.00 },
        { id: 2, nombre: 'Pantalón Cargo', precio_usd: 25.50 },
        { id: 3, nombre: 'Gorra Vintage', precio_usd: 10.00 }
    ];
    
    // res.json convierte la lista en formato JSON y la envía al navegador
    res.json(productos);
});

// Ruta para recibir el reporte de un pago del cliente
app.post('/api/pagos', (req, res) => {
    const reporte = req.body; 
    
    // Le agregamos un ID y la fecha actual al reporte antes de guardarlo
    const nuevoPago = {
        id: pagosRegistrados.length + 1,
        banco: reporte.banco,
        referencia: reporte.referencia,
        monto: reporte.monto,
        fecha: new Date().toLocaleString(),
        estado: 'Pendiente'
    };

    // Guardamos el pago en nuestra "base de datos"
    pagosRegistrados.push(nuevoPago);

    console.log('¡Nuevo pago guardado en el sistema!');

    res.json({
        mensaje: 'Tu reporte de pago ha sido recibido.',
        estado: 'Pendiente de verificación'
    });
});

// Ruta GET para el Panel de Administración (Ver todos los pagos)
app.get('/api/admin/pagos', (req, res) => {
    // Aquí el servidor simplemente devuelve la lista completa de pagos guardados
    res.json(pagosRegistrados);
});

// Ruta PUT para aprobar un pago (Exclusivo del Panel de Administración)
// El ":id" en la URL nos permite saber exactamente qué pago queremos modificar
app.put('/api/admin/pagos/:id', (req, res) => {
    // 1. Capturamos el ID que el administrador puso en la URL
    const idPago = parseInt(req.params.id);

    // 2. Buscamos ese pago específico en nuestra lista
    const pagoEncontrado = pagosRegistrados.find(pago => pago.id === idPago);

    // 3. Si alguien pone un ID que no existe, lanzamos un error
    if (!pagoEncontrado) {
        return res.status(404).json({ error: 'Pago no encontrado en el sistema' });
    }

    // 4. Si lo encontramos, le cambiamos el estado a "Aprobado"
    pagoEncontrado.estado = 'Aprobado';

    // 5. Respondemos con éxito
    res.json({
        mensaje: `El pago #${idPago} ha sido aprobado exitosamente.`,
        pagoActualizado: pagoEncontrado
    });
});

// 3. Encender el servidor (Esto SIEMPRE debe ir al final)
app.listen(puerto, () => {
    console.log(`Servidor corriendo en http://localhost:${puerto}`);
});