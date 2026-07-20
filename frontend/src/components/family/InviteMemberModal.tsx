import { useState } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { Person } from '../../types';
import { AddMemberPayload } from '../../services/family.service';

interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
  members: Person[];
  onInvite: (data: AddMemberPayload) => void;
  isPending: boolean;
  error: string | null;
}

const RELATIONSHIP_TYPES = [
  { value: '', label: '— no relationship —' },
  { value: 'PARENT_OF', label: 'Parent of' },
  { value: 'SPOUSE_OF', label: 'Spouse of' },
  { value: 'SIBLING_OF', label: 'Sibling of' },
];

export default function InviteMemberModal({
  open,
  onClose,
  members,
  onInvite,
  isPending,
  error,
}: InviteMemberModalProps) {
  const [step, setStep] = useState(1);

  // Step 1 fields
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [relatedTo, setRelatedTo] = useState('');

  // Step 2 fields
  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [isDeceased, setIsDeceased] = useState(false);
  const [email, setEmail] = useState('');

  if (!open) return null;

  const reset = () => {
    setStep(1);
    setName('');
    setRelationship('');
    setRelatedTo('');
    setNickname('');
    setBirthDate('');
    setIsDeceased(false);
    setEmail('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onInvite({
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      birthDate: birthDate || undefined,
      isDeceased: isDeceased || undefined,
      relationship: relationship || undefined,
      relatedTo: relatedTo || undefined,
      email: email.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add Family Member</h2>
            <p className="text-xs text-gray-500 mt-0.5">Step {step} of 2</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2">
          <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-primary-500' : 'bg-gray-200'}`} />
          <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-primary-500' : 'bg-gray-200'}`} />
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Relationship (optional)
              </label>
              <select
                value={relationship}
                onChange={(e) => {
                  setRelationship(e.target.value);
                  if (!e.target.value) setRelatedTo('');
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {RELATIONSHIP_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {relationship && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Related to (optional)
                </label>
                <select
                  value={relatedTo}
                  onChange={(e) => setRelatedTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">— select a member —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!name.trim()}
                onClick={() => setStep(2)}
                className="flex-1 btn-primary flex items-center justify-center gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nickname (optional)
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Grandma Jane"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Birth date (optional)
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="deceased"
                type="checkbox"
                checked={isDeceased}
                onChange={(e) => setIsDeceased(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded"
              />
              <label htmlFor="deceased" className="text-sm text-gray-700">
                This person has passed away
              </label>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invite via email (optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                They'll receive an invite link to join RememberKin and claim their profile.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 btn-primary"
              >
                {isPending ? 'Adding…' : 'Add Member'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
