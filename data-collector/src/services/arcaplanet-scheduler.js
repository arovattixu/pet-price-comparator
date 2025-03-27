const db = require('./database');
const logger = require('../utils/logger');
const arcaplanetScraper = require('../scrapers/arcaplanet-scraper');
const scheduler = require('./scheduler'); // Importiamo l'intero modulo scheduler

// Lista delle categorie di Arcaplanet
const arcaplanetCategories = [
    'cane/cibo-secco', 
    'cane/cibo-umido',
    'gatto/cibo-secco',
    'gatto/cibo-umido',
    'piccoli-animali/rettili/accessori',
    'piccoli-animali/roditori/accessori'
    // Aggiungi altre categorie secondo necessità
];

/**
 * Estrae il nome completo del prodotto dallo slug URL
 * @param {string} slug - Lo slug del prodotto nell'URL
 * @param {string} brand - Il brand del prodotto
 * @returns {string} Nome completo del prodotto
 */
function extractProductNameFromSlug(slug, brand) {
    if (!slug) return brand || 'Prodotto sconosciuto';
    
    // Rimuovi il brand dallo slug se è già incluso all'inizio
    // (per evitare duplicazione nel nome finale)
    let cleanSlug = slug;
    if (brand && slug.toLowerCase().startsWith(brand.toLowerCase())) {
        cleanSlug = slug.substring(brand.length).trim();
    }
    
    // Rimuovi eventuali codici o ID numerici alla fine dello slug
    cleanSlug = cleanSlug.replace(/-\d+$/, '');
    
    // Sostituisci i trattini con spazi e capitalizza le parole
    const nameFromSlug = cleanSlug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
        .trim();
    
    // Se abbiamo un brand, combiniamo brand e nome
    return brand ? `${brand} ${nameFromSlug}` : nameFromSlug;
}

/**
 * Determina il tipo di animale basato sul percorso della categoria
 * @param {string} category - Percorso della categoria
 * @returns {string} Tipo di animale (cane, gatto, ecc.)
 */
function determinePetType(category) {
    if (!category) return 'altro';
    
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('cane')) return 'cane';
    if (categoryLower.includes('gatto')) return 'gatto';
    if (categoryLower.includes('pesce')) return 'pesce';
    if (categoryLower.includes('uccell')) return 'uccello';
    
    if (categoryLower.includes('piccoli-animali')) {
        if (categoryLower.includes('rettil')) return 'rettile';
        if (categoryLower.includes('rodit')) return 'roditore';
    }
    
    return 'altro';
}

/**
 * Processa i dati dei prodotti recuperati dall'API GraphQL di Arcaplanet
 * @param {Array} products - I prodotti ricevuti dall'API
 * @param {String} category - La categoria di appartenenza
 */
async function processArcaplanetProducts(products, category) {
    logger.info(`Elaborazione di ${products.length} prodotti dalla categoria ${category}`);
    
    // Prepariamo un array per i prodotti validati
    const processedProducts = [];
    
    // Raggruppiamo i prodotti per productGroupID
    const productGroups = {};
    
    // Fase 1: Raggruppiamo tutte le varianti
    for (const product of products) {
        // Verifichiamo che il prodotto contenga i dati necessari
        if (!product.id || !product.slug || !product.isVariantOf) {
            logger.warn('Prodotto privo di dati essenziali, saltato');
            continue;
        }
        
        const groupID = product.isVariantOf.productGroupID;
        const groupName = product.isVariantOf.name;
        const brand = product.brand ? product.brand.name : '';
        
        // Inizializziamo il gruppo se non esiste
        if (!productGroups[groupID]) {
            productGroups[groupID] = {
                name: groupName,
                brand: brand,
                variants: [],
                images: [],
                groupId: groupID
            };
        }
        
        // Aggiungiamo le immagini se non sono già presenti nel gruppo
        if (product.image && Array.isArray(product.image)) {
            product.image.forEach(img => {
                if (img.url && !productGroups[groupID].images.includes(img.url)) {
                    productGroups[groupID].images.push(img.url);
                }
            });
        }
        
        // Determinare il peso/dimensione del prodotto
        let variantInfo = product.name || '';
        
        // Cercare informazioni di peso nelle proprietà aggiuntive
        if (product.additionalProperty && Array.isArray(product.additionalProperty)) {
            const weightProp = product.additionalProperty.find(prop => 
                prop.name === 'Weight (G)' || prop.name.toLowerCase().includes('weight'));
            
            if (weightProp && weightProp.value) {
                variantInfo = weightProp.value;
            }
        }
        
        // Prezzo e disponibilità
        let price = null;
        let originalPrice = null;
        let available = false;
        
        if (product.offers && product.offers.offers && product.offers.offers.length > 0) {
            const offer = product.offers.offers[0];
            price = offer.price;
            originalPrice = offer.listPrice;
            available = offer.availability === 'https://schema.org/InStock';
        }
        
        // Aggiungiamo la variante al gruppo
        productGroups[groupID].variants.push({
            sku: product.sku,
            name: variantInfo,
            price: price,
            original: originalPrice,
            available: available,
            slug: product.slug
        });
    }
    
    // Fase 2: Convertiamo i gruppi in prodotti
    for (const [groupID, groupData] of Object.entries(productGroups)) {
        // Verifica che il gruppo abbia dati validi
        if (!groupData.name || groupData.name.length < 3) {
            logger.warn(`Gruppo ${groupID} con nome non valido (${groupData.name}), saltato`);
            continue;
        }
        
        if (!groupData.variants || groupData.variants.length === 0) {
            logger.warn(`Gruppo ${groupID} senza varianti, saltato`);
            continue;
        }
        
        // Determina il tipo di animale in base alla categoria
        const petType = determinePetType(category);
        
        // Estrai categoria formattata dal percorso
        const extractedCategory = category.replace('/', ' > ');
        
        // Creiamo il prodotto principale con le sue varianti
        const product = {
            name: groupData.name,
            sourceId: groupID,
            source: 'arcaplanet',
            category: extractedCategory,
            petType: petType,
            brand: groupData.brand,
            images: groupData.images,
            imageUrl: groupData.images.length > 0 ? groupData.images[0] : null,
            variants: groupData.variants.map(v => ({
                sku: v.sku,
                name: v.name,
                available: v.available,
                variantId: v.sku,
                slug: v.slug
            })),
            prices: groupData.variants
                .filter(v => v.price)
                .map(v => {
                    const url = `https://www.arcaplanet.it/${v.slug}/p`;
                    
                    return {
                        value: v.price,
                        originalValue: v.original,
                        date: new Date(),
                        source: 'arcaplanet',
                        available: v.available,
                        store: 'arcaplanet',
                        price: v.price,
                        currency: 'EUR',
                        url: url,
                        lastUpdated: new Date(),
                        inStock: v.available
                    };
                })
        };
        
        // Aggiungiamo il prodotto alla lista dei prodotti elaborati
        processedProducts.push(product);
    }
    
    // Salviamo i prodotti nel database
    if (processedProducts.length > 0) {
        try {
            await saveProducts(processedProducts);
            logger.info(`Salvati ${processedProducts.length} prodotti nel database`);
        } catch (error) {
            logger.error(`Errore durante il salvataggio dei prodotti: ${error.message}`);
            throw error;
        }
    }
    
    return processedProducts;
}

/**
 * Avvia lo scraping di tutte le categorie Arcaplanet
 */
async function startArcaplanetScraping() {
    logger.info('Avvio scraping Arcaplanet...');
    
    for (const category of arcaplanetCategories) {
        try {
            logger.info(`Scraping categoria Arcaplanet: ${category}`);
            const products = await arcaplanetScraper.fetchCategoryProducts(category);
            logger.info(`Trovati ${products.length} prodotti su Arcaplanet per la categoria ${category}`);
            
            // Processo e salvo i prodotti con la nuova funzione
            await processArcaplanetProducts(products, category);
        } catch (error) {
            logger.error(`Errore durante lo scraping di ${category} su Arcaplanet: ${error.message}`);
        }
    }
    
    logger.info('Scraping Arcaplanet completato');
}

module.exports = {
    startArcaplanetScraping,
    arcaplanetCategories,
    processArcaplanetProducts,
    saveProducts: scheduler.saveProducts // Esportiamo saveProducts come parte del modulo
}; 