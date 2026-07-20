import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FamilyGateModalProps {
  featureName: string;
  onDismiss: () => void;
}

export default function FamilyGateModal({ featureName, onDismiss }: FamilyGateModalProps) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/30">
      <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 animate-fade-in-up">
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-white/30 border border-white/40 flex items-center justify-center">
            <Users className="w-8 h-8 text-primary" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 text-center">
          {featureName} needs a family
        </h2>
        <p className="text-gray-700 text-sm mt-3 text-center leading-relaxed">
          Create or join a family to unlock <span className="font-medium">{featureName}</span>.
          It only takes a moment — then you can start sharing memories together.
        </p>

        <div className="flex flex-col gap-3 mt-7">
          <Button
            variant="default"
            size="lg"
            className="w-full"
            onClick={() => navigate('/family')}
          >
            Sure, set up a family
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="w-full text-gray-700 hover:bg-white/20"
            onClick={onDismiss}
          >
            Let me look around first
          </Button>
        </div>
      </div>
    </div>
  );
}
