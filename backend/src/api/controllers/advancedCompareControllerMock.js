/**
 * Advanced Compare Controller MOCK
 * Versione di test del controller che usa dati di esempio invece del database
 */
const logger = require('../../utils/logger');
const priceNormalizer = require('../../utils/priceNormalizer');

// Dati di esempio per i test
const mockProducts = [
  {
    _id: '1',
    name: 'Royal Canin Adult Medium 15kg',
    brand: 'Royal Canin',
    price: 59.99,
    currency: 'EUR',
    source: 'zooplus',
    imageUrl: 'https://example.com/img1.jpg',
    details: { weight: '15kg' },
    category: 'Cibo Secco'
  },
  {
    _id: '2',
    name: 'Royal Canin Adult Medium 4kg',
    brand: 'Royal Canin',
    price: 24.99,
    currency: 'EUR',
    source: 'arcaplanet',
    imageUrl: 'https://example.com/img2.jpg',
    details: { weight: '4kg' },
    category: 'Cibo Secco'
  },
  {
    _id: '3',
    name: 'Royal Canin Medium Adult 10kg',
    brand: 'Royal Canin',
    price: 49.99,
    currency: 'EUR',
    source: 'zooplus',
    imageUrl: 'https://example.com/img3.jpg',
    details: { weight: '10kg' },
    category: 'Cibo Secco'
  },
  {
    _id: '4',
    name: 'Hill\'s Science Plan Medium Adult 12kg',
    brand: 'Hill\'s',
    price: 54.99,
    currency: 'EUR',
    source: 'arcaplanet',
    imageUrl: 'https://example.com/img4.jpg',
    details: { weight: '12kg' },
    category: 'Cibo Secco'
  },
  {
    _id: '5',
    name: 'Royal Canin Maxi Adult 14kg',
    brand: 'Royal Canin',
    price: 58.99,
    currency: 'EUR',
    source: 'zooplus',
    imageUrl: 'https://example.com/img5.jpg',
    details: { weight: '14kg' },
    category: 'Cibo Secco'
  },
  {
    _id: '6',
    name: 'Monge Cane Adult Medium 3kg',
    brand: 'Monge',
    price: 19.99,
    currency: 'EUR',
    source: 'arcaplanet',
    imageUrl: 'https://example.com/img6.jpg',
    details: { weight: '3kg' },
    category: 'Cibo Secco'
  },
  {
    _id: '7',
    name: 'Monge Cane Adult Medium 12kg',
    brand: 'Monge',
    price: 48.99,
    currency: 'EUR',
    source: 'zooplus',
    imageUrl: 'https://example.com/img7.jpg',
    details: { weight: '12kg' },
    category: 'Cibo Secco'
  },
  {
    _id: '8',
    name: 'Crocchette Gatto Acana 4.5kg',
    brand: 'Acana',
    price: 36.99,
    currency: 'EUR',
    source: 'arcaplanet',
    imageUrl: 'https://example.com/img8.jpg',
    details: { weight: '4.5kg' },
    category: 'Cibo Secco Gatto'
  },
  {
    _id: '9',
    name: 'Crocchette Gatto Acana 1.8kg',
    brand: 'Acana',
    price: 19.99,
    currency: 'EUR',
    source: 'zooplus',
    imageUrl: 'https://example.com/img9.jpg',
    details: { weight: '1.8kg' },
    category: 'Cibo Secco Gatto'
  },
  {
    _id: '10',
    name: 'Felix Gatto Manzo 24x100g',
    brand: 'Felix',
    price: 12.99,
    currency: 'EUR',
    source: 'arcaplanet',
    imageUrl: 'https://example.com/img10.jpg',
    details: { weight: '24 x 100g' },
    category: 'Cibo Umido Gatto'
  }
];

/**
 * Compare products with unit price calculations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const compareWithUnitPrices = async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Find requested product
    const product = mockProducts.find(p => p._id === productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Prodotto non trovato'
      });
    }
    
    // Find similar products (same brand and category)
    const similarProducts = mockProducts.filter(p => 
      p._id !== productId && 
      p.brand === product.brand && 
      p.category === product.category
    );
    
    // Add the current product to the list
    const allProducts = [product, ...similarProducts];
    
    // Calculate unit prices for all products
    const productsWithUnitPrices = allProducts.map(p => {
      const weightStr = p.details?.weight || '';
      const pricePerKg = priceNormalizer.calculatePricePerKg(p.price, weightStr);
      
      return {
        _id: p._id,
        name: p.name,
        brand: p.brand,
        price: p.price,
        currency: p.currency,
        source: p.source,
        imageUrl: p.imageUrl,
        weight: weightStr,
        unitPrice: pricePerKg ? {
          value: pricePerKg,
          unit: 'EUR/kg',
          formattedValue: `${pricePerKg.toFixed(2)} €/kg`
        } : null
      };
    });
    
    // Group products by base product (ignoring size variations)
    const groupedProducts = priceNormalizer.groupProductsByBaseProduct(productsWithUnitPrices);
    
    return res.status(200).json({
      success: true,
      data: {
        originalProduct: {
          _id: product._id,
          name: product.name,
          price: product.price,
          weight: product.details?.weight || ''
        },
        groupedProducts,
        totalGroups: groupedProducts.length,
        totalProducts: productsWithUnitPrices.length
      }
    });
  } catch (error) {
    logger.error(`Error in compareWithUnitPrices: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il confronto dei prodotti'
    });
  }
};

/**
 * Find the best value products in each product group
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const findBestValueByBrand = async (req, res) => {
  try {
    const { brand, category } = req.params;
    const { limit = 10 } = req.query;
    
    // Find products matching the criteria
    const products = mockProducts.filter(p => 
      p.brand === brand && 
      (!category || p.category === category)
    );
    
    if (products.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          brand,
          category: category || 'All',
          products: []
        }
      });
    }
    
    // Calculate unit prices and group products
    const productsWithUnitPrices = products.map(p => {
      const weightStr = p.details?.weight || '';
      const pricePerKg = priceNormalizer.calculatePricePerKg(p.price, weightStr);
      
      return {
        _id: p._id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        price: p.price,
        source: p.source,
        imageUrl: p.imageUrl,
        weight: weightStr,
        unitPrice: pricePerKg ? {
          value: pricePerKg,
          unit: 'EUR/kg',
          formattedValue: `${pricePerKg.toFixed(2)} €/kg`
        } : null
      };
    });
    
    // Group products
    const groupedProducts = priceNormalizer.groupProductsByBaseProduct(productsWithUnitPrices);
    
    // Extract best value product from each group
    const bestValueProducts = groupedProducts
      .filter(group => group.bestValue && group.bestValue.unitPrice && group.bestValue.unitPrice.value)
      .map(group => ({
        baseProduct: group.baseProduct,
        bestValue: group.bestValue,
        priceRange: group.priceRange,
        unitPriceRange: group.unitPriceRange,
        variantCount: group.variants.length
      }))
      .sort((a, b) => a.bestValue.unitPrice.value - b.bestValue.unitPrice.value)
      .slice(0, parseInt(limit));
    
    return res.status(200).json({
      success: true,
      data: {
        brand,
        category: category || 'All',
        groupCount: groupedProducts.length,
        bestValueProducts
      }
    });
  } catch (error) {
    logger.error(`Error in findBestValueByBrand: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante la ricerca dei prodotti con miglior rapporto qualità-prezzo'
    });
  }
};

/**
 * Compare products across different sizes and find the best value
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const compareSizes = async (req, res) => {
  try {
    const { namePattern } = req.query;
    
    if (!namePattern || namePattern.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'È necessario fornire un pattern di nome prodotto di almeno 3 caratteri'
      });
    }
    
    // Find products with similar names (simple case-insensitive search)
    const products = mockProducts.filter(p => 
      p.name.toLowerCase().includes(namePattern.toLowerCase())
    );
    
    if (products.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          namePattern,
          products: []
        }
      });
    }
    
    // Calculate unit prices for all products
    const productsWithUnitPrices = products.map(p => {
      const weightStr = p.details?.weight || '';
      const pricePerKg = priceNormalizer.calculatePricePerKg(p.price, weightStr);
      
      // Extract weight from product name if not found in details
      let extractedWeight = '';
      if (!weightStr) {
        const weightMatch = p.name.match(/(\d+[\d.]*\s*(g|kg|ml|l|lb|oz))/i);
        if (weightMatch) extractedWeight = weightMatch[0];
      }
      
      return {
        _id: p._id,
        name: p.name,
        brand: p.brand,
        price: p.price,
        currency: p.currency,
        source: p.source,
        imageUrl: p.imageUrl,
        weight: weightStr || extractedWeight,
        unitPrice: pricePerKg ? {
          value: pricePerKg,
          unit: 'EUR/kg',
          formattedValue: `${pricePerKg.toFixed(2)} €/kg`
        } : null
      };
    });
    
    // Group by brand to organize the results
    const productsByBrand = {};
    productsWithUnitPrices.forEach(p => {
      if (!p.brand) return;
      
      if (!productsByBrand[p.brand]) {
        productsByBrand[p.brand] = [];
      }
      productsByBrand[p.brand].push(p);
    });
    
    // For each brand, identify the best value
    const result = Object.entries(productsByBrand).map(([brand, products]) => {
      // Sort by unit price
      const sortedProducts = [...products]
        .filter(p => p.unitPrice && p.unitPrice.value)
        .sort((a, b) => a.unitPrice.value - b.unitPrice.value);
      
      const bestValue = sortedProducts.length > 0 ? sortedProducts[0] : null;
      
      return {
        brand,
        products: sortedProducts,
        bestValue,
        productCount: products.length,
        priceRange: {
          min: Math.min(...products.map(p => p.price)),
          max: Math.max(...products.map(p => p.price))
        },
        unitPriceRange: sortedProducts.length > 0 ? {
          min: Math.min(...sortedProducts.map(p => p.unitPrice.value)),
          max: Math.max(...sortedProducts.map(p => p.unitPrice.value))
        } : null
      };
    });
    
    return res.status(200).json({
      success: true,
      data: {
        namePattern,
        brandCount: result.length,
        productCount: productsWithUnitPrices.length,
        brandComparison: result
      }
    });
  } catch (error) {
    logger.error(`Error in compareSizes: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il confronto delle dimensioni dei prodotti'
    });
  }
};

/**
 * Update unit prices for all products (mock version just returns success)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateAllUnitPrices = async (req, res) => {
  try {
    // This is just a mock version for testing
    return res.status(200).json({
      success: true,
      data: {
        totalProcessed: mockProducts.length,
        updated: mockProducts.length,
        failed: 0,
        errors: []
      }
    });
  } catch (error) {
    logger.error(`Error in updateAllUnitPrices: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante l\'aggiornamento dei prezzi unitari'
    });
  }
};

module.exports = {
  compareWithUnitPrices,
  findBestValueByBrand,
  compareSizes,
  updateAllUnitPrices
}; 