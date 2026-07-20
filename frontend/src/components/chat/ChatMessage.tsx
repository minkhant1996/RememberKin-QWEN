import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Bot, Palette, Users } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '../../types';
import { clsx } from 'clsx';

// Origin of the backend so /uploads/... photo paths display correctly
const API_ORIGIN = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/api\/v1\/?$/, '');
const photoUrl = (url: string) => (url.startsWith('/uploads/') ? `${API_ORIGIN}${url}` : url);

interface Props {
  message: ChatMessageType;
  onSendMessage?: (text: string) => void;
}

export default function ChatMessage({ message, onSendMessage }: Props) {
  const isUser = message.role === 'user';
  const navigate = useNavigate();

  const handleAction = (action: { type: string; label: string; payload?: Record<string, unknown> }) => {
    switch (action.type) {
      case 'record_story':
        navigate('/stories?new=1');
        break;
      case 'create_event':
        navigate('/events');
        break;
      default:
        onSendMessage?.(action.label);
    }
  };

  return (
    <div
      className={clsx(
        'flex items-start space-x-3 animate-fade-in-up',
        isUser && 'flex-row-reverse space-x-reverse'
      )}
    >
      {/* Avatar */}
      <div
        className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isUser ? 'bg-primary-100' : 'bg-gray-100'
        )}
      >
        {isUser ? (
          <User className="w-5 h-5 text-primary-600" />
        ) : (
          <Bot className="w-5 h-5 text-gray-600" />
        )}
      </div>

      {/* Message content */}
      <div
        className={clsx(
          'max-w-[75%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-primary-600 text-white'
            : 'bg-white border border-gray-200 text-gray-900'
        )}
      >
        <div className="space-y-2 whitespace-pre-wrap leading-6">
          {renderRichMessage(message.content)}
        </div>

        {/* Photos from the family gallery matching the question */}
        {message.relatedPhotos && message.relatedPhotos.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-2">From your gallery:</p>
            <div className="grid grid-cols-2 gap-2">
              {message.relatedPhotos.map((photo) => (
                <a
                  key={photo.id}
                  href={photoUrl(photo.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg overflow-hidden border border-gray-200 bg-gray-50 hover:shadow-md transition"
                >
                  <img
                    src={photoUrl(photo.url)}
                    alt={photo.caption || 'Family photo'}
                    className="w-full aspect-square object-cover"
                  />
                  <div className="p-1.5">
                    {photo.caption && (
                      <p className="text-xs font-medium text-gray-800 truncate">{photo.caption}</p>
                    )}
                    {photo.taggedMembers && photo.taggedMembers.length > 0 && (
                      <p className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                        <Users className="w-2.5 h-2.5" />
                        {photo.taggedMembers.map((m) => m.name).join(', ')}
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Related stories */}
        {message.relatedStories && message.relatedStories.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-2">Related stories:</p>
            <div className="space-y-1">
              {message.relatedStories.map((story) => (
                <button
                  key={story.id}
                  onClick={() => onSendMessage?.(`Tell me more about this story: "${story.summary}"`)}
                  className="block w-full text-left text-sm text-primary-600 hover:underline"
                >
                  {story.summary}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Suggested actions */}
        {message.suggestedActions && message.suggestedActions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.suggestedActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleAction(action)}
                className="px-3 py-1 bg-primary-50 text-primary-700 text-sm rounded-full hover:bg-primary-100 transition"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function renderRichMessage(content: string) {
  const lines = content.split('\n');

  return lines.map((line, lineIndex) => {
    return (
      <p key={`${lineIndex}-${line}`} className={clsx(line.trim() === '' && 'h-4')}>
        {renderInlineParts(line, lineIndex)}
      </p>
    );
  });
}

function renderInlineParts(line: string, lineIndex: number) {
  const pattern = /(\*\*.+?\*\*|\*[^*]+\*|#[0-9a-fA-F]{3,8})/g;
  const parts: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > cursor) {
      parts.push(
        <Fragment key={`${lineIndex}-text-${cursor}`}>{line.slice(cursor, match.index)}</Fragment>
      );
    }

    const value = match[0];

    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) {
      parts.push(
        <ColorCodeChip key={`${lineIndex}-color-${match.index}-${value}`} code={value} />
      );
    } else if (/^\*\*.+\*\*$/.test(value)) {
      parts.push(
        <strong key={`${lineIndex}-bold-${match.index}-${value}`}>
          {value.slice(2, -2)}
        </strong>
      );
    } else if (/^\*[^*]+\*$/.test(value)) {
      parts.push(
        <em key={`${lineIndex}-italic-${match.index}-${value}`}>
          {value.slice(1, -1)}
        </em>
      );
    } else {
      parts.push(<Fragment key={`${lineIndex}-raw-${match.index}-${value}`}>{value}</Fragment>);
    }

    cursor = match.index + value.length;
  }

  if (cursor < line.length) {
    parts.push(<Fragment key={`${lineIndex}-text-${cursor}`}>{line.slice(cursor)}</Fragment>);
  }

  return parts;
}

function ColorCodeChip({
  code,
}: {
  code: string;
}) {
  const validColor = /^#[0-9a-fA-F]{3,8}$/.test(code) ? code : '#000000';

  return (
    <span className="inline-flex items-center align-middle mx-0.5 rounded-full border border-current/10 bg-white/80 px-2 py-0.5 shadow-sm">
      <span
        className="mr-1.5 h-3 w-3 rounded-full border border-black/10"
        style={{ backgroundColor: validColor }}
        aria-hidden="true"
      />
      <span className="inline-flex items-center gap-1 text-xs font-mono text-gray-700">
        <Palette className="h-3 w-3" />
        {code}
      </span>
    </span>
  );
}
