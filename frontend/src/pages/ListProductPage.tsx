import ChatWindow from '../components/ChatWindow';

export default function ListProductPage() {
  const token = localStorage.getItem('token') || undefined;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-artisan-bark">List your product</h1>
        <p className="mt-1 text-artisan-stone">
          Chat with AI to create your listing. Describe your item and answer a few questions.
        </p>
        <div className="mt-6 h-[32rem] min-h-[24rem]">
          <ChatWindow token={token} />
        </div>
      </div>
    </div>
  );
}
