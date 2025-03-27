/**
 * Price Normalization Utility
 * Handles unit price calculations and product weight parsing
 */
const logger = require('./logger');

/**
 * Extract weight value and unit from a weight string
 * @param {string} weightStr - Weight string (e.g. "2kg", "400g", "1.5 kg")
 * @returns {Object|null} - { value: number, unit: string } or null if parsing fails
 */
const extractWeight = (weightStr) => {
  try {
    if (!weightStr || typeof weightStr !== 'string') return null;
    
    // Normalize string (remove extra spaces, convert to lowercase)
    const normalized = weightStr.toLowerCase().trim().replace(/\s+/g, '');
    
    // Common patterns for weight
    const patterns = [
      // Match "2kg", "400g", etc.
      /^([\d.]+)(kg|g|lb|oz|ml|l)$/,
      // Match numbers with spaces "2 kg", "400 g", etc.
      /^([\d.]+)\s*(kg|g|lb|oz|ml|l)$/,
      // Match "2KG", "400G" (uppercase)
      /^([\d.]+)(KG|G|LB|OZ|ML|L)$/,
      // Match patterns like "2 x 100g"
      /^([\d.]+)\s*x\s*([\d.]+)(kg|g|lb|oz|ml|l)$/
    ];
    
    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        // Handle "2 x 100g" pattern
        if (match.length === 4 && match[2]) {
          const value = parseFloat(match[1]) * parseFloat(match[2]);
          if (isNaN(value)) {
            logger.warn(`Failed to parse numeric value in weight string: "${weightStr}"`);
            return null;
          }
          
          return {
            value,
            unit: match[3]
          };
        }
        
        const value = parseFloat(match[1]);
        if (isNaN(value)) {
          logger.warn(`Failed to parse numeric value in weight string: "${weightStr}"`);
          return null;
        }
        
        return {
          value,
          unit: match[2]
        };
      }
    }
    
    // Try to extract just numbers and assume grams
    const numberMatch = normalized.match(/(\d+)/);
    if (numberMatch) {
      const value = parseFloat(numberMatch[1]);
      if (isNaN(value)) {
        logger.warn(`Failed to parse numeric value in weight string: "${weightStr}"`);
        return null;
      }
      
      return {
        value,
        unit: 'g' // Assume grams if no unit specified
      };
    }
    
    return null;
  } catch (error) {
    logger.error(`Error extracting weight from string "${weightStr}": ${error.message}`);
    return null;
  }
};

/**
 * Convert weight to standard unit (grams)
 * @param {Object} weight - Weight object { value: number, unit: string }
 * @returns {number|null} - Weight in grams or null if conversion fails
 */
const convertToStandardUnit = (weight) => {
  try {
    if (!weight || !weight.value || !weight.unit) return null;
    
    const { value, unit } = weight;
    
    // Ensure value is a number
    if (isNaN(value)) {
      logger.warn(`Invalid weight value: ${value}`);
      return null;
    }
    
    switch (unit.toLowerCase()) {
      case 'kg':
        return value * 1000;
      case 'g':
        return value;
      case 'lb':
        return value * 453.592;
      case 'oz':
        return value * 28.3495;
      case 'l':
        return value * 1000; // Assuming 1L = 1kg for pet food (approximate)
      case 'ml':
        return value; // Assuming 1ml = 1g for pet food (approximate)
      default:
        logger.warn(`Unknown weight unit: ${unit}`);
        return value;
    }
  } catch (error) {
    logger.error(`Error converting weight to standard unit: ${error.message}`);
    return null;
  }
};

/**
 * Calculate price per unit (price per kg)
 * @param {number} price - Product price
 * @param {string} weightStr - Weight string
 * @returns {number|null} - Price per kg or null if couldn't calculate
 */
const calculatePricePerKg = (price, weightStr) => {
  try {
    if (!price || isNaN(parseFloat(price))) {
      logger.debug(`Invalid price value: ${price}`);
      return null;
    }
    
    if (!weightStr) {
      logger.debug(`Missing weight string for price calculation`);
      return null;
    }
    
    const weight = extractWeight(weightStr);
    if (!weight) {
      logger.debug(`Failed to extract weight from "${weightStr}"`);
      return null;
    }
    
    const grams = convertToStandardUnit(weight);
    if (!grams || grams <= 0) {
      logger.debug(`Invalid gram conversion for "${weightStr}": ${grams}`);
      return null;
    }
    
    // Convert to price per kg
    return (parseFloat(price) / grams) * 1000;
  } catch (error) {
    logger.error(`Error calculating price per kg: ${error.message}`);
    return null;
  }
};

/**
 * Determine if two products have the same base product but different sizes
 * @param {Object} product1 - First product
 * @param {Object} product2 - Second product
 * @returns {boolean} - Whether they are the same product with different sizes
 */
const areSameProductDifferentSizes = (product1, product2) => {
  try {
    if (!product1 || !product2) return false;
    
    // If either product doesn't have a name or brand, can't compare properly
    if (!product1.name || !product2.name) return false;
    if (!product1.brand || !product2.brand) return false;
    
    // If different brands, definitely different products
    if (product1.brand !== product2.brand) return false;
    
    // Clean names by removing weight/size mentions
    const cleanName1 = product1.name.replace(/\d+\s*(g|kg|ml|l|lb|oz)(\s|$)/gi, '').trim();
    const cleanName2 = product2.name.replace(/\d+\s*(g|kg|ml|l|lb|oz)(\s|$)/gi, '').trim();
    
    // If clean names match exactly, likely same product
    if (cleanName1 === cleanName2) return true;
    
    // Calculate similarity (simple approach)
    const nameWords1 = new Set(cleanName1.toLowerCase().split(/\s+/));
    const nameWords2 = new Set(cleanName2.toLowerCase().split(/\s+/));
    
    // Count common words
    let commonWords = 0;
    for (const word of nameWords1) {
      if (nameWords2.has(word)) commonWords++;
    }
    
    // Calculate Jaccard similarity
    const union = nameWords1.size + nameWords2.size - commonWords;
    if (union === 0) return false; // Prevent division by zero
    
    const similarity = commonWords / union;
    
    // If very similar names, likely same product different sizes
    return similarity > 0.8;
  } catch (error) {
    logger.error(`Error comparing products: ${error.message}`);
    return false;
  }
};

/**
 * Group products by base product (ignoring size/weight variations)
 * @param {Array} products - List of products
 * @returns {Array} - Grouped products by base product
 */
const groupProductsByBaseProduct = (products) => {
  try {
    if (!products || !Array.isArray(products) || products.length === 0) {
      return [];
    }
    
    const groupedProducts = [];
    const processedIds = new Set();
    
    for (let i = 0; i < products.length; i++) {
      const currentProduct = products[i];
      
      // Skip if already processed or invalid product
      if (!currentProduct || !currentProduct._id || processedIds.has(currentProduct._id.toString())) {
        continue;
      }
      
      const similarProducts = [currentProduct];
      processedIds.add(currentProduct._id.toString());
      
      // Find similar products
      for (let j = 0; j < products.length; j++) {
        const compareProduct = products[j];
        
        // Skip if same product, already processed, or invalid product
        if (i === j || !compareProduct || !compareProduct._id || 
            processedIds.has(compareProduct._id.toString())) {
          continue;
        }
        
        if (areSameProductDifferentSizes(currentProduct, compareProduct)) {
          similarProducts.push(compareProduct);
          processedIds.add(compareProduct._id.toString());
        }
      }
      
      // Add unit prices
      const productsWithUnitPrices = similarProducts.map(product => {
        let weightStr = '';
        
        // Try to extract weight from details.weight or from the product name
        if (product.details && product.details.weight) {
          weightStr = product.details.weight;
        } else {
          // Try to extract from name
          const weightMatch = product.name.match(/(\d+[\d.]*\s*(g|kg|ml|l|lb|oz))/i);
          if (weightMatch) weightStr = weightMatch[0];
        }
        
        const pricePerKg = calculatePricePerKg(product.price, weightStr);
        
        return {
          ...product.toObject ? product.toObject() : product,
          unitPrice: {
            value: pricePerKg,
            unit: 'EUR/kg',
            formattedValue: pricePerKg ? `${pricePerKg.toFixed(2)} €/kg` : null
          },
          extractedWeight: weightStr
        };
      });
      
      // Sort by unit price (products with null unit price go last)
      const sortedProducts = productsWithUnitPrices.sort((a, b) => {
        if (!a.unitPrice || !a.unitPrice.value) return 1;
        if (!b.unitPrice || !b.unitPrice.value) return -1;
        return a.unitPrice.value - b.unitPrice.value;
      });
      
      // Only add if there are products with valid unit prices
      const validProducts = sortedProducts.filter(p => p.unitPrice && p.unitPrice.value);
      if (validProducts.length > 0) {
        groupedProducts.push({
          baseProduct: currentProduct.name.replace(/\d+\s*(g|kg|ml|l|lb|oz)(\s|$)/gi, '').trim(),
          brand: currentProduct.brand,
          variants: sortedProducts,
          bestValue: validProducts[0], // First product after sorting by unit price
          priceRange: {
            min: Math.min(...sortedProducts.map(p => p.price)),
            max: Math.max(...sortedProducts.map(p => p.price)),
          },
          unitPriceRange: {
            min: Math.min(...validProducts.map(p => p.unitPrice.value)),
            max: Math.max(...validProducts.map(p => p.unitPrice.value)),
          }
        });
      }
    }
    
    return groupedProducts;
  } catch (error) {
    logger.error(`Error grouping products: ${error.message}`);
    return [];
  }
};

module.exports = {
  extractWeight,
  convertToStandardUnit,
  calculatePricePerKg,
  areSameProductDifferentSizes,
  groupProductsByBaseProduct
}; 