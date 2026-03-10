const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient(); // Encendemos la conexión a la Base de Datos
const puerto = 3000;

// Permite que el servidor entienda JSON
app.use(express.json());

// 1. Ruta para obtener el catálogo (Ahora viene de la nube)
app.get('/api/productos', async (req, res) => {
    const productos = await prisma.producto.findMany();
    res.json(productos);
});

// 2. Ruta para recibir y GUARDAR un pago real
app.post('/api/pagos', async (req, res) => {
    const reporte = req.body; 
    
    // Guardamos en la tabla "pago" de PostgreSQL
    const nuevoPago = await prisma.pago.create({
        data: {
            banco: reporte.banco,
            referencia: reporte.referencia,
            monto_bs: reporte.monto
        }
    });

    console.log('¡Pago guardado en la nube!', nuevoPago);

    res.json({
        mensaje: 'Tu reporte de pago ha sido recibido y guardado.',
        estado: nuevoPago.estado
    });
});

// 3. Ruta GET para el Panel de Administración
app.get('/api/admin/pagos', async (req, res) => {
    // Buscamos todos los pagos en la base de datos
    const pagosRegistrados = await prisma.pago.findMany();
    res.json(pagosRegistrados);
});

// 4. Ruta PUT para aprobar un pago
app.put('/api/admin/pagos/:id', async (req, res) => {
    const idPago = parseInt(req.params.id);

    try {
        // Buscamos y actualizamos directamente en la nube
        const pagoActualizado = await prisma.pago.update({
            where: { id: idPago },
            data: { estado: 'Aprobado' }
        });

        res.json({
            mensaje: `El pago #${idPago} ha sido aprobado exitosamente.`,
            pagoActualizado: pagoActualizado
        });
    } catch (error) {
        // Si Prisma no encuentra el ID, lanza un error y caemos aquí
        res.status(404).json({ error: 'Pago no encontrado en el sistema' });
    }
});

// Encender el servidor
app.listen(puerto, () => {
    console.log(`Servidor conectado a BD corriendo en http://localhost:${puerto}`);
});