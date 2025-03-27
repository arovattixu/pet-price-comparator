import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Crea istanza axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Servizio prodotti
export const productService = {
  // Cerca prodotti con filtri
  searchProducts: async (params) => {
    try {
      const response = await api.get('/products', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  // Ottieni dettagli prodotto
  getProduct: async (id) => {
    try {
      const response = await api.get(`/products/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  // Ottieni prodotto per fonte e ID fonte
  getProductBySource: async (source, sourceId) => {
    try {
      const response = await api.get(`/products/source/${source}/${sourceId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

// Servizio prezzi
export const priceService = {
  // Ottieni storico prezzi
  getPriceHistory: async (productId, variantId, params) => {
    try {
      const response = await api.get(
        `/prices/history/${productId}/${variantId}`, 
        { params }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  // Ottieni variazioni di prezzo
  getPriceVariations: async (productId, variantId) => {
    try {
      const response = await api.get(`/prices/variations/${productId}/${variantId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

// Servizio confronto
export const compareService = {
  // Cerca e confronta prodotti
  searchAndCompare: async (params) => {
    try {
      const response = await api.get('/compare/search', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  
  // Confronta prodotto con alternative
  compareProduct: async (id) => {
    try {
      const response = await api.get(`/compare/product/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
}; 