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
 * Processa i dati dei prodotti recuperati dall'API di Arcaplanet
 * e li salva nel database correttamente
 * @param {Array} products - I prodotti ricevuti dall'API
 * @param {String} category - La categoria di appartenenza
 */
async function processArcaplanetProducts(products, category) {
    logger.info(`Elaborazione di ${products.length} prodotti dalla categoria ${category}`);
    
    // Prepariamo un array per i prodotti validati
    const processedProducts = [];
    
    // Raggruppiamo i prodotti per nome base (ricavato dallo slug) e brand
    const productGroups = {};
    
    // Fase 1: Raggruppiamo tutte le varianti
    for (const product of products) {
        // Verifichiamo che il prodotto contenga i dati necessari
        if (!product.sourceId || !product.metadata || !product.metadata.slug) {
            logger.warn('Prodotto privo di identificativo o slug, saltato');
            continue;
        }
        
        // Estrai il nome completo del prodotto dallo slug
        const productSlug = product.metadata.slug;
        const brand = product.brand || '';
        
        // MODIFICA: Miglioramento dell'estrazione del nome completo del prodotto
        // Generiamo un ID gruppo basato sul nome completo del prodotto (senza peso/dimensione)
        let fullProductName = extractProductNameFromSlug(productSlug, brand);
        
        // MODIFICA: Miglioriamo l'identificazione delle varianti
        // Iniziamo estraendo informazioni sul peso/dimensione dalle varianti
        let variantInfo = '';
        
        // Tentiamo di estrarre informazioni sul peso o dimensione dal nome
        if (product.name) {
            // Regex per identificare informazioni sul peso/dimensione nel nome
            const weightRegex = /\b(\d+(\.\d+)?\s*(kg|gr|g|cm|mm|l|lt|ml))\b/i;
            const weightMatch = product.name.match(weightRegex);
            
            if (weightMatch) {
                variantInfo = weightMatch[0].trim();
                logger.info(`Estratta informazione variante '${variantInfo}' da '${product.name}'`);
            } else if (/^\d+(\.\d+)?(kg|gr|g|cm|mm|l|lt|ml)$/i.test(product.name)) {
                // Se il nome è solo un valore di peso/dimensione
                variantInfo = product.name.trim();
                logger.info(`Utilizzato nome prodotto '${variantInfo}' come informazione variante`);
            }
        }
        
        // Se non abbiamo trovato info sulla variante dal nome, usiamo lo SKU
        if (!variantInfo) {
            variantInfo = `SKU ${product.sourceId}`;
            logger.info(`Utilizzato SKU ${product.sourceId} come informazione variante`);
        }
        
        // MODIFICA: Miglioramento della generazione della chiave di gruppo
        // Il nome del prodotto può contenere già il brand, evitiamo duplicazioni
        // Rimuoviamo il brand dal nome completo se è già presente all'inizio
        if (fullProductName.toLowerCase().startsWith(brand.toLowerCase())) {
            fullProductName = fullProductName.substring(brand.length).trim();
        }
        
        // Generiamo un identificativo univoco per il gruppo
        const groupKey = `${brand}-${fullProductName}`.toLowerCase().replace(/\s+/g, '-');
        
        // Inizializziamo il gruppo se non esiste
        if (!productGroups[groupKey]) {
            productGroups[groupKey] = {
                name: brand ? `${brand} ${fullProductName}` : fullProductName,
                variants: [],
                images: [],
                brand: brand,
                groupId: groupKey
            };
        }
        
        // Estrai l'URL dell'immagine dal prodotto o dai suoi campi
        let imageUrl = '';
        
        // Verifica se il prodotto ha l'immagine nel formato VTEX
        if (product.node && product.node.image && product.node.image.length > 0) {
            // Format Arcaplanet VTEX
            imageUrl = product.node.image[0].url;
        } else if (product.imageUrl && product.imageUrl !== "") {
            // Formato semplice già estratto
            imageUrl = product.imageUrl;
        } else if (product.url) {
            // Tenta di generare un URL basato sul formato VTEX
            // Come fallback, genera un URL basato sul productId o sourceId
            const productId = product.sourceId || '';
            const productName = productSlug.replace(/-\d+$/, '');
            
            imageUrl = `https://arcaplanet.vtexassets.com/arquivos/ids/${productId}/${productName}.jpg`;
            logger.info(`Generato URL immagine VTEX per ${groupKey}: ${imageUrl}`);
        }
        
        // Se ancora non abbiamo un'immagine, usa un'immagine segnaposto
        if (!imageUrl) {
            imageUrl = "https://arcaplanet.vtexassets.com/assets/vtics/assets/images/placeholder.jpg";
            logger.info(`Utilizzata immagine segnaposto per ${groupKey}`);
        }
        
        // Aggiungiamo l'immagine se non è già presente nel gruppo
        if (imageUrl && !productGroups[groupKey].images.includes(imageUrl)) {
            productGroups[groupKey].images.push(imageUrl);
        }
        
        // Aggiungiamo la variante al gruppo
        productGroups[groupKey].variants.push({
            sku: product.sourceId,
            name: variantInfo,
            price: product.price?.current,
            original: product.price?.original,
            available: product.stockStatus === 'IN_STOCK',
            slug: productSlug
        });
    }
    
    // Fase 2: Convertiamo i gruppi in prodotti
    for (const [groupKey, groupData] of Object.entries(productGroups)) {
        // Verifica che il gruppo abbia dati validi
        if (!groupData.name || groupData.name.length < 5) {
            logger.warn(`Gruppo ${groupKey} con nome non valido (${groupData.name}), saltato`);
            continue;
        }
        
        if (!groupData.variants || groupData.variants.length === 0) {
            logger.warn(`Gruppo ${groupKey} senza varianti, saltato`);
            continue;
        }
        
        // Non controlliamo più se mancano le immagini, perché ora garantiamo che ci sia almeno un'immagine
        
        // Determina il tipo di animale in base alla categoria
        const petType = determinePetType(category);
        
        // Estrai categoria formattata dal percorso
        const extractedCategory = category.replace('/', ' > ');
        
        // Creiamo il prodotto principale con le sue varianti
        const product = {
            name: groupData.name,
            sourceId: groupData.groupId,
            source: 'arcaplanet',
            category: extractedCategory,
            petType: petType,
            brand: groupData.brand,
            images: groupData.images,
            imageUrl: groupData.images[0], // Usiamo la prima immagine come principale
            variants: groupData.variants.map(v => ({
                sku: v.sku,
                name: v.name,
                available: v.available,
                variantId: v.sku, // Uso lo SKU come variantId
                slug: v.slug // MODIFICA: Includo lo slug della variante
            })),
            prices: groupData.variants
                .filter(v => v.price)
                .map(v => {
                    // MODIFICA: Utilizziamo direttamente lo slug originale di ogni variante per generare l'URL
                    // Invece di tentare di ricostruirlo dai nomi
                    
                    let url;
                    
                    // Se abbiamo uno slug memorizzato per questa variante, usiamo quello
                    if (v.slug) {
                        // Lo slug è già pronto per la costruzione dell'URL
                        url = `https://www.arcaplanet.it/${v.slug}/p`;
                        logger.info(`Utilizzato slug originale per URL variante ${v.name} (SKU: ${v.sku}): ${url}`);
                    } else {
                        // Fallback alla costruzione dell'URL tramite nome pulito e SKU
                        const cleanName = groupData.name.toLowerCase()
                            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Rimuove accenti
                            .replace(/[^a-z0-9]+/g, '-') // Sostituisce caratteri non alfanumerici con trattini
                            .replace(/-+/g, '-') // Rimuove trattini multipli
                            .replace(/^-|-$/g, ''); // Rimuove trattini iniziali e finali
                        
                        url = `https://www.arcaplanet.it/${cleanName}-${v.sku}/p`;
                        logger.info(`Generato URL per variante ${v.name} (SKU: ${v.sku}): ${url}`);
                    }

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
        
        // Aggiungiamo al prodotto alla lista dei prodotti elaborati
        processedProducts.push(product);
    }
    
    // Log di riepilogo
    logger.info(`Preparati ${processedProducts.length} prodotti validi su ${products.length} totali della categoria ${category}`);
    
    // Salviamo i prodotti nel database
    if (processedProducts.length > 0) {
        await scheduler.saveProducts(processedProducts, 'arcaplanet');
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