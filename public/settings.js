'use strict';

const settingsDialog = document.querySelector('#settingsDialog');
const settingsButton = document.querySelector('#settingsButton');
const settingsClose = document.querySelector('#settingsClose');
const themeOptions = document.querySelectorAll('input[name="theme"]');
const adminLoginForm = document.querySelector('#adminLoginForm');
const adminLoginFeedback = document.querySelector('#adminLoginFeedback');
const adminSessionPanel = document.querySelector('#adminSessionPanel');
const adminLogoutButton = document.querySelector('#adminLogoutButton');
const adminNavLinks = document.querySelectorAll('[data-admin-nav]');
const savedTheme = localStorage.getItem('baretto-theme');
const initialTheme = savedTheme === 'light' ? 'light' : 'dark';

document.documentElement.dataset.theme = initialTheme;
const selectedTheme = document.querySelector(`input[name="theme"][value="${initialTheme}"]`);
if (selectedTheme) selectedTheme.checked = true;

settingsButton?.addEventListener('click', () => settingsDialog.showModal());
settingsClose?.addEventListener('click', () => settingsDialog.close());

settingsDialog?.addEventListener('click', (event) => {
  if (event.target === settingsDialog) settingsDialog.close();
});

themeOptions.forEach((option) => {
  option.addEventListener('change', () => {
    if (!option.checked) return;
    document.documentElement.dataset.theme = option.value;
    localStorage.setItem('baretto-theme', option.value);
  });
});

async function refreshAdminSession() {
  if (!adminLoginForm && !adminSessionPanel && !adminNavLinks.length) return;
  try {
    const response = await fetch('/api/admin/session');
    const session = await response.json();
    if (adminLoginForm) adminLoginForm.hidden = session.authenticated;
    if (adminSessionPanel) adminSessionPanel.hidden = !session.authenticated;
    adminNavLinks.forEach((link) => { link.hidden = !session.authenticated; });
  } catch {
    if (adminLoginFeedback) adminLoginFeedback.textContent = 'Impossibile verificare la sessione.';
  }
}

adminLoginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  adminLoginFeedback.textContent = '';
  const password = new FormData(adminLoginForm).get('password');
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Accesso non riuscito.');
    window.location.assign('/admin.html');
  } catch (error) {
    adminLoginFeedback.textContent = error.message;
  }
});

adminLogoutButton?.addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  window.location.assign('/settings.html');
});

refreshAdminSession();
