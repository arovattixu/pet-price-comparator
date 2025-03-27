/**
 * API client for connecting to backend services
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

// Default options for fetch calls
const defaultOptions: RequestInit = {
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * Create a full URL for API endpoints
 */
function createUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}

/**
 * Basic fetch wrapper with error handling
 */
async function fetchApi<T>(
  endpoint: string, 
  options?: RequestInit
): Promise<T> {
  const url = createUrl(endpoint);
  
  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      ...defaultOptions,
      ...options,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error?.message || 
        `API error: ${response.status} ${response.statusText}`
      );
    }
    
    return await response.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`Request timeout for ${endpoint}`);
      throw new Error('Request timed out. Please try again later.');
    }
    
    if (!navigator.onLine) {
      throw new Error('You are offline. Please check your internet connection.');
    }
    
    console.error(`API request failed for ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Product API
 */
export const productApi = {
  /**
   * Search products with filters
   */
  search: async (params: {
    query?: string;
    category?: string;
    brand?: string;
    petType?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
  }) => {
    const searchParams = new URLSearchParams();
    
    // Se c'è una query di ricerca testuale, usa l'endpoint di ricerca dedicato
    if (params.query && params.query.trim().length >= 3) {
      searchParams.append('q', params.query);
      
      // Aggiungi altri filtri alla ricerca
      if (params.category) searchParams.append('category', params.category);
      if (params.petType) searchParams.append('petType', params.petType);
      if (params.limit) searchParams.append('limit', params.limit.toString());
      
      console.log("API search request:", `/products/search?${searchParams.toString()}`);
      return fetchApi<any>(`/products/search?${searchParams.toString()}`);
    }
    // Altrimenti usa l'endpoint standard per il filtro
    else {
      if (params.category) searchParams.append('category', params.category);
      if (params.brand) searchParams.append('brand', params.brand);
      if (params.petType) searchParams.append('petType', params.petType);
      if (params.page) searchParams.append('page', params.page.toString());
      if (params.limit) searchParams.append('limit', params.limit.toString());
      if (params.sortBy) searchParams.append('sort', params.sortBy);
      
      console.log("API filter request:", `/products?${searchParams.toString()}`);
      return fetchApi<any>(`/products?${searchParams.toString()}`);
    }
  },
  
  /**
   * Get product by ID
   */
  getById: async (id: string) => {
    return fetchApi<any>(`/products/${id}`);
  },
  
  /**
   * Get product price history
   */
  getPriceHistory: async (productId: string, period = '30days') => {
    return fetchApi<any>(`/products/${productId}/price-history?period=${period}`);
  },
  
  /**
   * Get similar products
   */
  getSimilar: async (
    params: { 
      productId?: string; 
      brand?: string; 
      name?: string;
      limit?: number;
      minSimilarity?: number;
    }
  ) => {
    try {
      // Check if we have at least one required parameter
      if (!params.productId && !params.brand && !params.name) {
        console.error("Missing required parameter for getSimilar: productId, brand, or name");
        return { data: { similarProducts: [] } };
      }
      
      // Se non trova nulla, facciamo una ricerca più generica per ottenere risultati
      // che l'utente può comunque esplorare
      const searchParams = new URLSearchParams();
      
      if (params.productId) searchParams.append('productId', params.productId);
      if (params.brand) searchParams.append('brand', params.brand);
      if (params.name) searchParams.append('name', params.name);
      if (params.limit) searchParams.append('limit', params.limit.toString());
      if (params.minSimilarity) searchParams.append('minSimilarity', params.minSimilarity.toString());
      
      const url = `/products/similar?${searchParams.toString()}`;
      console.log("Making similar products request to:", url);
      
      const response = await fetchApi<any>(url);
      console.log("Similar products response:", response);
      
      // Se non ci sono risultati nella ricerca similare, proviamo una ricerca generica
      if (!response || 
          (typeof response === 'object' && Object.keys(response).length === 0) ||
          (response.data?.similarProducts && response.data.similarProducts.length === 0)) {
        
        console.log("No similar products found, fetching generic products");
        
        // Facciamo una ricerca generica per petType
        const genericParams = new URLSearchParams();
        genericParams.append('limit', '5');
        
        if (params.name?.toLowerCase().includes('cane') || params.name?.toLowerCase().includes('dog')) {
          genericParams.append('petType', 'cane');
        } else if (params.name?.toLowerCase().includes('gatto') || params.name?.toLowerCase().includes('cat')) {
          genericParams.append('petType', 'gatto');
        }
        
        const genericUrl = `/products?${genericParams.toString()}`;
        const genericResponse = await fetchApi<any>(genericUrl);
        
        if (genericResponse && genericResponse.data && genericResponse.data.length > 0) {
          return { 
            data: { 
              similarProducts: genericResponse.data,
              source: 'generic-search'
            } 
          };
        }
      }
      
      return response;
    } catch (error) {
      console.error("Error in getSimilar:", error);
      return { data: { similarProducts: [] } };
    }
  },
  
  /**
   * Get all categories
   */
  getCategories: async () => {
    return fetchApi<{ data: string[] }>('/products/categories/all');
  },
  
  /**
   * Get all brands
   */
  getBrands: async () => {
    return fetchApi<{ data: string[] }>('/products/brands/all');
  }
};

/**
 * Compare API
 */
export const compareApi = {
  /**
   * Get similar products by productId
   */
  getSimilarProducts: async (productId: string, limit = 5) => {
    return fetchApi<any>(`/compare/similar/${productId}?limit=${limit}`);
  },
  
  /**
   * Calculate potential savings
   */
  calculateSavings: async (productId: string) => {
    return fetchApi<any>(`/compare/savings/${productId}`);
  }
};

/**
 * Deals API
 */
export const dealsApi = {
  /**
   * Get best deals
   */
  getBestDeals: async (limit = 10, minSimilarity = 0.7) => {
    return fetchApi<any>(`/deals/best?limit=${limit}&minSimilarity=${minSimilarity}`);
  },
  
  /**
   * Get best deals by pet type
   */
  getBestDealsByPetType: async (petType: string, limit = 10, minSimilarity = 0.7) => {
    return fetchApi<any>(`/deals/best/${petType}?limit=${limit}&minSimilarity=${minSimilarity}`);
  },
  
  /**
   * Get trending deals
   */
  getTrendingDeals: async (days = 7, limit = 10) => {
    return fetchApi<any>(`/deals/trending?days=${days}&limit=${limit}`);
  },
  
  /**
   * Get price drops
   */
  getPriceDrops: async (days = 30, minReduction = 5, limit = 10) => {
    return fetchApi<any>(`/deals/price-drops?days=${days}&minReduction=${minReduction}&limit=${limit}`);
  },
  
  /**
   * Get deals by category
   */
  getDealsByCategory: async (category: string, limit = 10, minSimilarity = 0.7) => {
    return fetchApi<any>(`/deals/category/${category}?limit=${limit}&minSimilarity=${minSimilarity}`);
  },
  
  /**
   * Get deals by brand
   */
  getDealsByBrand: async (brand: string, limit = 10, minSimilarity = 0.7) => {
    return fetchApi<any>(`/deals/brand/${brand}?limit=${limit}&minSimilarity=${minSimilarity}`);
  }
};

/**
 * Trends API
 */
export const trendsApi = {
  /**
   * Get price history with analysis
   */
  getPriceHistory: async (productId: string, period = '30days') => {
    return fetchApi<any>(`/trends/price-history/${productId}?period=${period}`);
  },
  
  /**
   * Get price trends by pet type
   */
  getPetTypePriceTrends: async (petType: string, period = '30days') => {
    return fetchApi<any>(`/trends/pet-type/${petType}?period=${period}`);
  },
  
  /**
   * Get price trends by category
   */
  getCategoryPriceTrends: async (category: string, period = '30days') => {
    return fetchApi<any>(`/trends/category/${category}?period=${period}`);
  },
  
  /**
   * Get price trends by store
   */
  getStorePriceTrends: async (store: string, period = '30days') => {
    return fetchApi<any>(`/trends/store/${store}?period=${period}`);
  },
  
  /**
   * Get price trends by brand
   */
  getBrandPriceTrends: async (brand: string, period = '30days') => {
    return fetchApi<any>(`/trends/brand/${brand}?period=${period}`);
  },
  
  /**
   * Compare price trends between products
   */
  comparePriceTrends: async (productIds: string[], period = '30days') => {
    const ids = productIds.join(',');
    return fetchApi<any>(`/trends/compare?ids=${ids}&period=${period}`);
  }
};