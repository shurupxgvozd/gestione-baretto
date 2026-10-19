'use strict';

const homeDate = document.querySelector('#homeDate');
const homeUpdated = document.querySelector('#homeUpdated');
const homeError = document.querySelector('#homeError');
const homeTotal = document.querySelector('#homeTotal');
const homeWaiting = document.querySelector('#homeWaiting');
const homePreparing = document.querySelector('#homePreparing');
const homeCompleted = document.querySelector('#homeCompleted');

homeDate.textContent = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).format(new Date());

async function refreshOverview() {
  try {
    const response = await fetch('/api/stato-ordini', { cache: 'no-store' });
    if (!response.ok) throw new Error('Riepilogo non disponibile.');
    const orders = await response.json();
    homeTotal.textContent = String(orders.length);
    homeWaiting.textContent = String(orders.filter((order) => order.stato === 'in_attesa').length);
    homePreparing.textContent = String(orders.filter((order) => order.stato === 'in_preparazione').length);
    homeCompleted.textContent = String(orders.filter((order) => order.stato === 'completato').length);
    homeUpdated.textContent = `Aggiornato alle ${new Intl.DateTimeFormat('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date())}`;
    homeError.textContent = '';
  } catch (error) {
    homeError.textContent = error.message;
    homeUpdated.textContent = 'Connessione non disponibile';
  }
}

refreshOverview();
window.setInterval(refreshOverview, 30000);
