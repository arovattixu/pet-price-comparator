import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SearchFilters {
  query?: string;
  category?: string;
  brand?: string;
  petType?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'relevance';
}

interface SearchHistoryItem {
  id: string;
  filters: SearchFilters;
  timestamp: number;
}

interface SearchState {
  // Current search filters
  currentFilters: SearchFilters;
  setFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  clearFilters: () => void;
  
  // Search history
  history: SearchHistoryItem[];
  addToHistory: (filters: SearchFilters) => void;
  clearHistory: () => void;
  removeFromHistory: (id: string) => void;
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set, get) => ({
      // Current filters
      currentFilters: {},
      
      setFilter: (key, value) => {
        const { currentFilters } = get();
        
        // If value is undefined or empty string, remove the filter
        if (value === undefined || value === '') {
          const newFilters = { ...currentFilters };
          delete newFilters[key];
          set({ currentFilters: newFilters });
        } else {
          set({ 
            currentFilters: { 
              ...currentFilters, 
              [key]: value 
            } 
          });
        }
      },
      
      clearFilters: () => {
        set({ currentFilters: {} });
      },
      
      // Search history
      history: [],
      
      addToHistory: (filters) => {
        // Skip empty searches
        if (!filters.query && !filters.category && !filters.brand && !filters.petType) {
          return;
        }
        
        const { history } = get();
        const newHistoryItem = {
          id: Date.now().toString(),
          filters: { ...filters },
          timestamp: Date.now(),
        };
        
        // Limit history to 20 items
        const updatedHistory = [newHistoryItem, ...history].slice(0, 20);
        set({ history: updatedHistory });
      },
      
      clearHistory: () => {
        set({ history: [] });
      },
      
      removeFromHistory: (id) => {
        const { history } = get();
        set({ history: history.filter(item => item.id !== id) });
      },
    }),
    {
      name: 'search-store',
      partialize: (state) => ({
        history: state.history,
        // Don't persist currentFilters
      }),
    }
  )
); 