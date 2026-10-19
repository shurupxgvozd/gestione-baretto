'use strict';

const orderForm = document.querySelector('#ordineForm');
const productSelect = orderForm.elements.prodotto_id;
const staffSelect = orderForm.elements.personale_id;
const orderList = document.querySelector('#ordiniList');
const feedback = document.querySelector('#feedback');
const pricePreview = document.querySelector('#prezzoProdotto');
let availableProducts = [];
const statuses = [
  ['in_attesa', 'In attesa'],
  ['in_preparazione', 'In preparazione'],
  ['completato', 'Completato'],
  ['annullato', 'Annullato'],
];

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = response.headers.get('content-type')?.includes('application/json')
    ? await response.json()
    : {};
  if (!response.ok) throw new Error(data.message || 'Errore nella richiesta.');
  return data;
}

function fillSelect(select, entries, placeholder, labelFor) {
  select.replaceChildren(new Option(placeholder, ''));
  entries.forEach((entry) => {
    const option = new Option(labelFor(entry), entry.id);
    select.add(option);
  });
}

function stateLabel(value) {
  return statuses.find(([key]) => key === value)?.[1] || value;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('it-IT', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function addCell(row, value) {
  const cell = document.createElement('td');
  cell.textContent = value;
  row.append(cell);
  return cell;
}

function renderOrder(order) {
  const row = document.createElement('tr');
  addCell(row, `#${order.id}`);
  addCell(row, order.prodotto_nome);
  addCell(row, String(order.quantita));
  addCell(row, order.personale_nome
    ? `${order.personale_nome} ${order.personale_cognome || ''}`.trim()
    : 'Non assegnato');
  addCell(row, `€ ${(Number(order.prezzo_unitario) * Number(order.quantita)).toFixed(2)}`);
  addCell(row, order.metodo_pagamento === 'carta' ? 'Carta al banco' : order.metodo_pagamento === 'contanti' ? 'Contanti' : '—');

  const statusCell = document.createElement('td');
  const statusSelect = document.createElement('select');
  statusSelect.setAttribute('aria-label', `Stato ordine ${order.id}`);
  statuses.forEach(([value, label]) => statusSelect.add(new Option(label, value)));
  statusSelect.value = order.stato;
  statusSelect.addEventListener('change', async () => {
    statusSelect.disabled = true;
    try {
      await fetchJson(`/api/ordini/${order.id}/stato`, {
        method: 'PATCH',
        body: JSON.stringify({ stato: statusSelect.value }),
      });
      feedback.textContent = `Ordine #${order.id}: stato aggiornato.`;
    } catch (error) {
      feedback.textContent = error.message;
      statusSelect.value = order.stato;
    } finally {
      statusSelect.disabled = false;
    }
  });
  statusCell.append(statusSelect);
  row.append(statusCell);
  addCell(row, formatDate(order.creato_il));
  return row;
}

async function loadData() {
  const [products, staff, orders] = await Promise.all([
    fetchJson('/api/prodotti'),
    fetchJson('/api/personale'),
    fetchJson('/api/ordini'),
  ]);
  availableProducts = products.filter((product) => product.disponibile);
  const selectedProduct = productSelect.value;
  fillSelect(productSelect, availableProducts, 'Seleziona prodotto', (product) => product.nome);
  if (availableProducts.some((product) => String(product.id) === selectedProduct)) {
    productSelect.value = selectedProduct;
  }
  fillSelect(staffSelect, staff.filter((person) => person.attivo), 'Non assegnato', (person) =>
    `${person.nome} ${person.cognome}`);
  pricePreview.textContent = getSelectedPrice();

  orderList.replaceChildren();
  if (!orders.length) {
    const row = document.createElement('tr');
    const cell = addCell(row, 'Nessun ordine registrato.');
    cell.colSpan = 8;
    orderList.append(row);
    return;
  }
  orders.forEach((order) => orderList.append(renderOrder(order)));
}

function getSelectedPrice() {
  const selected = productSelect.selectedOptions[0];
  if (!selected?.value) return 'Seleziona un prodotto';
  const product = availableProducts.find((entry) => String(entry.id) === selected.value);
  return product ? `Prezzo unitario: € ${Number(product.prezzo).toFixed(2)}` : '';
}

productSelect.addEventListener('change', () => {
  pricePreview.textContent = getSelectedPrice();
});

document.querySelector('#refreshButton').addEventListener('click', () => {
  loadData().catch((error) => { feedback.textContent = error.message; });
});

orderForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(orderForm);
  try {
    await fetchJson('/api/ordini', {
      method: 'POST',
      body: JSON.stringify({
        prodotto_id: Number(formData.get('prodotto_id')),
        personale_id: formData.get('personale_id') ? Number(formData.get('personale_id')) : null,
        quantita: Number(formData.get('quantita')),
        note: formData.get('note'),
      }),
    });
    orderForm.reset();
    pricePreview.textContent = getSelectedPrice();
    feedback.textContent = 'Ordine registrato.';
    await loadData();
  } catch (error) {
    feedback.textContent = error.message;
  }
});

loadData().catch((error) => {
  feedback.textContent = error.message;
});
