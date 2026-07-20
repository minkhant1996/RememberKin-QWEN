import ChatWindow from '../components/chat/ChatWindow';

export default function Chat() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-4">
          <h1 className="text-xl font-semibold text-white">
            Chat with Rememberkin
          </h1>
          <p className="text-primary-100 text-sm">
            Ask questions about your family, share memories, or get reminders
          </p>
        </div>
        <ChatWindow />
      </div>
    </div>
  );
}
