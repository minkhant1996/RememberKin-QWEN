import { useState, KeyboardEvent } from 'react';
import { Send, Mic } from 'lucide-react';

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="flex items-end space-x-3">
        <div className="flex-1 relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your family or share a memory..."
            className="w-full px-4 py-3 bg-gray-100 border-0 rounded-xl resize-none focus:bg-white focus:ring-2 focus:ring-primary-500 min-h-[48px] max-h-[120px]"
            rows={1}
            disabled={disabled}
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className="p-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Send className="w-5 h-5" />
        </button>

        <button
          className="p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition"
          title="Voice input (coming soon)"
        >
          <Mic className="w-5 h-5" />
        </button>
      </div>

      <p className="text-xs text-gray-500 mt-2 text-center">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
