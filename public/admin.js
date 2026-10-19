'use strict';

const prodottiList = document.querySelector('#prodottiList');
const personaleList = document.querySelector('#personaleList');
const feedback = document.querySelector('#feedback');

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = response.headers.get('content-type')?.includes('application/json')
    ? await response.json()
    : {};

  if (!response.ok) {
    throw new Error(data.message || 'Errore nella richiesta.');
  }

  return data;
}

function addValue(item, value, className = '') {
  const element = document.createElement('span');
  element.textContent = value;
  if (className) element.className = className;
  item.append(element);
}

function renderList(list, items, emptyText, renderItem) {
  list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('li');
    empty.textContent = emptyText;
    list.append(empty);
    return;
  }
  items.forEach((data) => list.append(renderItem(data)));
}

function renderProdotto(product) {
  const item = document.createElement('li');
  const name = document.createElement('strong');
  name.textContent = product.nome;
  item.append(name);
  if (product.immagine_url) {
    const image = document.createElement('img');
    image.src = product.immagine_url;
    image.alt = '';
    image.loading = 'lazy';
    image.width = 64;
    image.height = 48;
    image.addEventListener('error', () => image.remove(), { once: true });
    item.append(image);
  }
  addValue(item, product.categoria || 'Generica');
  addValue(item, `€ ${Number(product.prezzo).toFixed(2)}`);
  addValue(item, product.disponibile ? 'Disponibile' : 'Non disponibile');
  return item;
}

function renderPersonale(person) {
  const item = document.createElement('li');
  const name = document.createElement('strong');
  name.textContent = `${person.nome} ${person.cognome}`;
  item.append(name);
  addValue(item, person.ruolo);
  addValue(item, person.attivo ? 'Attivo' : 'Non attivo');
  return item;
}

async function loadData() {
  const [products, staff] = await Promise.all([
    fetchJson('/api/prodotti'),
    fetchJson('/api/personale'),
  ]);
  renderList(prodottiList, products, 'Nessun prodotto inserito.', renderProdotto);
  renderList(personaleList, staff, 'Nessun membro del personale inserito.', renderPersonale);
}

async function submitForm(event, endpoint, buildPayload, successMessage) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  try {
    await fetchJson(endpoint, {
      method: 'POST',
      body: JSON.stringify(buildPayload(formData)),
    });
    form.reset();
    feedback.textContent = successMessage;
    await loadData();
  } catch (error) {
    feedback.textContent = error.message;
  }
}

document.querySelector('#prodottoForm').addEventListener('submit', (event) => {
  submitForm(event, '/api/prodotti', (data) => ({
    nome: data.get('nome'),
    categoria: data.get('categoria'),
    descrizione: data.get('descrizione'),
    immagine_url: data.get('immagine_url'),
    prezzo: Number(data.get('prezzo')),
    disponibile: data.get('disponibile') === 'on',
  }), 'Prodotto aggiunto.');
});

document.querySelector('#personaleForm').addEventListener('submit', (event) => {
  submitForm(event, '/api/personale', (data) => ({
    nome: data.get('nome'),
    cognome: data.get('cognome'),
    ruolo: data.get('ruolo'),
    email: data.get('email'),
    telefono: data.get('telefono'),
    attivo: data.get('attivo') === 'on',
  }), 'Membro del personale aggiunto.');
});

loadData().catch((error) => {
  feedback.textContent = error.message;
});
