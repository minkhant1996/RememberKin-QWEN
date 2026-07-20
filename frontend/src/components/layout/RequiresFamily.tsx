import { type ReactNode } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import FamilyGateModal from '../family/FamilyGateModal';

interface RequiresFamilyProps {
  children: ReactNode;
  featureName: string;
}

export default function RequiresFamily({ children, featureName }: RequiresFamilyProps) {
  const user = useAuthStore((state) => state.user);
  const { familyGateDismissed, dismissFamilyGate } = useUiStore();

  if (user === null) return null;

  if (!user.familyId && !familyGateDismissed) {
    return <FamilyGateModal featureName={featureName} onDismiss={dismissFamilyGate} />;
  }

  return <>{children}</>;
}
