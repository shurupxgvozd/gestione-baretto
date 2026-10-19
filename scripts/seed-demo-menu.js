'use strict';

const { pool } = require('../server');

const demoProducts = [
	{
		nome: 'Espresso',
		descrizione: 'Una miscela intensa, estratta al momento e servita con la crema giusta.',
		categoria: 'Caffetteria',
		prezzo: 1.5,
		immagine_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=82',
	},
	{
		nome: 'Cappuccino',
		descrizione: 'Espresso e latte montato, per iniziare la giornata con calma.',
		categoria: 'Caffetteria',
		prezzo: 2,
		immagine_url: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=900&q=82',
	},
	{
		nome: 'Cornetto alla crema',
		descrizione: 'Sfogliato e farcito alla crema, perfetto con il primo caffè.',
		categoria: 'Colazione',
		prezzo: 2.2,
		immagine_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=900&q=82',
	},
	{
		nome: 'Toast prosciutto e formaggio',
		descrizione: 'Pane tostato, prosciutto cotto e formaggio filante.',
		categoria: 'Panini',
		prezzo: 5.5,
		immagine_url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=82',
	},
	{
		nome: 'Panino rustico',
		descrizione: 'Pane morbido con una farcitura generosa, per una pausa sostanziosa.',
		categoria: 'Panini',
		prezzo: 6.5,
		immagine_url: 'https://images.unsplash.com/photo-1554433607-66b5efe9d304?auto=format&fit=crop&w=900&q=82',
	},
	{
		nome: 'Insalata mediterranea',
		descrizione: 'Un piatto fresco e colorato, ideale per una pausa leggera.',
		categoria: 'Piatti freddi',
		prezzo: 8.5,
		immagine_url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=82',
	},
	{
		nome: 'Cheesecake ai frutti rossi',
		descrizione: 'Una fetta cremosa con una nota fresca di frutti rossi.',
		categoria: 'Pasticceria',
		prezzo: 5,
		immagine_url: 'https://images.unsplash.com/photo-1524351199678-941a58a3df50?auto=format&fit=crop&w=900&q=82',
	},
	{
		nome: 'Aperitivo della casa',
		descrizione: 'Un cocktail da sorseggiare con calma durante la pausa aperitivo.',
		categoria: 'Aperitivo',
		prezzo: 7,
		immagine_url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=900&q=82',
	},
	{
		nome: 'Limonata',
		descrizione: 'Una bevanda fresca e agrumata per ogni momento della giornata.',
		categoria: 'Bevande',
		prezzo: 4,
		immagine_url: 'https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9e?auto=format&fit=crop&w=900&q=82',
	},
	{
		nome: 'Torta del giorno',
		descrizione: 'La proposta dolce del banco, da accompagnare con un caffè.',
		categoria: 'Pasticceria',
		prezzo: 4.5,
		immagine_url: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=900&q=82',
	},
];

async function seedDemoMenu() {
	let connection;
	try {
		connection = await pool.getConnection();
		await connection.beginTransaction();
		const [existingProducts] = await connection.query('SELECT id FROM prodotti FOR UPDATE');
		if (existingProducts.length) {
			await connection.rollback();
			console.log(`Catalogo già popolato (${existingProducts.length} prodotti): nessuna modifica.`);
			return;
		}

		for (const product of demoProducts) {
			await connection.query(
				'INSERT INTO prodotti (nome, descrizione, categoria, prezzo, immagine_url, disponibile) VALUES (?, ?, ?, ?, ?, TRUE)',
				[product.nome, product.descrizione, product.categoria, product.prezzo, product.immagine_url]
			);
		}
		await connection.commit();
		console.log(`Inseriti ${demoProducts.length} prodotti demo con immagini.`);
	} catch (error) {
		if (connection) await connection.rollback();
		console.error('Impossibile inserire il menu demo:', error.message);
		process.exitCode = 1;
	} finally {
		connection?.release();
		await pool.end();
	}
}

seedDemoMenu();