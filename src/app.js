const labels = { overview: 'Resumen', orders: 'Pedidos', restaurants: 'Restaurantes', products: 'Productos', couriers: 'Repartidores', clients: 'Clientes' };
const icons = { orders: '↗', restaurants: '⌂', products: '▦', couriers: '⌁', clients: '◎' };
const colors = ['#e6f2e7', '#fff0e6', '#e8eff6', '#f5efdb', '#f6e9e8'];
let data = { restaurants: [], products: [], couriers: [], clients: [], orders: [] };
let currentView = 'overview';

const root = document.querySelector('#view-root');
const modalRoot = document.querySelector('#modal-root');

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function money(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function dateLabel(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function fullName(courier) { return `${courier.firstName} ${courier.lastName}`.trim(); }
function restaurantName(id) { return data.restaurants.find(item => item.id === id)?.name || 'Restaurante eliminado'; }
function customerName(dni) { return data.clients.find(item => item.dni === dni)?.name || dni; }
function courierName(plate) { const courier = data.couriers.find(item => item.plate === plate); return courier ? fullName(courier) : plate; }
function productName(id) { return data.products.find(item => item.id === id)?.name || 'Producto eliminado'; }
function orderState(order) { return order?.history?.at(-1)?.description || 'Sin estado'; }
function isActive(order) { return !['Entregado', 'Cancelado'].includes(orderState(order)); }

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo completar la solicitud.');
  return result;
}

async function saveData(next) {
  data = await api('/api/data', { method: 'PUT', body: JSON.stringify(next) });
  render();
}

function toast(message, error = false) {
  const element = document.createElement('div');
  element.className = `toast${error ? ' error' : ''}`;
  element.textContent = message;
  document.querySelector('#toast-root').append(element);
  setTimeout(() => element.remove(), 3200);
}

function heading(title, description, action = '') {
  return `<div class="page-heading"><div><div class="eyebrow">CENTRO DE OPERACIONES</div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
}

function pageAction(type, label) {
  return `<button class="primary-button" data-add="${type}"><span>＋</span>${label}</button>`;
}

function table(rows, columns, emptyTitle, emptyCopy) {
  if (!rows.length) return `<div class="empty-state"><strong>${emptyTitle}</strong>${emptyCopy}</div>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${columns.map(column => `<th>${column.label}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(column => `<td>${column.render(row)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function statusBadge(status) {
  const className = status === 'Entregado' || status === 'Cancelado' ? 'status-done' : status === 'En camino' ? 'status-road' : status === 'En preparación' ? 'status-prep' : '';
  return `<span class="status-pill ${className}">${esc(status)}</span>`;
}

function recentOrders(limit = 5) {
  return [...data.orders].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, limit);
}

function overview() {
  const active = data.orders.filter(isActive).length;
  const today = new Date().toDateString();
  const todaysOrders = data.orders.filter(order => new Date(order.date).toDateString() === today);
  const revenue = todaysOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const stats = [
    ['Pedidos de hoy', todaysOrders.length, '↗', `${active} en curso`],
    ['Ventas del día', money(revenue), '$', `${todaysOrders.length} pedidos registrados`],
    ['Repartidores activos', data.couriers.length, '⌁', `${new Set(data.orders.filter(isActive).map(order => order.courierPlate)).size} con pedido asignado`],
    ['Restaurantes', data.restaurants.length, '⌂', `${data.products.length} productos en catálogo`],
  ];
  const orderColumns = [
    { label: 'Pedido', render: row => `<span class="primary-cell">#${esc(row.id)}</span>` },
    { label: 'Cliente', render: row => esc(customerName(row.clientDni)) },
    { label: 'Restaurante', render: row => esc(restaurantName(row.restaurantId)) },
    { label: 'Estado', render: row => statusBadge(orderState(row)) },
    { label: 'Total', render: row => `<span class="primary-cell">${money(row.total)}</span>` },
  ];
  const restaurants = [...data.restaurants].sort((a, b) => data.orders.filter(order => order.restaurantId === b.id).length - data.orders.filter(order => order.restaurantId === a.id).length).slice(0, 4);
  return `${heading('Resumen operativo', 'Una vista clara de lo que sucede en FlashDelivery.', '')}
    <div class="stat-grid">${stats.map(([label, value, icon, note]) => `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></article>`).join('')}</div>
    <div class="dashboard-grid"><section class="panel"><div class="panel-heading"><div><h2>Pedidos recientes</h2><p>Seguimiento de los últimos pedidos registrados</p></div><button class="text-button" data-view="orders">Ver pedidos →</button></div>${table(recentOrders(), orderColumns, 'Aún no hay pedidos', 'Crea el primer pedido para comenzar el seguimiento.')}</section>
    <section class="panel"><div class="panel-heading"><div><h2>Restaurantes</h2><p>Actividad en la red de comercios</p></div><button class="text-button" data-view="restaurants">Ver todos →</button></div><div class="restaurant-list">${restaurants.length ? restaurants.map((item, index) => `<div class="restaurant-row"><div class="restaurant-logo" style="background:${colors[index % colors.length]};color:#3e654b">${esc(item.name.slice(0, 2).toUpperCase())}</div><div class="restaurant-row-copy"><strong>${esc(item.name)}</strong><small>${esc(item.specialties.join(' · '))}</small></div><span class="restaurant-orders">${data.orders.filter(order => order.restaurantId === item.id).length} pedidos</span></div>`).join('') : '<div class="empty-state">Agrega restaurantes para ver su actividad.</div>'}</div></section>
    <section class="panel"><div class="panel-heading"><div><h2>Actividad de pedidos</h2><p>Últimos cambios de estado</p></div></div><div class="activity-list">${recentOrders(4).length ? recentOrders(4).map(order => `<div class="activity-row"><span class="activity-marker">${icons.orders}</span><div class="activity-copy"><strong>Pedido #${esc(order.id)}</strong> · ${esc(orderState(order))}<small>${dateLabel(order.history.at(-1)?.at)} · ${esc(customerName(order.clientDni))}</small></div></div>`).join('') : '<div class="empty-state">Los cambios de estado aparecerán aquí.</div>'}</div></section>
    <section class="panel"><div class="panel-heading"><div><h2>Disponibilidad de reparto</h2><p>Asignación actual de la flota</p></div></div><div class="activity-list">${data.couriers.slice(0, 5).map(courier => { const assigned = data.orders.find(order => order.courierPlate === courier.plate && isActive(order)); return `<div class="activity-row"><span class="activity-marker">⌁</span><div class="activity-copy"><strong>${esc(fullName(courier))}</strong> · ${assigned ? `Pedido #${esc(assigned.id)}` : 'Disponible'}<small>${esc(courier.plate)} · ${assigned ? esc(orderState(assigned)) : 'Sin pedido activo'}</small></div></div>`; }).join('') || '<div class="empty-state">Agrega repartidores para ver la disponibilidad.</div>'}</div></section></div>`;
}

function actions(type, id) {
  return `<div class="row-actions"><button class="row-action" data-edit="${type}" data-id="${esc(id)}">Editar</button><button class="row-action delete" data-delete="${type}" data-id="${esc(id)}">Eliminar</button></div>`;
}

function modulePage(type) {
  const configs = {
    orders: { title: 'Pedidos', description: 'Gestiona pedidos, asignaciones y seguimiento de entrega.', add: 'Nuevo pedido', rows: data.orders, search: true, columns: [
      { label: 'Pedido', render: row => `<span class="primary-cell">#${esc(row.id)}</span>` }, { label: 'Fecha', render: row => dateLabel(row.date) }, { label: 'Cliente', render: row => esc(customerName(row.clientDni)) }, { label: 'Restaurante', render: row => esc(restaurantName(row.restaurantId)) }, { label: 'Repartidor', render: row => esc(courierName(row.courierPlate)) }, { label: 'Estado', render: row => statusBadge(orderState(row)) }, { label: 'Total', render: row => `<span class="primary-cell">${money(row.total)}</span>` }, { label: 'Acciones', render: row => actions(type, row.id) },
    ] },
    restaurants: { title: 'Restaurantes', description: 'Administra comercios y sus especialidades gastronómicas.', add: 'Nuevo restaurante', rows: data.restaurants, search: true, columns: [
      { label: 'Código', render: row => `<span class="primary-cell">${esc(row.id)}</span>` }, { label: 'Restaurante', render: row => `<span class="primary-cell">${esc(row.name)}</span>` }, { label: 'Especialidades', render: row => esc(row.specialties.join(' · ')) }, { label: 'Productos', render: row => data.products.filter(product => product.restaurantId === row.id).length }, { label: 'Pedidos', render: row => data.orders.filter(order => order.restaurantId === row.id).length }, { label: 'Acciones', render: row => actions(type, row.id) },
    ] },
    products: { title: 'Productos', description: 'Catálogo de productos publicados por cada restaurante.', add: 'Nuevo producto', rows: data.products, search: true, columns: [
      { label: 'Código', render: row => `<span class="primary-cell">${esc(row.id)}</span>` }, { label: 'Producto', render: row => `<span class="primary-cell">${esc(row.name)}</span>` }, { label: 'Restaurante', render: row => esc(restaurantName(row.restaurantId)) }, { label: 'Precio', render: row => `<span class="primary-cell">${money(row.price)}</span>` }, { label: 'En pedidos', render: row => data.orders.reduce((sum, order) => sum + order.details.filter(detail => detail.productId === row.id).length, 0) }, { label: 'Acciones', render: row => actions(type, row.id) },
    ] },
    couriers: { title: 'Repartidores', description: 'Personal de entrega, licencias y estructura de supervisión.', add: 'Nuevo repartidor', rows: data.couriers, search: true, columns: [
      { label: 'Placa', render: row => `<span class="primary-cell">${esc(row.plate)}</span>` }, { label: 'Repartidor', render: row => `<span class="primary-cell">${esc(fullName(row))}</span>` }, { label: 'Teléfonos', render: row => esc(row.phones.join(' · ')) }, { label: 'Licencia', render: row => `${esc(row.license.number)} · ${esc(row.license.type)}` }, { label: 'Vencimiento', render: row => dateLabel(row.license.expiry).split(',')[0] }, { label: 'Supervisor', render: row => row.supervisorPlate ? esc(courierName(row.supervisorPlate)) : '<span class="muted-cell">Sin supervisor</span>' }, { label: 'Disponibilidad', render: row => statusBadge(data.orders.some(order => order.courierPlate === row.plate && isActive(order)) ? 'En camino' : 'Disponible') }, { label: 'Acciones', render: row => actions(type, row.plate) },
    ] },
    clients: { title: 'Clientes', description: 'Directorio de clientes y sus direcciones de entrega.', add: 'Nuevo cliente', rows: data.clients, search: true, columns: [
      { label: 'DNI', render: row => `<span class="primary-cell">${esc(row.dni)}</span>` }, { label: 'Cliente', render: row => `<span class="primary-cell">${esc(row.name)}</span>` }, { label: 'Dirección', render: row => `${esc(row.street)} ${esc(row.houseNumber)}, ${esc(row.zone)}` }, { label: 'Pedidos', render: row => data.orders.filter(order => order.clientDni === row.dni).length }, { label: 'Frecuencia', render: row => `<span class="status-pill">${frequency(row.dni)}</span>` }, { label: 'Acciones', render: row => actions(type, row.dni) },
    ] },
  };
  const config = configs[type];
  const addButton = pageAction(type, config.add);
  const search = config.search ? `<div class="section-toolbar"><input class="search-field" id="table-search" type="search" placeholder="Buscar ${type === 'orders' ? 'por pedido, cliente o estado' : `en ${config.title.toLowerCase()}`}..." aria-label="Buscar ${config.title.toLowerCase()}"><span class="toolbar-spacer"></span>${addButton}</div>` : '';
  return `${heading(config.title, config.description, config.search ? '' : addButton)}${search}<section class="table-panel" id="table-panel">${table(config.rows, config.columns, `No hay ${config.title.toLowerCase()} registrados`, `Usa «${config.add}» para agregar el primer registro.`)}<div class="table-footer"><span id="record-count">${config.rows.length} registros</span><span>Datos guardados en este sistema</span></div></section>`;
}

function frequency(dni) {
  const orders = data.orders.filter(order => order.clientDni === dni).sort((a, b) => new Date(a.date) - new Date(b.date));
  if (orders.length < 2) return orders.length ? '1 pedido' : 'Sin historial';
  const weeks = Math.max((new Date(orders.at(-1).date) - new Date(orders[0].date)) / 604800000, 1);
  return `${(orders.length / weeks).toFixed(1)} / sem.`;
}

function render() {
  document.querySelector('#breadcrumb-current').textContent = labels[currentView];
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === currentView));
  document.querySelector('#nav-orders').textContent = data.orders.filter(isActive).length;
  root.innerHTML = currentView === 'overview' ? overview() : modulePage(currentView);
  const search = document.querySelector('#table-search');
  if (search) search.addEventListener('input', () => {
    const query = search.value.trim().toLocaleLowerCase('es');
    document.querySelectorAll('#table-panel tbody tr').forEach(row => { row.hidden = !row.textContent.toLocaleLowerCase('es').includes(query); });
    const visible = [...document.querySelectorAll('#table-panel tbody tr')].filter(row => !row.hidden).length;
    document.querySelector('#record-count').textContent = `${visible} de ${data[currentView].length} registros`;
  });
}

function field(label, name, value = '', options = {}) {
  const required = options.required === false ? '' : 'required';
  const wide = options.wide ? ' wide' : '';
  let control;
  if (options.select) {
    const choices = options.select.map(([choice, text]) => `<option value="${esc(choice)}" ${String(value) === String(choice) ? 'selected' : ''}>${esc(text)}</option>`).join('');
    control = `<select class="form-control" name="${name}" ${required}>${options.required === false ? '<option value="">Sin asignar</option>' : ''}${choices}</select>`;
  } else control = `<input class="form-control" name="${name}" value="${esc(value)}" type="${options.type || 'text'}" placeholder="${esc(options.placeholder || '')}" ${options.step ? `step="${options.step}"` : ''} ${options.readonly ? 'readonly' : ''} ${required}>`;
  return `<div class="form-field${wide}"><label for="field-${name}">${label}</label>${control}${options.help ? `<span class="form-help">${options.help}</span>` : ''}</div>`;
}

function optionList(items, valueKey, labelFn, selected = '') {
  return items.map(item => [item[valueKey], labelFn(item), item[valueKey] === selected]).map(([value, label, isSelected]) => `<option value="${esc(value)}" ${isSelected ? 'selected' : ''}>${esc(label)}</option>`).join('');
}

function formFields(type, item = {}) {
  if (type === 'restaurants') return `${field('Código único', 'id', item.id, { placeholder: 'REST-001', readonly: Boolean(item.id) })}${field('Nombre', 'name', item.name, { placeholder: 'Nombre del restaurante' })}${field('Especialidades', 'specialties', (item.specialties || []).join(', '), { wide: true, placeholder: 'Pizza, italiana, vegana', help: 'Separa cada especialidad con una coma.' })}`;
  if (type === 'products') return `${field('Código del producto', 'id', item.id, { placeholder: 'PROD-001', readonly: Boolean(item.id) })}${field('Nombre', 'name', item.name, { placeholder: 'Nombre del producto' })}${field('Precio (COP)', 'price', item.price, { type: 'number', step: '1', placeholder: '25000' })}${field('Restaurante', 'restaurantId', item.restaurantId, { select: data.restaurants.map(row => [row.id, row.name]) })}`;
  if (type === 'couriers') {
    const supervisors = data.couriers.filter(row => row.plate !== item.plate).map(row => [row.plate, fullName(row)]);
    return `${field('Placa de moto', 'plate', item.plate, { placeholder: 'ABC-123', readonly: Boolean(item.plate) })}${field('Nombre(s)', 'firstName', item.firstName, { placeholder: 'Nombre(s)' })}${field('Apellidos', 'lastName', item.lastName, { placeholder: 'Apellidos' })}${field('Teléfonos', 'phones', (item.phones || []).join(', '), { wide: true, placeholder: '300 123 4567, 310 765 4321', help: 'Registra todos los números separados por coma.' })}<div class="modal-section">Licencia de conducir</div>${field('Número único', 'licenseNumber', item.license?.number, { placeholder: 'LIC-00001' })}${field('Tipo', 'licenseType', item.license?.type, { placeholder: 'A2' })}${field('Fecha de vencimiento', 'licenseExpiry', item.license?.expiry, { type: 'date' })}<div class="modal-section">Supervisión</div>${field('Supervisor', 'supervisorPlate', item.supervisorPlate, { select: supervisors, required: false, help: 'Vacío si es un repartidor experimentado sin supervisor.' })}`;
  }
  if (type === 'clients') return `${field('DNI', 'dni', item.dni, { placeholder: 'Identificación del cliente', readonly: Boolean(item.dni) })}${field('Nombre completo', 'name', item.name, { placeholder: 'Nombre y apellidos' })}${field('Calle', 'street', item.street, { placeholder: 'Calle o avenida' })}${field('Número de casa', 'houseNumber', item.houseNumber, { placeholder: 'Número' })}${field('Zona', 'zone', item.zone, { placeholder: 'Barrio o zona' })}<div class="form-field"><label>Frecuencia de pedido</label><span class="form-control" style="display:flex;align-items:center;background:#f8faf6;color:#4c7154">${item.dni ? frequency(item.dni) : 'Calculada automáticamente'}</span><span class="form-help">Se calcula con el historial, no se almacena.</span></div>`;
  const existing = item.id ? item : null;
  const products = data.products.filter(product => !existing || product.restaurantId === existing.restaurantId);
  return `<div class="form-field"><label for="field-id">Número de pedido</label><input class="form-control" name="id" value="${esc(item.id || '')}" placeholder="PED-001" required ${existing ? 'readonly' : ''}></div>${field('Fecha', 'date', item.date ? item.date.slice(0, 16) : new Date().toISOString().slice(0, 16), { type: 'datetime-local' })}${field('Cliente', 'clientDni', item.clientDni, { select: data.clients.map(row => [row.dni, row.name]) })}${field('Restaurante', 'restaurantId', item.restaurantId, { select: data.restaurants.map(row => [row.id, row.name]) })}${field('Repartidor', 'courierPlate', item.courierPlate, { select: data.couriers.filter(courier => !data.orders.some(order => order.courierPlate === courier.plate && isActive(order) && order.id !== item.id)).map(row => [row.plate, `${fullName(row)} (${row.plate})`]) })}<div class="modal-section">Detalle del pedido</div><div class="wide"><div class="detail-list" id="detail-list">${(item.details?.length ? item.details : [{ productId: '', quantity: 1 }]).map(detail => detailRow(detail, products)).join('')}</div><button class="secondary-button add-detail" type="button" id="add-detail">＋ Agregar producto</button></div><div class="form-field"><label>Total calculado</label><span class="form-control" id="order-total" style="display:flex;align-items:center;background:#f8faf6;font-weight:700">${money(item.total)}</span></div>${field('Estado actual', 'status', orderState(item) === 'Sin estado' ? 'En preparación' : orderState(item), { select: [['En preparación', 'En preparación'], ['En camino', 'En camino'], ['Entregado', 'Entregado'], ['Cancelado', 'Cancelado']] })}<span class="form-help wide">Cada cambio de estado agrega una entrada fechada al historial del pedido.</span>`;
}

function detailRow(detail, products) {
  const choices = products.map(product => `<option value="${esc(product.id)}" data-price="${Number(product.price)}" ${product.id === detail.productId ? 'selected' : ''}>${esc(product.name)} · ${money(product.price)}</option>`).join('');
  return `<div class="detail-row"><div class="form-field"><label>Producto</label><select class="form-control detail-product" required><option value="">Selecciona un producto</option>${choices}</select></div><div class="form-field"><label>Cantidad</label><input class="form-control detail-quantity" type="number" min="1" step="1" value="${Number(detail.quantity) || 1}" required></div><button type="button" class="inline-remove" aria-label="Quitar producto">×</button></div>`;
}

function openForm(type, id = '') {
  const collections = { restaurants: 'restaurants', products: 'products', couriers: 'couriers', clients: 'clients', orders: 'orders' };
  const collection = data[collections[type]];
  const key = type === 'couriers' ? 'plate' : type === 'clients' ? 'dni' : 'id';
  const item = id ? collection.find(row => String(row[key]) === String(id)) : {};
  if (id && !item) return toast('No se encontró el registro.', true);
  if (type === 'products' && !data.restaurants.length) return toast('Primero registra un restaurante.', true);
  if (type === 'orders' && (!data.restaurants.length || !data.clients.length || !data.couriers.length || !data.products.length)) return toast('Para crear pedidos, registra restaurantes, productos, clientes y repartidores.', true);
  const titles = { restaurants: 'restaurante', products: 'producto', couriers: 'repartidor', clients: 'cliente', orders: 'pedido' };
  modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><h2 id="modal-title">${id ? 'Editar' : 'Nuevo'} ${titles[type]}</h2><button class="modal-close" type="button" aria-label="Cerrar">×</button></header><form id="record-form"><div class="modal-body"><div class="form-grid">${formFields(type, item)}</div></div><footer class="modal-footer"><button class="secondary-button" type="button" data-close>Cancelar</button><button class="primary-button" type="submit">${id ? 'Guardar cambios' : 'Crear registro'}</button></footer></form></section></div>`;
  modalRoot.querySelector('.modal-close').addEventListener('click', closeModal);
  modalRoot.querySelector('[data-close]').addEventListener('click', closeModal);
  modalRoot.querySelector('.modal-backdrop').addEventListener('click', event => { if (event.target.classList.contains('modal-backdrop')) closeModal(); });
  if (type === 'orders') setupOrderFields(item);
  modalRoot.querySelector('#record-form').addEventListener('submit', event => submitForm(event, type, item, key));
}

function setupOrderFields(item) {
  const list = modalRoot.querySelector('#detail-list');
  const restaurant = modalRoot.querySelector('[name="restaurantId"]');
  const refreshProducts = () => {
    const options = data.products.filter(product => product.restaurantId === restaurant.value);
    list.querySelectorAll('.detail-product').forEach(select => {
      const selected = select.value;
      select.innerHTML = `<option value="">Selecciona un producto</option>${options.map(product => `<option value="${esc(product.id)}" data-price="${Number(product.price)}" ${product.id === selected ? 'selected' : ''}>${esc(product.name)} · ${money(product.price)}</option>`).join('')}`;
    });
    updateOrderTotal();
  };
  restaurant.addEventListener('change', refreshProducts);
  modalRoot.querySelector('#add-detail').addEventListener('click', () => {
    list.insertAdjacentHTML('beforeend', detailRow({ productId: '', quantity: 1 }, data.products.filter(product => product.restaurantId === restaurant.value)));
    bindDetailEvents(list.lastElementChild);
  });
  list.querySelectorAll('.detail-row').forEach(bindDetailEvents);
  refreshProducts();
}

function bindDetailEvents(row) {
  row.querySelector('.detail-product').addEventListener('change', updateOrderTotal);
  row.querySelector('.detail-quantity').addEventListener('input', updateOrderTotal);
  row.querySelector('.inline-remove').addEventListener('click', () => {
    if (modalRoot.querySelectorAll('.detail-row').length <= 1) return toast('El pedido debe tener al menos un producto.', true);
    row.remove();
    updateOrderTotal();
  });
}

function updateOrderTotal() {
  const total = [...modalRoot.querySelectorAll('.detail-row')].reduce((sum, row) => {
    const product = row.querySelector('.detail-product').selectedOptions[0];
    return sum + Number(product?.dataset.price || 0) * Number(row.querySelector('.detail-quantity').value || 0);
  }, 0);
  const output = modalRoot.querySelector('#order-total');
  if (output) output.textContent = money(total);
}

function closeModal() { modalRoot.innerHTML = ''; }

async function submitForm(event, type, item, key) {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = Object.fromEntries(new FormData(form).entries());
  const next = structuredClone(data);
  const collection = type;
  let record;
  if (type === 'restaurants') record = { id: fields.id.trim(), name: fields.name.trim(), specialties: fields.specialties.split(',').map(value => value.trim()).filter(Boolean) };
  if (type === 'products') record = { id: fields.id.trim(), name: fields.name.trim(), restaurantId: fields.restaurantId, price: Number(fields.price) };
  if (type === 'couriers') record = { plate: fields.plate.trim().toUpperCase(), firstName: fields.firstName.trim(), lastName: fields.lastName.trim(), phones: fields.phones.split(',').map(value => value.trim()).filter(Boolean), license: { number: fields.licenseNumber.trim(), type: fields.licenseType.trim(), expiry: fields.licenseExpiry }, supervisorPlate: fields.supervisorPlate || '' };
  if (type === 'clients') record = { dni: fields.dni.trim(), name: fields.name.trim(), street: fields.street.trim(), houseNumber: fields.houseNumber.trim(), zone: fields.zone.trim() };
  if (type === 'orders') {
    const details = [...form.querySelectorAll('.detail-row')].map(row => ({ productId: row.querySelector('.detail-product').value, quantity: Number(row.querySelector('.detail-quantity').value) }));
    const total = details.reduce((sum, detail) => sum + Number(data.products.find(product => product.id === detail.productId)?.price || 0) * detail.quantity, 0);
    const history = item.history ? [...item.history] : [];
    const status = fields.status;
    if (!history.length || orderState(item) !== status) history.push({ number: history.length + 1, at: new Date().toISOString(), description: status });
    record = { id: fields.id.trim(), date: new Date(fields.date).toISOString(), total, restaurantId: fields.restaurantId, clientDni: fields.clientDni, courierPlate: fields.courierPlate, details, history };
  }
  const existingIndex = next[collection].findIndex(row => String(row[key]) === String(item[key]));
  if (existingIndex >= 0) next[collection][existingIndex] = record;
  else next[collection].push(record);
  try {
    await saveData(next);
    closeModal();
    toast(`${type === 'orders' ? 'Pedido' : type.slice(0, -1)} ${item[key] ? 'actualizado' : 'creado'} correctamente.`);
  } catch (error) { toast(error.message, true); }
}

async function deleteRecord(type, id) {
  if (!confirm(`¿Eliminar este registro? Esta acción también puede eliminar sus registros dependientes.`)) return;
  try {
    data = await api(`/api/${type}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    render();
    toast('Registro eliminado correctamente.');
  } catch (error) { toast(error.message, true); }
}

document.addEventListener('click', event => {
  const view = event.target.closest('[data-view]');
  if (view) { currentView = view.dataset.view; render(); return; }
  const add = event.target.closest('[data-add]');
  if (add) { openForm(add.dataset.add); return; }
  const edit = event.target.closest('[data-edit]');
  if (edit) { openForm(edit.dataset.edit, edit.dataset.id); return; }
  const remove = event.target.closest('[data-delete]');
  if (remove) deleteRecord(remove.dataset.delete, remove.dataset.id);
});

document.querySelector('#refresh-button').addEventListener('click', async () => {
  try { data = await api('/api/data'); render(); toast('Datos actualizados.'); } catch (error) { toast(error.message, true); }
});

document.querySelector('#today-date').textContent = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
api('/api/data').then(result => { data = result; render(); }).catch(error => { root.innerHTML = `<div class="empty-state"><strong>No se pudo cargar FlashDelivery</strong>${esc(error.message)}. Comprueba que el servidor esté en ejecución.</div>`; });