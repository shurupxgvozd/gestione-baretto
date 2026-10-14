'use strict';

const fs = require('node:fs');
const path = require('node:path');
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

app.get('/api/health', async (request, response) => {
	try {
		await pool.query('SELECT 1');
		response.json({ status: 'ok', database: 'connected' });
	} catch {
		response.status(503).json({ status: 'error', database: 'disconnected' });
	}
});

app.get('/api/prodotti', async (request, response) => {
	try {
		const [rows] = await pool.query(
			'SELECT id, nome, descrizione, categoria, prezzo, disponibile FROM prodotti ORDER BY id DESC'
		);
		response.json(rows);
	} catch (error) {
		response.status(500).json({ message: error.message });
	}
});

app.post('/api/prodotti', async (request, response) => {
	try {
		const { nome, descrizione = '', categoria = '', prezzo, disponibile = true } = request.body ?? {};

		if (!nome || !prezzo) {
			return response.status(400).json({ message: 'Nome e prezzo sono obbligatori.' });
		}

		const [result] = await pool.query(
			'INSERT INTO prodotti (nome, descrizione, categoria, prezzo, disponibile) VALUES (?, ?, ?, ?, ?)',
			[nome, descrizione, categoria, Number(prezzo), !!disponibile]
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
		const { prodotto_id, personale_id = null, quantita = 1, prezzo_unitario, stato = 'in_attesa', note = '' } = request.body ?? {};

		if (!prodotto_id || !prezzo_unitario || !quantita) {
			return response.status(400).json({ message: 'Prodotto, quantità e prezzo unitario sono obbligatori.' });
		}

		const [result] = await pool.query(
			'INSERT INTO ordini (prodotto_id, personale_id, quantita, prezzo_unitario, stato, note) VALUES (?, ?, ?, ?, ?, ?)',
			[Number(prodotto_id), personale_id ? Number(personale_id) : null, Number(quantita), Number(prezzo_unitario), stato, note]
		);

		response.status(201).json({ id: result.insertId, message: 'Ordine creato.' });
	} catch (error) {
		response.status(500).json({ message: error.message });
	}
});

app.use(express.static(path.join(__dirname, 'public')));

async function initializeDatabase() {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS prodotti (
			id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
			nome VARCHAR(120) NOT NULL,
			descrizione TEXT,
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
}

async function startServer() {
	await initializeDatabase();

	const port = Number(process.env.PORT || 3000);
	const host = process.env.HOST || '0.0.0.0';

	return new Promise((resolve, reject) => {
		const server = app.listen(port, host, () => {
			console.log(`Server Express in ascolto sulla porta ${port}.`);
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
