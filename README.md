# FlashDelivery · Centro de operaciones

Aplicación monolítica para administrar las operaciones de una plataforma de delivery. Incluye un panel operativo y módulos CRUD para restaurantes, productos, repartidores, clientes y pedidos.

## Requisitos

- Node.js 18 o posterior
- npm

## Ejecutar

1. Instala Node.js 18 o posterior. npm se incluye con Node.js.
2. Abre una terminal en la carpeta del proyecto.
3. Crea la configuración local a partir del ejemplo:

	```bash
	cp .env.example .env
	```

4. Inicia la aplicación:

	```bash
	npm start
	```

5. Abre [http://localhost:3000](http://localhost:3000) en el navegador.

No es necesario ejecutar `npm install`: la aplicación usa módulos nativos de Node.js y no tiene dependencias externas. El servidor crea `data.json` en el primer inicio con datos demostrativos; los cambios posteriores se guardan allí. Ese archivo se excluye de Git.

La configuración local se lee desde `.env`. `PORT` cambia el puerto y `DATA_FILE` permite seleccionar la ruta del archivo de datos. `.env.example` se incluye en Git como referencia; `.env` permanece ignorado.

## Funcionalidad

- Restaurantes con código único y varias especialidades.
- Productos con código, precio y pertenencia a un restaurante.
- Repartidores identificados por placa, con nombres, apellidos, varios teléfonos, licencia única y supervisor opcional.
- Clientes por DNI, dirección estructurada y frecuencia de pedido calculada a partir del historial.
- Pedidos con cliente, restaurante, repartidor, total calculado, uno o más productos y cantidades.
- Historial de estados numerado y fechado. Los detalles e historial pertenecen al pedido.
- Validación de relaciones, licencias únicas, producto perteneciente al restaurante del pedido y máximo un pedido activo por repartidor.
- Búsqueda en tablas, confirmación al eliminar, persistencia JSON y diseño adaptable a móvil.

## Capturas de interfaz

- [Resumen operativo](capturas/resumen.png)
- [Gestión de pedidos](capturas/pedidos.png)
- [Vista móvil](capturas/movil.png)

## Estructura

- `src/server.js`: servidor HTTP, API CRUD, persistencia JSON y reglas de integridad.
- `src/app.js`: navegación, formularios, tablas y cálculos de interfaz.
- `src/styles.css` y `src/mobile.css`: estilos responsivos.
- `src/index.html`: punto de entrada de la aplicación.
- `ENTREGA.md`: instrucciones para completar la publicación y añadir el enlace personal de GitHub.