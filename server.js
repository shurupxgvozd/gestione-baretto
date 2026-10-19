'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes, timingSafeEqual } = require('node:crypto');
const express = require('express');
const mysql = require('mysql2/promise');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
	process.loadEnvFile(envPath);
}

const pool = mysql.createPool({
	host: process.env.DB_HOST || '127.0.0.1',
	port: Number(process.env.DB_PORT || 3306),
	user: process.env.DB_USER || 'utente',
	password: process.env.DB_PASSWORD || 'password',
	database: process.env.DB_NAME || 'baretto',
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
});

const app = express();
app.use(express.json());

const adminPassword = process.env.ADMIN_PASSWORD || '8900';
const adminSessions = new Map();
const adminSessionTtlMs = 8 * 60 * 60 * 1000;

function sessionToken(request) {
	const cookie = request.headers.cookie || '';
	return cookie.match(/(?:^|;\s*)baretto_admin=([a-f0-9]+)/)?.[1];
}

function isAdmin(request) {
	const token = sessionToken(request);
	const expiresAt = token && adminSessions.get(token);
	if (!expiresAt) return false;
	if (expiresAt <= Date.now()) {
		adminSessions.delete(token);
		return false;
	}
	return true;
}

function requireAdmin(request, response, next) {
	if (isAdmin(request)) return next();
	if (request.method === 'GET' && /^\/(admin|ordini)\.html(?:\?|$)/.test(request.originalUrl)) {
		return response.redirect('/');
	}
	return response.status(401).json({ message: 'Accesso amministratore richiesto.' });
}

function sessionCookie(token, maxAge) {
	const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
	return `baretto_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

app.get('/api/admin/session', (request, response) => {
	response.json({ authenticated: isAdmin(request) });
});

app.post('/api/admin/login', (request, response) => {
	const suppliedPassword = typeof request.body?.password === 'string' ? request.body.password : '';
	const suppliedDigest = createHash('sha256').update(suppliedPassword).digest();
	const expectedDigest = createHash('sha256').update(adminPassword).digest();

	if (!timingSafeEqual(suppliedDigest, expectedDigest)) {
		return response.status(401).json({ message: 'Password non corretta.' });
	}

	const token = randomBytes(32).toString('hex');
	adminSessions.set(token, Date.now() + adminSessionTtlMs);
	response.setHeader('Set-Cookie', sessionCookie(token, adminSessionTtlMs / 1000));
	response.json({ authenticated: true });
});

app.post('/api/admin/logout', (request, response) => {
	const token = sessionToken(request);
	if (token) adminSessions.delete(token);
	response.setHeader('Set-Cookie', sessionCookie('', 0));
	response.json({ authenticated: false });
});

app.get('/api/health', async (request, response) => {
	try {
		await pool.query('SELECT 1');
		response.json({ status: 'ok', database: 'connected' });
	} catch {
		response.status(503).json({ status: 'error', database: 'disconnected' });
	}
});

app.get('/api/menu', async (request, response) => {
	try {
		const [rows] = await pool.query(
			'SELECT id, nome, descrizione, categoria, prezzo, immagine_url FROM prodotti WHERE disponibile = TRUE ORDER BY categoria, nome'
		);
		response.json(rows);
	} catch (error) {
		response.status(500).json({ message: error.message });
	}
});

app.post('/api/self-service/ordini', async (request, response) => {
	const { articoli, metodo_pagamento: paymentMethod } = request.body ?? {};
	const validPaymentMethods = ['contanti', 'carta'];
	if (!Array.isArray(articoli) || articoli.length < 1 || articoli.length > 30) {
		return response.status(400).json({ message: 'Il carrello deve contenere da 1 a 30 prodotti.' });
	}
	if (!validPaymentMethods.includes(paymentMethod)) {
		return response.status(400).json({ message: 'Seleziona un metodo di pagamento valido.' });
	}

	const quantities = new Map();
	for (const item of articoli) {
		const productId = Number(item?.prodotto_id);
		const quantity = Number(item?.quantita);
		if (!Number.isInteger(productId) || productId < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
			return response.status(400).json({ message: 'Prodotto o quantità non validi.' });
		}
		quantities.set(productId, (quantities.get(productId) || 0) + quantity);
	}
	if ([...quantities.values()].some((quantity) => quantity > 50)) {
		return response.status(400).json({ message: 'La quantità massima per prodotto è 50.' });
	}

	const connection = await pool.getConnection();
	let transactionStarted = false;
	try {
		await connection.beginTransaction();
		transactionStarted = true;
		const productIds = [...quantities.keys()];
		const [products] = await connection.query(
			`SELECT id, prezzo FROM prodotti WHERE disponibile = TRUE AND id IN (${productIds.map(() => '?').join(',')}) FOR UPDATE`,
			productIds
		);
		if (products.length !== productIds.length) {
			const error = new Error('Uno o più prodotti non sono più disponibili. Aggiorna il menu.');
			error.statusCode = 409;
			throw error;
		}

		const priceById = new Map(products.map((product) => [Number(product.id), Number(product.prezzo)]));
		const orderIds = [];
		let total = 0;
		for (const [productId, quantity] of quantities) {
			const unitPrice = priceById.get(productId);
			const [result] = await connection.query(
				'INSERT INTO ordini (prodotto_id, quantita, prezzo_unitario, metodo_pagamento, stato, note) VALUES (?, ?, ?, ?, ?, ?)',
				[productId, quantity, unitPrice, paymentMethod, 'in_attesa', 'Ordine self-service']
			);
			orderIds.push(result.insertId);
			total += unitPrice * quantity;
		}
		await connection.commit();
		response.status(201).json({ ids: orderIds, totale: Number(total.toFixed(2)) });
	} catch (error) {
		if (transactionStarted) await connection.rollback();
		response.status(error.statusCode || 500).json({ message: error.message });
	} finally {
		connection.release();
	}
});

app.use(['/api/prodotti', '/api/personale', '/api/ordini'], requireAdmin);

app.get('/api/prodotti', async (request, response) => {
	try {
		const [rows] = await pool.query(
			'SELECT id, nome, descrizione, categoria, prezzo, immagine_url, disponibile FROM prodotti ORDER BY id DESC'
		);
		response.json(rows);
	} catch (error) {
		response.status(500).json({ message: error.message });
	}
});

app.post('/api/prodotti', async (request, response) => {
	try {
		const { nome, descrizione = '', categoria = '', prezzo, immagine_url = '', disponibile = true } = request.body ?? {};
		const numericPrice = Number(prezzo);
		const imageUrl = typeof immagine_url === 'string' ? immagine_url.trim() : null;

		if (typeof nome !== 'string' || !nome.trim() || !Number.isFinite(numericPrice) || numericPrice < 0) {
			return response.status(400).json({ message: 'Nome e prezzo sono obbligatori.' });
		}
		if (imageUrl === null || imageUrl.length > 2048 || (imageUrl && !/^https?:\/\//i.test(imageUrl) && !(imageUrl.startsWith('/') && !imageUrl.startsWith('//'))) || /^javascript:/i.test(imageUrl)) {
			return response.status(400).json({ message: 'Inserisci un URL immagine http(s) valido.' });
		}

		const [result] = await pool.query(
			'INSERT INTO prodotti (nome, descrizione, categoria, prezzo, immagine_url, disponibile) VALUES (?, ?, ?, ?, ?, ?)',
			[nome.trim(), descrizione, categoria, numericPrice, imageUrl, disponibile !== false]
		);

		response.status(201).json({ id: result.insertId, message: 'Prodotto creato.' });
	} catch (error) {
		response.status(500).json({ message: error.message });
	}
});

app.get('/api/personale', async (request, response) => {
	try {
		const [rows] = await pool.query(
			'SELECT id, nome, cognome, ruolo, email, telefono, attivo FROM personale ORDER BY id DESC'
		);
		response.json(rows);
	} catch (error) {
		response.status(500).json({ message: error.message });
	}
});

app.post('/api/personale', async (request, response) => {
	try {
		const { nome, cognome, ruolo, email = '', telefono = '', attivo = true } = request.body ?? {};

		if (!nome || !cognome || !ruolo) {
			return response.status(400).json({ message: 'Nome, cognome e ruolo sono obbligatori.' });
		}

		const [result] = await pool.query(
			'INSERT INTO personale (nome, cognome, ruolo, email, telefono, attivo) VALUES (?, ?, ?, ?, ?, ?)',
			[nome, cognome, ruolo, email, telefono, !!attivo]
		);

		response.status(201).json({ id: result.insertId, message: 'Personale creato.' });
	} catch (error) {
		response.status(500).json({ message: error.message });
	}
});

app.get('/api/ordini', async (request, response) => {
	try {
		const [rows] = await pool.query(`
			SELECT
				o.id,
				o.prodotto_id,
				o.personale_id,
				o.quantita,
				o.prezzo_unitario,
				o.metodo_pagamento,
				o.stato,
				o.note,
				o.creato_il,
				p.nome AS prodotto_nome,
				pe.nome AS personale_nome,
				pe.cognome AS personale_cognome
			FROM ordini o
			JOIN prodotti p ON p.id = o.prodotto_id
			LEFT JOIN personale pe ON pe.id = o.personale_id
			ORDER BY o.id DESC
		`);
		response.json(rows);
	} catch (error) {
		response.status(500).json({ message: error.message });
	}
});

app.post('/api/ordini', async (request, response) => {
	try {
		const { prodotto_id, personale_id = null, quantita = 1, stato = 'in_attesa', note = '' } = request.body ?? {};
		const productId = Number(prodotto_id);
		const staffId = personale_id ? Number(personale_id) : null;
		const quantity = Number(quantita);
		const validStates = ['in_attesa', 'in_preparazione', 'completato', 'annullato'];

		if (!Number.isInteger(productId) || productId < 1 || !Number.isInteger(quantity) || quantity < 1) {
			return response.status(400).json({ message: 'Prodotto e quantità devono essere validi.' });
		}
		if (staffId !== null && (!Number.isInteger(staffId) || staffId < 1)) {
			return response.status(400).json({ message: 'Il membro del personale non è valido.' });
		}
		if (!validStates.includes(stato)) {
			return response.status(400).json({ message: 'Stato ordine non valido.' });
		}
		if (staffId !== null) {
			const [staff] = await pool.query(
				'SELECT id FROM personale WHERE id = ? AND attivo = TRUE',
				[staffId]
			);
			if (!staff.length) {
				return response.status(400).json({ message: 'Il membro del personale non è attivo.' });
			}
		}

		const [products] = await pool.query(
			'SELECT prezzo FROM prodotti WHERE id = ? AND disponibile = TRUE',
			[productId]
		);
		if (!products.length) {
			return response.status(404).json({ message: 'Prodotto non trovato o non disponibile.' });
		}

		const [result] = await pool.query(
			'INSERT INTO ordini (prodotto_id, personale_id, quantita, prezzo_unitario, stato, note) VALUES (?, ?, ?, ?, ?, ?)',
			[productId, staffId, quantity, Number(products[0].prezzo), stato, note]
		);

		response.status(201).json({ id: result.insertId, message: 'Ordine creato.' });
	} catch (error) {
		response.status(500).json({ message: error.message });
	}
});

app.patch('/api/ordini/:id/stato', async (request, response) => {
	try {
		const orderId = Number(request.params.id);
		const { stato } = request.body ?? {};
		const validStates = ['in_attesa', 'in_preparazione', 'completato', 'annullato'];

		if (!Number.isInteger(orderId) || orderId < 1 || !validStates.includes(stato)) {
			return response.status(400).json({ message: 'Ordine o stato non valido.' });
		}

		const [orders] = await pool.query('SELECT id FROM ordini WHERE id = ?', [orderId]);
		if (!orders.length) {
			return response.status(404).json({ message: 'Ordine non trovato.' });
		}

		await pool.query('UPDATE ordini SET stato = ? WHERE id = ?', [stato, orderId]);
		response.json({ message: 'Stato ordine aggiornato.' });
	} catch (error) {
		response.status(500).json({ message: error.message });
	}
});

app.get('/api/stato-ordini', async (request, response) => {
	try {
		const [rows] = await pool.query(`
			SELECT o.id, p.nome AS prodotto, o.quantita, o.stato, o.creato_il
			FROM ordini o
			JOIN prodotti p ON p.id = o.prodotto_id
			WHERE o.stato <> 'annullato'
				AND o.creato_il >= CURDATE()
				AND o.creato_il < CURDATE() + INTERVAL 1 DAY
			ORDER BY o.creato_il DESC
		`);
		response.json(rows);
	} catch (error) {
		response.status(500).json({ message: error.message });
	}
});

app.use(['/admin.html', '/admin.js', '/ordini.html', '/ordini.js'], requireAdmin);

app.get('/', (request, response) => response.sendFile(path.join(__dirname, 'public', 'home.html')));
app.get('/index.html', (request, response) => response.redirect('/'));

app.use(express.static(path.join(__dirname, 'public')));

async function initializeDatabase() {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS prodotti (
			id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
			nome VARCHAR(120) NOT NULL,
			descrizione TEXT,
			immagine_url VARCHAR(2048),
			categoria VARCHAR(80),
			prezzo DECIMAL(10, 2) NOT NULL,
			disponibile BOOLEAN NOT NULL DEFAULT TRUE,
			creato_il TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			aggiornato_il TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			CONSTRAINT chk_prodotti_prezzo CHECK (prezzo >= 0)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
	`);

	await pool.query(`
		CREATE TABLE IF NOT EXISTS personale (
			id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
			nome VARCHAR(100) NOT NULL,
			cognome VARCHAR(100) NOT NULL,
			ruolo VARCHAR(80) NOT NULL,
			email VARCHAR(255) UNIQUE,
			telefono VARCHAR(30),
			attivo BOOLEAN NOT NULL DEFAULT TRUE,
			creato_il TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
	`);

	await pool.query(`
		CREATE TABLE IF NOT EXISTS ordini (
			id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
			prodotto_id INT UNSIGNED NOT NULL,
			personale_id INT UNSIGNED,
			quantita INT UNSIGNED NOT NULL DEFAULT 1,
			prezzo_unitario DECIMAL(10, 2) NOT NULL,
			metodo_pagamento ENUM('contanti', 'carta') NULL,
			stato ENUM('in_attesa', 'in_preparazione', 'completato', 'annullato') NOT NULL DEFAULT 'in_attesa',
			note VARCHAR(500),
			creato_il TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT chk_ordini_quantita CHECK (quantita > 0),
			CONSTRAINT chk_ordini_prezzo CHECK (prezzo_unitario >= 0),
			CONSTRAINT fk_ordini_prodotto FOREIGN KEY (prodotto_id)
				REFERENCES prodotti (id) ON DELETE RESTRICT,
			CONSTRAINT fk_ordini_personale FOREIGN KEY (personale_id)
				REFERENCES personale (id) ON DELETE SET NULL
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
	`);

	const [productImageColumn] = await pool.query("SHOW COLUMNS FROM prodotti LIKE 'immagine_url'");
	if (!productImageColumn.length) {
		await pool.query('ALTER TABLE prodotti ADD COLUMN immagine_url VARCHAR(2048) NULL AFTER descrizione');
	}
	const [paymentMethodColumn] = await pool.query("SHOW COLUMNS FROM ordini LIKE 'metodo_pagamento'");
	if (!paymentMethodColumn.length) {
		await pool.query("ALTER TABLE ordini ADD COLUMN metodo_pagamento ENUM('contanti', 'carta') NULL AFTER prezzo_unitario");
	}
}

async function startServer() {
	await initializeDatabase();

	const port = Number(process.env.PORT || 3000);
	const host = process.env.HOST || '0.0.0.0';

	return new Promise((resolve, reject) => {
		const server = app.listen(port, host, () => {
			console.log(`Gestione Baretto disponibile su http://localhost:${port}`);
			resolve(server);
		});

		server.once('error', reject);
	});
}

if (require.main === module) {
	startServer()
		.then((server) => {
			const shutdown = () => {
				server.close(() => {
					pool.end().catch((error) => {
						console.error('Errore durante la chiusura del database:', error.message);
					});
				});
			};

			process.once('SIGINT', shutdown);
			process.once('SIGTERM', shutdown);
		})
		.catch(async (error) => {
			console.error('Impossibile avviare il server:', error.message);
			await pool.end();
			process.exitCode = 1;
		});
}

module.exports = { app, pool, initializeDatabase, startServer };
