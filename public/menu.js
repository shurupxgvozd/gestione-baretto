'use strict';

const productGrid = document.querySelector('#productGrid');
const categoryFilters = document.querySelector('#categoryFilters');
const menuFeedback = document.querySelector('#menuFeedback');
const cartItems = document.querySelector('#cartItems');
const cartEmpty = document.querySelector('#cartEmpty');
const cartTotal = document.querySelector('#cartTotal');
const cartItemCount = document.querySelector('#cartItemCount');
const headerCartCount = document.querySelector('#headerCartCount');
const checkoutButton = document.querySelector('#checkoutButton');
const orderFeedback = document.querySelector('#orderFeedback');
const menuSearch = document.querySelector('#menuSearch');
const basketKey = 'baretto_cart_v1';
const currency = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const productPhotos = [
  [/cappucc|latte macchiato/i, 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=900&q=82'],
  [/espresso|caff[eè]|americano/i, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=82'],
  [/cornetto|croissant|brioche/i, 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=900&q=82'],
  [/cheesecake/i, 'https://images.unsplash.com/photo-1524351199678-941a58a3df50?auto=format&fit=crop&w=900&q=82'],
  [/tiramisu|torta|dolce/i, 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=900&q=82'],
  [/panino|toast|tramezzino|sandwich/i, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=82'],
  [/pizza|focaccia/i, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=82'],
  [/burger|hamburger/i, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=82'],
  [/insalata|verdure/i, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=82'],
  [/cocktail|spritz|aperitivo/i, 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=82'],
  [/limonata|lemonade|limone/i, 'https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9e?auto=format&fit=crop&w=900&q=82'],
];
const categoryPhotos = [
  [/caff|bev|drink|bibit|colaz/i, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=82'],
  [/dolc|dessert|pastic|tort/i, 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=900&q=82'],
  [/panin|sandwich|toast/i, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=82'],
  [/pizza|focacc/i, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=82'],
  [/burger|hamburger/i, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=82'],
  [/insalat|verd|veg/i, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=82'],
];
const defaultPhoto = 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=82';

let products = [];
let basket = restoreBasket();
let activeCategory = 'Tutti';
let submitting = false;

function restoreBasket() {
  try {
    const saved = JSON.parse(localStorage.getItem(basketKey) || '[]');
    return new Map(saved.filter((item) => Number.isInteger(item.id) && Number.isInteger(item.quantity) && item.quantity > 0)
      .map((item) => [item.id, Math.min(item.quantity, 50)]));
  } catch {
    return new Map();
  }
}

function persistBasket() {
  try {
    localStorage.setItem(basketKey, JSON.stringify([...basket].map(([id, quantity]) => ({ id, quantity }))));
  } catch {}
}

function imageCandidates(product) {
  const name = String(product.nome || '');
  const namedPhoto = productPhotos.find(([pattern]) => pattern.test(name))?.[1];
  const category = String(product.categoria || '');
  const categoryPhoto = categoryPhotos.find(([pattern]) => pattern.test(category))?.[1];
  return [...new Set([product.immagine_url, namedPhoto, categoryPhoto, defaultPhoto].filter(Boolean))];
}

function descriptionFor(product) {
  if (product.descrizione?.trim()) return product.descrizione.trim();
  const category = String(product.categoria || '');
  if (/dolc|dessert|pastic|tort/i.test(category)) return 'Una nota dolce per rendere speciale la tua pausa.';
  if (/panin|sandwich|toast|pizza|focacc/i.test(category)) return 'Una proposta sfiziosa, da gustare al banco o con calma.';
  if (/caff|bev|drink|bibit|colaz/i.test(category)) return 'Un classico del banco, pronto ad accompagnare la tua pausa.';
  return 'Una delle proposte del Baretto, da scoprire al primo assaggio.';
}

function productImage(product) {
  const image = document.createElement('img');
  const sources = imageCandidates(product);
  let sourceIndex = 0;
  image.src = sources[sourceIndex];
  image.alt = product.nome;
  image.loading = 'lazy';
  image.addEventListener('error', () => {
    if (sourceIndex < sources.length - 1) {
      sourceIndex += 1;
      image.src = sources[sourceIndex];
      return;
    }
    image.remove();
  });
  return image;
}

function makeCategoryFilters() {
  const categories = [...new Set(products.map((product) => product.categoria?.trim()).filter(Boolean))]
    .sort((first, second) => first.localeCompare(second, 'it'));
  categoryFilters.replaceChildren();
  ['Tutti', ...categories].forEach((category) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-filter';
    button.textContent = category;
    button.setAttribute('aria-pressed', String(category === activeCategory));
    button.addEventListener('click', () => {
      activeCategory = category;
      makeCategoryFilters();
      renderProducts();
    });
    categoryFilters.append(button);
  });
}

function makeProductCard(product, index) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.style.animationDelay = `${Math.min(index, 8) * 35}ms`;

  const photo = document.createElement('div');
  photo.className = 'product-photo';
  photo.append(productImage(product));
  if (product.categoria) {
    const category = document.createElement('span');
    category.className = 'product-category';
    category.textContent = product.categoria;
    photo.append(category);
  }

  const details = document.createElement('div');
  details.className = 'product-details';
  const name = document.createElement('h3');
  name.textContent = product.nome;
  const description = document.createElement('p');
  description.textContent = descriptionFor(product);
  const buyRow = document.createElement('div');
  buyRow.className = 'product-buy';
  const price = document.createElement('span');
  price.className = 'product-price';
  price.textContent = currency.format(Number(product.prezzo));
  const addButton = document.createElement('button');
  addButton.className = 'add-product';
  addButton.type = 'button';
  addButton.textContent = '＋ Aggiungi';
  addButton.setAttribute('aria-label', `Aggiungi ${product.nome} al carrello`);
  addButton.addEventListener('click', () => changeQuantity(product.id, 1));
  buyRow.append(price, addButton);
  details.append(name, description, buyRow);
  card.append(photo, details);
  return card;
}

function renderProducts() {
  const query = menuSearch.value.trim().toLocaleLowerCase('it');
  const filtered = products.filter((product) => {
    const matchesCategory = activeCategory === 'Tutti' || product.categoria?.trim() === activeCategory;
    const searchable = `${product.nome} ${product.descrizione || ''} ${product.categoria || ''}`.toLocaleLowerCase('it');
    return matchesCategory && searchable.includes(query);
  });
  productGrid.replaceChildren(...filtered.map(makeProductCard));
  if (!products.length) {
    menuFeedback.textContent = 'Stiamo preparando la selezione del Baretto. Torna presto per scoprire il menu.';
  } else if (!filtered.length) {
    menuFeedback.textContent = 'Nessun prodotto corrisponde alla ricerca.';
  } else {
    menuFeedback.textContent = `${filtered.length} ${filtered.length === 1 ? 'proposta disponibile' : 'proposte disponibili'}`;
  }
}

function changeQuantity(productId, change) {
  const nextQuantity = (basket.get(Number(productId)) || 0) + change;
  if (nextQuantity < 1) basket.delete(Number(productId));
  else basket.set(Number(productId), Math.min(nextQuantity, 50));
  persistBasket();
  renderBasket();
}

function makeCartLine(product, quantity) {
  const item = document.createElement('li');
  item.className = 'cart-line';
  const main = document.createElement('div');
  main.className = 'cart-line-main';
  const name = document.createElement('span');
  name.className = 'cart-line-name';
  name.textContent = product.nome;
  const unitPrice = document.createElement('span');
  unitPrice.className = 'cart-line-price';
  unitPrice.textContent = `${currency.format(Number(product.prezzo))} cad.`;
  const controls = document.createElement('div');
  controls.className = 'quantity-controls';
  const decrease = document.createElement('button');
  decrease.type = 'button';
  decrease.textContent = '−';
  decrease.setAttribute('aria-label', `Rimuovi un ${product.nome}`);
  decrease.addEventListener('click', () => changeQuantity(product.id, -1));
  const count = document.createElement('span');
  count.className = 'quantity-value';
  count.textContent = String(quantity);
  const increase = document.createElement('button');
  increase.type = 'button';
  increase.textContent = '+';
  increase.setAttribute('aria-label', `Aggiungi un ${product.nome}`);
  increase.disabled = quantity >= 50;
  increase.addEventListener('click', () => changeQuantity(product.id, 1));
  controls.append(decrease, count, increase);
  main.append(name, unitPrice, controls);

  const actions = document.createElement('div');
  const lineTotal = document.createElement('span');
  lineTotal.className = 'cart-line-total';
  lineTotal.textContent = currency.format(Number(product.prezzo) * quantity);
  const remove = document.createElement('button');
  remove.className = 'remove-line';
  remove.type = 'button';
  remove.textContent = '×';
  remove.setAttribute('aria-label', `Rimuovi ${product.nome} dal carrello`);
  remove.addEventListener('click', () => {
    basket.delete(Number(product.id));
    persistBasket();
    renderBasket();
  });
  actions.append(lineTotal, remove);
  item.append(main, actions);
  return item;
}

function renderBasket() {
  const activeProducts = products.filter((product) => basket.has(Number(product.id)));
  const quantityCount = activeProducts.reduce((sum, product) => sum + basket.get(Number(product.id)), 0);
  const total = activeProducts.reduce((sum, product) => sum + Number(product.prezzo) * basket.get(Number(product.id)), 0);
  const hasItems = quantityCount > 0;

  cartItems.replaceChildren(...activeProducts.map((product) => makeCartLine(product, basket.get(Number(product.id)))));
  cartEmpty.hidden = hasItems;
  cartItems.hidden = !hasItems;
  cartItemCount.textContent = `${quantityCount} ${quantityCount === 1 ? 'articolo' : 'articoli'}`;
  headerCartCount.textContent = String(quantityCount);
  cartTotal.textContent = currency.format(total);
  checkoutButton.disabled = !hasItems || submitting;
  checkoutButton.querySelector('span:first-child').textContent = submitting ? 'Invio in corso…' : 'Invia ordine';
}

async function loadMenu() {
  try {
    const response = await fetch('/api/menu');
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Impossibile caricare il menu.');
    products = data;
    const availableIds = new Set(products.map((product) => Number(product.id)));
    for (const productId of basket.keys()) {
      if (!availableIds.has(productId)) basket.delete(productId);
    }
    persistBasket();
    activeCategory = 'Tutti';
    makeCategoryFilters();
    renderProducts();
    renderBasket();
  } catch (error) {
    menuFeedback.textContent = error.message;
    productGrid.replaceChildren();
  }
}

async function submitOrder() {
  if (!basket.size || submitting) return;
  submitting = true;
  orderFeedback.classList.remove('is-error');
  orderFeedback.textContent = '';
  renderBasket();
  try {
    const response = await fetch('/api/self-service/ordini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articoli: [...basket].map(([prodotto_id, quantita]) => ({ prodotto_id, quantita })),
        metodo_pagamento: document.querySelector('input[name="payment_method"]:checked').value,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Non è stato possibile inviare l’ordine.');
    basket.clear();
    persistBasket();
    orderFeedback.textContent = `Ordine ricevuto. Numero ${data.ids.map((id) => `#${id}`).join(', ')} · ${currency.format(data.totale)}. Pagamento al banco.`;
  } catch (error) {
    orderFeedback.classList.add('is-error');
    orderFeedback.textContent = error.message;
  } finally {
    submitting = false;
    renderBasket();
  }
}

menuSearch.addEventListener('input', renderProducts);
checkoutButton.addEventListener('click', submitOrder);
loadMenu();
