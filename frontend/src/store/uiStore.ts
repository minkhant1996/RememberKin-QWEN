import { create } from 'zustand';

interface UiState {
  familyGateDismissed: boolean;
  dismissFamilyGate: () => void;
  resetFamilyGate: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  familyGateDismissed: false,
  dismissFamilyGate: () => set({ familyGateDismissed: true }),
  resetFamilyGate: () => set({ familyGateDismissed: false }),
}));
