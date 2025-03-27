import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const usePetStore = create(
  persist(
    (set) => ({
      selectedPet: null,
      setSelectedPet: (pet) => set({ selectedPet: pet }),
      clearPet: () => set({ selectedPet: null }),
    }),
    {
      name: 'pet-storage',
    }
  )
);

export const useCompareStore = create(
  persist(
    (set, get) => ({
      compareList: [],
      addToCompare: (product) => {
        const current = get().compareList;
        // Evita duplicati
        if (!current.some(p => p.id === product.id)) {
          // Limita a massimo 4 prodotti per confronto
          if (current.length < 4) {
            set({ compareList: [...current, product] });
            return true;
          }
        }
        return false;
      },
      removeFromCompare: (productId) => {
        set({ compareList: get().compareList.filter(p => p.id !== productId) });
      },
      clearCompare: () => set({ compareList: [] }),
    }),
    {
      name: 'compare-storage',
    }
  )
); 