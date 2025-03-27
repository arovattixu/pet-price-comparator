require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./src/models/product');

async function checkDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connesso a MongoDB');
    
    // Conteggio totale prodotti
    const totalProducts = await Product.countDocuments();
    console.log(`Numero totale di prodotti: ${totalProducts}`);
    
    // Prodotti con campi mancanti
    const missingFields = await Product.countDocuments({
      $or: [
        { source: { $exists: false } },
        { sourceId: { $exists: false } },
        { name: { $exists: false } }
      ]
    });
    console.log(`Prodotti con campi mancanti: ${missingFields}`);
    
    // Prodotti per fonte
    const arcaplanetProducts = await Product.countDocuments({ source: 'arcaplanet' });
    const zooplusProducts = await Product.countDocuments({ source: 'zooplus' });
    console.log(`Prodotti Arcaplanet: ${arcaplanetProducts}`);
    console.log(`Prodotti Zooplus: ${zooplusProducts}`);
    
    // Ultimi 5 prodotti aggiunti
    const latestProducts = await Product.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
      
    console.log('Ultimi 5 prodotti aggiunti:');
    latestProducts.forEach((product, i) => {
      console.log(`\n[${i+1}] ${product.name} (${product.source} - ${product.sourceId})`);
      console.log(`  - Brand: ${product.brand || 'N/A'}`);
      console.log(`  - Prezzi: ${product.prices && product.prices.length > 0 ? 
                   product.prices.map(p => `${p.price}€ (${p.store})`).join(', ') : 
                   'Nessun prezzo'}`);
      console.log(`  - Creato: ${product.createdAt}`);
    });
    
    // Verifica prodotti senza prezzi
    const noPrice = await Product.countDocuments({
      $or: [
        { prices: { $exists: false } },
        { prices: { $size: 0 } }
      ]
    });
    console.log(`\nProdotti senza prezzi: ${noPrice}`);
    
    // Dettagli sul prodotto problematico
    if (missingFields > 0) {
      const problemProducts = await Product.find({
        $or: [
          { source: { $exists: false } },
          { sourceId: { $exists: false } },
          { name: { $exists: false } }
        ]
      }).limit(3).lean();
      
      console.log('\nDettagli sui prodotti con campi mancanti:');
      problemProducts.forEach((p, i) => {
        console.log(`\n[${i+1}] ID: ${p._id}`);
        console.log(`  - source: ${p.source || 'MANCANTE'}`);
        console.log(`  - sourceId: ${p.sourceId || 'MANCANTE'}`);
        console.log(`  - name: ${p.name || 'MANCANTE'}`);
      });
    }
    
  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Connessione chiusa');
  }
}

checkDatabase(); 