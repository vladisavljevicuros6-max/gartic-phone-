import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import DrawingBoard from './components/DrawingBoard';
import { AVATARS, LANGUAGES } from './utils/constants';

const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export default function App() {
  const [socket, setSocket] = useState(null);
  const [profile, setProfile] = useState({ username: '', avatar: AVATARS[0], language: 'English' });
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState(null);
  const [textEntry, setTextEntry] = useState('');
  const [chatEntry, setChatEntry] = useState('');
  const [turnStrokes, setTurnStrokes] = useState([]);
  const [drawKey, setDrawKey] = useState(0);

  useEffect(() => {
    const s = io(serverUrl, { transports: ['websocket'] });
    s.on('room:update', setRoom);
    s.on('turn:stroke', (stroke) => setTurnStrokes((prev) => [...prev, stroke]));
    setSocket(s);
    return () => s.disconnect();
  }, []);

  const joinRoom = (mode) => {
    if (!socket || !profile.username.trim()) return;
    socket.emit(mode, { ...profile, roomCode });
  };

  const startGame = () => socket?.emit('game:start');

  const submitTurn = () => {
    if (!room?.myTurn) return;
    if (room.myTurn.type === 'draw') {
      socket.emit('turn:submit', { drawing: turnStrokes });
      setTurnStrokes([]);
      setDrawKey((k) => k + 1);
      return;
    }
    socket.emit('turn:submit', { text: textEntry });
    setTextEntry('');
  };

  const sendChat = (e) => {
    e.preventDefault();
    if (!chatEntry.trim()) return;
    socket.emit('room:chat', chatEntry);
    setChatEntry('');
  };

  const publicLink = useMemo(() => {
    if (!room?.code) return '';
    return `${window.location.origin}?room=${room.code}`;
  }, [room?.code]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get('room');
    if (prefill) setRoomCode(prefill.toUpperCase());
  }, []);

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 px-4 py-8 text-slate-100">
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="animate-float text-center text-4xl font-black tracking-tight">🎉 Gartic Phone Clone</h1>
          <div className="panel space-y-4 p-6">
            <input className="input" placeholder="Username" value={profile.username} onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))} />
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {AVATARS.map((emoji) => (
                <button key={emoji} className={`btn text-2xl ${profile.avatar === emoji ? 'bg-primary' : 'bg-slate-700'}`} onClick={() => setProfile((p) => ({ ...p, avatar: emoji }))}>{emoji}</button>
              ))}
            </div>
            <select className="input" value={profile.language} onChange={(e) => setProfile((p) => ({ ...p, language: e.target.value }))}>
              {LANGUAGES.map((language) => <option key={language}>{language}</option>)}
            </select>
            <input className="input" placeholder="Room code (for join)" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} />
            <div className="flex flex-wrap gap-2">
              <button className="btn bg-primary text-white" onClick={() => joinRoom('room:create')}>Create room</button>
              <button className="btn bg-secondary text-slate-900" onClick={() => joinRoom('room:join')}>Join room</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-3 py-4 text-slate-100 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-3">
          <div className="panel flex flex-wrap items-center justify-between gap-2 p-4">
            <div>
              <h2 className="text-xl font-bold">Room {room.code} · {room.settings.language}</h2>
              <p className="text-slate-300">Share: {publicLink}</p>
            </div>
            {room.host && room.phase === 'lobby' && <button className="btn bg-primary" onClick={startGame}>Start Normal mode</button>}
          </div>

          {room.phase === 'playing' && room.myTurn && (
            <div className="space-y-2">
              <div className="panel p-3">
                <h3 className="text-lg font-semibold capitalize">Your turn: {room.myTurn.type}</h3>
                <p className="text-slate-300">{room.myTurn.prompt || 'Create the funniest drawing you can!'}</p>
                {room.myTurn.type === 'guess' && (
                  <input className="input mt-2" placeholder="Type your guess..." value={textEntry} onChange={(e) => setTextEntry(e.target.value)} />
                )}
                <button className="btn mt-2 bg-emerald-500 text-slate-900" onClick={submitTurn}>Submit turn</button>
              </div>
              {room.myTurn.type === 'draw' && <DrawingBoard key={drawKey} strokes={room.turnStrokes || []} onStroke={(stroke) => socket.emit('turn:stroke', stroke)} />}
            </div>
          )}

          {room.phase === 'results' && (
            <div className="panel space-y-4 p-4">
              <h3 className="text-2xl font-bold">Results Reveal</h3>
              {room.results.map((book) => (
                <div key={book.ownerId} className="rounded-xl border border-slate-700 p-3">
                  <p className="font-semibold">{book.ownerName}'s chain</p>
                  <ol className="list-inside list-decimal text-slate-200">
                    {book.entries.map((entry, idx) => (
                      <li key={`${entry.type}-${idx}`}>
                        {entry.type === 'text' ? entry.value : `🖼 Drawing with ${entry.value.length} strokes`}
                      </li>
                    ))}
                  </ol>
                  <button className="btn mt-2 bg-yellow-400 text-slate-900" onClick={() => socket.emit('result:vote', book.ownerId)}>Vote 😂</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-3">
          <div className="panel p-4">
            <h4 className="mb-2 text-lg font-semibold">Players ({room.players.length}/{room.settings.maxPlayers})</h4>
            <ul className="space-y-1 text-slate-200">
              {room.players.map((player) => (
                <li key={player.id} className="flex justify-between"><span>{player.avatar} {player.username}</span><span>{player.score}⭐</span></li>
              ))}
            </ul>
          </div>

          <form className="panel p-4" onSubmit={sendChat}>
            <h4 className="mb-2 text-lg font-semibold">Chat</h4>
            <div className="mb-2 max-h-56 space-y-1 overflow-auto rounded bg-slate-800/60 p-2">
              {room.chat.map((message) => (
                <p key={message.id}><span className="font-semibold">{message.author}:</span> {message.text}</p>
              ))}
            </div>
            <input className="input" placeholder="Say something funny" value={chatEntry} onChange={(e) => setChatEntry(e.target.value)} />
          </form>
        </aside>
      </div>
    </div>
  );
}
