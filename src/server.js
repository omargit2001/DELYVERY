const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].replace(/^(["'])(.*)\1$/, '$2');
    process.env[match[1]] = value;
  }
}

const ROOT = __dirname;
const PROJECT_ROOT = path.join(ROOT, '..');
loadEnvFile(path.join(PROJECT_ROOT, '.env'));

const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = path.resolve(PROJECT_ROOT, process.env.DATA_FILE || 'data.json');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };

const emptyData = () => {
  const ago = days => new Date(Date.now() - days * 86_400_000).toISOString();
  return {
    restaurants: [
      { id: 'REST-001', name: 'La Masa Verde', specialties: ['Pizza', 'Italiana', 'Vegana'] },
      { id: 'REST-002', name: 'Sazón de Casa', specialties: ['Colombiana', 'Casera'] },
      { id: 'REST-003', name: 'Wok & Roll', specialties: ['Asiática', 'Vegetariana'] },
    ],
    products: [
      { id: 'PROD-001', name: 'Pizza huerta', restaurantId: 'REST-001', price: 32000 },
      { id: 'PROD-002', name: 'Lasaña de berenjena', restaurantId: 'REST-001', price: 28500 },
      { id: 'PROD-003', name: 'Bandeja de la casa', restaurantId: 'REST-002', price: 36000 },
      { id: 'PROD-004', name: 'Wok de vegetales', restaurantId: 'REST-003', price: 27000 },
    ],
    couriers: [
      { plate: 'ABC-123', firstName: 'Valentina', lastName: 'Rojas Pérez', phones: ['300 555 0101', '310 555 0101'], license: { number: 'LIC-1001', type: 'A2', expiry: '2028-04-20' }, supervisorPlate: '' },
      { plate: 'DEF-456', firstName: 'Andrés', lastName: 'Mejía Torres', phones: ['301 555 0202'], license: { number: 'LIC-1002', type: 'A2', expiry: '2027-11-12' }, supervisorPlate: 'ABC-123' },
      { plate: 'GHI-789', firstName: 'Camila', lastName: 'Vargas León', phones: ['302 555 0303'], license: { number: 'LIC-1003', type: 'A2', expiry: '2029-02-08' }, supervisorPlate: 'ABC-123' },
    ],
    clients: [
      { dni: '1020456789', name: 'Mariana López', street: 'Carrera 12', houseNumber: '45-18', zone: 'Chapinero' },
      { dni: '1030567891', name: 'Santiago Ruiz', street: 'Calle 80', houseNumber: '21-09', zone: 'Barrios Unidos' },
      { dni: '1010345678', name: 'Lucía Cárdenas', street: 'Avenida 7', houseNumber: '112-30', zone: 'Usaquén' },
    ],
    orders: [
      { id: 'FD-2048', date: ago(0), total: 64000, restaurantId: 'REST-001', clientDni: '1020456789', courierPlate: 'ABC-123', details: [{ productId: 'PROD-001', quantity: 2 }], history: [{ number: 1, at: ago(0), description: 'Entregado' }] },
      { id: 'FD-2049', date: ago(0), total: 36000, restaurantId: 'REST-002', clientDni: '1030567891', courierPlate: 'DEF-456', details: [{ productId: 'PROD-003', quantity: 1 }], history: [{ number: 1, at: ago(0), description: 'En preparación' }] },
      { id: 'FD-2047', date: ago(1), total: 54000, restaurantId: 'REST-003', clientDni: '1010345678', courierPlate: 'GHI-789', details: [{ productId: 'PROD-004', quantity: 2 }], history: [{ number: 1, at: ago(1), description: 'En camino' }, { number: 2, at: ago(1), description: 'Entregado' }] },
    ],
  };
};

function readData() {
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(emptyData(), null, 2));
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function send(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => { body += chunk; if (body.length > 1_000_000) reject(new Error('La solicitud es demasiado grande.')); });
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('El cuerpo de la solicitud no es JSON válido.')); }
    });
    request.on('error', reject);
  });
}

function validate(data) {
  for (const [items, key, label] of [[data.restaurants, 'id', 'código de restaurante'], [data.products, 'id', 'código de producto'], [data.couriers, 'plate', 'placa'], [data.clients, 'dni', 'DNI'], [data.orders, 'id', 'número de pedido']]) {
    const values = items.map(item => item[key]);
    if (values.some(value => !value) || new Set(values).size !== values.length) throw new Error(`El ${label} debe ser obligatorio y único.`);
  }
  const restaurantIds = new Set(data.restaurants.map(item => item.id));
  const courierPlates = new Set(data.couriers.map(item => item.plate));
  const clientDnis = new Set(data.clients.map(item => item.dni));
  const productIds = new Set(data.products.map(item => item.id));
  const licenseNumbers = data.couriers.map(item => item.license.number);
  if (new Set(licenseNumbers).size !== licenseNumbers.length) throw new Error('El número de licencia debe ser único.');
  for (const product of data.products) {
    if (!restaurantIds.has(product.restaurantId)) throw new Error('Cada producto debe pertenecer a un restaurante existente.');
  }
  for (const courier of data.couriers) {
    if (courier.supervisorPlate && (!courierPlates.has(courier.supervisorPlate) || courier.supervisorPlate === courier.plate)) throw new Error('El supervisor debe ser otro repartidor existente.');
  }
  for (const order of data.orders) {
    if (!restaurantIds.has(order.restaurantId) || !clientDnis.has(order.clientDni) || !courierPlates.has(order.courierPlate)) throw new Error('Cada pedido debe tener restaurante, cliente y repartidor existentes.');
    if (!order.details.length) throw new Error('Cada pedido debe incluir al menos un producto.');
    if (order.details.some(detail => !productIds.has(detail.productId) || !Number.isInteger(Number(detail.quantity)) || Number(detail.quantity) < 1)) throw new Error('Los detalles necesitan un producto existente y una cantidad válida.');
    if (order.details.some(detail => data.products.find(product => product.id === detail.productId)?.restaurantId !== order.restaurantId)) throw new Error('Los productos del pedido deben pertenecer al restaurante seleccionado.');
    if (!order.history.length) throw new Error('Cada pedido debe conservar al menos un estado.');
  }
  const activeCouriers = data.orders.filter(order => !['Entregado', 'Cancelado'].includes(order.history.at(-1).description)).map(order => order.courierPlate);
  if (new Set(activeCouriers).size !== activeCouriers.length) throw new Error('Un repartidor solo puede tener un pedido activo a la vez.');
}

function removeEntity(data, type, id) {
  const target = {
    restaurants: data.restaurants.find(item => item.id === id),
    products: data.products.find(item => item.id === id),
    couriers: data.couriers.find(item => item.plate === id),
    clients: data.clients.find(item => item.dni === id),
    orders: data.orders.find(item => item.id === id),
  }[type];
  if (!target) throw new Error('El registro no existe.');
  if (type === 'restaurants') {
    const products = data.products.filter(item => item.restaurantId === id);
    const productIds = new Set(products.map(item => item.id));
    data.orders = data.orders.filter(order => order.restaurantId !== id);
    data.products = data.products.filter(item => item.restaurantId !== id);
    data.orders.forEach(order => { order.details = order.details.filter(detail => !productIds.has(detail.productId)); });
  } else if (type === 'products') {
    data.products = data.products.filter(item => item.id !== id);
    data.orders.forEach(order => { order.details = order.details.filter(detail => detail.productId !== id); });
    data.orders = data.orders.filter(order => order.details.length > 0);
  } else if (type === 'couriers') {
    data.orders = data.orders.filter(order => order.courierPlate !== id);
    data.couriers = data.couriers.filter(item => item.plate !== id);
    data.couriers.forEach(item => { if (item.supervisorPlate === id) item.supervisorPlate = ''; });
  } else if (type === 'clients') {
    data.orders = data.orders.filter(order => order.clientDni !== id);
    data.clients = data.clients.filter(item => item.dni !== id);
  } else data.orders = data.orders.filter(item => item.id !== id);
}

async function handleApi(request, response, url) {
  const data = readData();
  if (request.method === 'GET' && url.pathname === '/api/data') return send(response, 200, data);
  if (request.method === 'PUT' && url.pathname === '/api/data') {
    try {
      const nextData = await readBody(request);
      validate(nextData);
      writeData(nextData);
      return send(response, 200, nextData);
    } catch (error) { return send(response, 400, { error: error.message }); }
  }
  if (request.method === 'DELETE' && url.pathname.startsWith('/api/')) {
    try {
      const [, , type, ...parts] = url.pathname.split('/');
      const id = decodeURIComponent(parts.join('/'));
      removeEntity(data, type, id);
      validate(data);
      writeData(data);
      return send(response, 200, data);
    } catch (error) { return send(response, 400, { error: error.message }); }
  }
  return send(response, 404, { error: 'Ruta no encontrada.' });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) return handleApi(request, response, url);
  const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const file = path.resolve(ROOT, requested);
  if (!file.startsWith(`${ROOT}${path.sep}`) && file !== path.join(ROOT, 'index.html')) {
    response.writeHead(403); return response.end('Prohibido');
  }
  fs.readFile(file, (error, content) => {
    if (error) { response.writeHead(404); return response.end('No encontrado'); }
    response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    response.end(content);
  });
});

server.listen(PORT, () => console.log(`FlashDelivery listo en http://localhost:${PORT}`));