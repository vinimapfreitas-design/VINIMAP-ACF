import React, { useState } from 'react';
import { BookOpen, Plus, Tag, Trash2, Calendar } from 'lucide-react';
import { DiaryEntry } from '../types';

interface DiaryTabProps {
  currentUser?: any;
}

export const DiaryTab: React.FC<DiaryTabProps> = ({ currentUser }) => {
  const [entries, setEntries] = useState<DiaryEntry[]>([
    {
      id: 'entry-1',
      title: 'Ajuste de Frota Zona Sul',
      content: 'Reforçar motoristas na região do Jabaquara a partir das 14h para cobrir entregas da Droga Raia.',
      category: 'Nota',
      createdAt: '2026-07-26 10:00',
      isPinned: true
    }
  ]);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  const handleAdd = () => {
    if (!newTitle) return;
    const newEntry: DiaryEntry = {
      id: `entry-${Date.now()}`,
      title: newTitle,
      content: newContent,
      category: 'Nota',
      createdAt: new Date().toLocaleString('pt-BR')
    };
    setEntries([newEntry, ...entries]);
    setNewTitle('');
    setNewContent('');
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm my-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
          <BookOpen size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800">Diário Operacional & Anotações</h3>
          <p className="text-xs text-slate-500">Registre ocorrências, lembretes e diretrizes da equipe</p>
        </div>
      </div>

      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
        <h4 className="font-bold text-xs text-slate-700">Nova Anotação</h4>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Título da anotação..."
          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none"
        />
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Conteúdo detalhado..."
          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none h-20"
        />
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-colors"
        >
          Adicionar Anotação
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {entries.map(e => (
          <div key={e.id} className="p-4 bg-purple-50/40 rounded-2xl border border-purple-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-sm text-slate-800">{e.title}</h4>
                <span className="text-[10px] text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full font-bold">{e.category}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">{e.content}</p>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-purple-100 pt-2">
              <span>{e.createdAt}</span>
              <button onClick={() => setEntries(entries.filter(i => i.id !== e.id))} className="text-red-400 hover:text-red-600">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiaryTab;
