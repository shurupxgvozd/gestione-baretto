'use strict';

const board = document.querySelector('#ordersBoard');
const message = document.querySelector('#statusMessage');
const lastUpdate = document.querySelector('#lastUpdate');
const stateLabels = {
  in_attesa: 'In attesa',
  in_preparazione: 'In preparazione',
  completato: 'Completato',
};
const progressSteps = ['in_attesa', 'in_preparazione', 'completato'];

function makeProgress(order) {
  const progress = document.createElement('ol');
  progress.className = 'progress-steps';
  progress.setAttribute('aria-label', `Avanzamento: ${stateLabels[order.stato]}`);
  const activeIndex = progressSteps.indexOf(order.stato);

  progressSteps.forEach((step, index) => {
    const item = document.createElement('li');
    item.className = index <= activeIndex ? 'is-complete' : '';
    if (index === activeIndex) item.classList.add('is-current');
    item.textContent = stateLabels[step];
    progress.append(item);
  });

  return progress;
}

function renderOrder(order) {
  const article = document.createElement('article');
  article.className = 'status-order';

  const heading = document.createElement('div');
  heading.className = 'status-order-heading';
  const number = document.createElement('strong');
  number.className = 'order-number';
  number.textContent = `Ordine #${order.id}`;
  const badge = document.createElement('span');
  badge.className = `status-badge status-${order.stato}`;
  badge.textContent = stateLabels[order.stato] || 'Stato sconosciuto';
  heading.append(number, badge);

  const product = document.createElement('p');
  product.className = 'order-product';
  product.textContent = `${order.quantita} × ${order.prodotto}`;

  const time = document.createElement('time');
  time.className = 'order-time';
  const createdAt = new Date(order.creato_il);
  if (!Number.isNaN(createdAt.getTime())) {
    time.dateTime = createdAt.toISOString();
    time.textContent = new Intl.DateTimeFormat('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(createdAt);
  }

  article.append(heading, product, makeProgress(order), time);
  return article;
}

async function refreshOrders() {
  try {
    const response = await fetch('/api/stato-ordini', { cache: 'no-store' });
    if (!response.ok) throw new Error('Stato ordini non disponibile.');
    const orders = await response.json();
    board.replaceChildren();
    orders.forEach((order) => board.append(renderOrder(order)));
    message.textContent = orders.length ? '' : 'Nessun ordine in corso oggi.';
    lastUpdate.textContent = `Aggiornato alle ${new Intl.DateTimeFormat('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date())}`;
  } catch (error) {
    message.textContent = error.message;
    lastUpdate.textContent = 'Connessione non disponibile';
  }
}

refreshOrders();
window.setInterval(refreshOrders, 10000);
