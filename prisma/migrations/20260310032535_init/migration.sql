-- CreateTable
CREATE TABLE "Producto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio_usd" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "fecha_crea" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" SERIAL NOT NULL,
    "banco" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "monto_bs" DOUBLE PRECISION NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'Pendiente',
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);
