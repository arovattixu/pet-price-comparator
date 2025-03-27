import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProductItem {
  id: string;
  name: string;
  brand: string;
  imageUrl?: string;
  price?: number;
  source?: string;
}

interface CompareState {
  products: ProductItem[];
  addProduct: (product: ProductItem) => void;
  removeProduct: (productId: string) => void;
  clearProducts: () => void;
  isInCompare: (productId: string) => boolean;
  maxCompareProducts: number;
  isCompareListFull: () => boolean;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      products: [],
      maxCompareProducts: 4,
      
      addProduct: (product) => {
        const { products, maxCompareProducts } = get();
        
        if (products.length >= maxCompareProducts) {
          return;
        }
        
        if (products.some(p => p.id === product.id)) {
          return;
        }
        
        set({ products: [...products, product] });
      },
      
      removeProduct: (productId) => {
        const { products } = get();
        set({ products: products.filter(p => p.id !== productId) });
      },
      
      clearProducts: () => {
        set({ products: [] });
      },
      
      isInCompare: (productId) => {
        const { products } = get();
        return products.some(p => p.id === productId);
      },
      
      isCompareListFull: () => {
        const { products, maxCompareProducts } = get();
        return products.length >= maxCompareProducts;
      },
    }),
    {
      name: 'product-compare-storage',
    }
  )
); 