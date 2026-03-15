import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Mic, Send } from 'lucide-react';
import { useNavigation } from '../navigation';

type Message = { id: string; role: 'user' | 'assistant'; content: string };

const INITIAL_MESSAGES: Message[] = [
  { id: '1', role: 'assistant', content: 'Estou vendo que hoje parece um dia de energia radiante. Como você está se sentindo agora? Pode me contar o que está passando pela sua cabeça.' },
  { id: '2', role: 'user', content: 'Hoje estou me sentindo mais disposta, mas um pouco ansiosa com o trabalho. Tenho muitas coisas pra fazer.' },
  { id: '3', role: 'assistant', content: 'É ótimo que você está com disposição! A ansiedade sobre trabalho é comum quando temos muitas demandas. Que tal organizarmos juntas as prioridades do dia? Às vezes, ver as coisas escritas ajuda a aliviar a sensação de sobrecarga.' },
  { id: '4', role: 'user', content: 'Boa ideia. Acho que o principal é terminar o relatório e responder os emails pendentes.' },
  { id: '5', role: 'assistant', content: 'Perfeito. Dois itens claros e alcançáveis. Considerando que sua energia está boa agora, pode valer a pena atacar o relatório primeiro, enquanto o foco está no pico. Os emails podem ficar para o período da tarde, quando normalmente a energia começa a baixar e tarefas mais leves funcionam melhor. O que acha?' },
];

function ChatBubble({ content, isUser }: { content: string; isUser: boolean }) {
  return (
    <div className={`flex mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] p-4 text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-3xl rounded-tr-sm'
            : 'bg-gray-200 text-gray-800 rounded-3xl rounded-tl-sm'
        }`}
      >
        {content}
      </div>
    </div>
  );
}

export default function JournalScreen() {
  const { navigate } = useNavigation();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, newMsg]);
    setInput('');

    setTimeout(() => {
      const aiReply: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Entendo. Vou guardar isso para considerar nas próximas sugestões. Continue me contando quando quiser.',
      };
      setMessages((prev) => [...prev, aiReply]);
    }, 1200);
  };

  const handleEnd = () => {
    navigate('dailySummary');
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <button onClick={() => navigate('home')} className="p-2">
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <h1 className="text-lg font-bold text-gray-800">Diário com IA</h1>
        <button onClick={handleEnd} className="text-blue-600 font-semibold text-sm">
          Encerrar
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} content={msg.content} isUser={msg.role === 'user'} />
        ))}
      </div>

      <div className="p-4 bg-white border-t border-gray-200 flex items-center gap-2">
        <button className="p-2">
          <Mic size={24} className="text-gray-400" />
        </button>

        <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Conta o que está acontecendo hoje..."
            className="w-full bg-transparent text-gray-800 text-sm outline-none"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className={`p-3 rounded-full transition-colors ${
            input.trim() ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <Send size={18} className="text-white" />
        </button>
      </div>
    </div>
  );
}
