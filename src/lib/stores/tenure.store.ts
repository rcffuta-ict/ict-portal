import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
// We assume 'Tenure' is exported from your lib types. 
// If not, define it here or export it from src/types/index.ts in ict-lib
import type { Tenure } from '@rcffuta/ict-lib'; 

interface TenureState {
  activeTenure: Tenure | null;
  isLoading: boolean;

  // Actions
  setTenure: (active: Tenure | null) => void;
//   addTenure: (tenure: Tenure) => void; // For optimistic updates when creating
//   updateActiveTenure: (tenure: Tenure) => void;
}

export const useTenureStore = create<TenureState>()(
  devtools((set) => ({
    activeTenure: null,
    allTenures: [],
    isLoading: true,

    // Initialize the store
    setTenure: (active: Tenure | null) => set({ 
        activeTenure: active, 
        isLoading: false 
    }, false, "INIT_TENURE"),
    // // When Admin creates a new tenure
    // addTenure: (tenure) => set((state) => ({
    //     allTenures: [tenure, ...state.allTenures],
    //     // If the new tenure is active, replace the current active one
    //     activeTenure: tenure.isActive ? tenure : state.activeTenure 
    // }), false, "ADD_TENURE"),

    // Update specific tenure details
    // updateActiveTenure: (tenure) => set({ activeTenure: tenure }, false, "UPDATE_ACTIVE"),
  }))
);