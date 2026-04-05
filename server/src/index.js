import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { nanoid } from 'nanoid';
import { randomWord } from './words.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms = new Map();

const createRoomState = (hostId, hostProfile) => ({
  code: nanoid(6).toUpperCase(),
  hostId,
  phase: 'lobby',
  mode: 'normal',
  players: [{ id: hostId, username: hostProfile.username, avatar: hostProfile.avatar, language: hostProfile.language, score: 0 }],
  settings: {
    maxPlayers: 10,
    language: hostProfile.language,
    customWords: [],
    preset: 'random',
    private: true
  },
  chat: [],
  books: [],
  turnCount: 0,
  pending: new Set(),
  turnStrokes: [],
  votes: {}
});

const sanitizeRoom = (room, socketId) => {
  const me = room.players.find((p) => p.id === socketId);
  const myBook = room.books.find((book) => book.ownerId === socketId);
  let myTurn = null;
  if (room.phase === 'playing' && myBook) {
    myTurn = room.turnCount % 2 === 0
      ? { type: 'draw', prompt: myBook.entries[room.turnCount - 1]?.value || myBook.entries[0].value }
      : { type: 'guess', prompt: 'Guess what this drawing is.' };
  }
  return {
    code: room.code,
    host: room.hostId === socketId,
    phase: room.phase,
    mode: room.mode,
    players: room.players,
    settings: room.settings,
    chat: room.chat.slice(-50),
    results: room.phase === 'results' ? room.books : [],
    myTurn,
    turnStrokes: room.turnStrokes,
    me
  };
};

const emitRoom = (room) => {
  for (const player of room.players) {
    io.to(player.id).emit('room:update', sanitizeRoom(room, player.id));
  }
};

const nextTurn = (room) => {
  room.turnCount += 1;
  room.pending = new Set(room.players.map((p) => p.id));
  room.turnStrokes = [];
  if (room.turnCount >= room.players.length) {
    room.phase = 'results';
  }
};

io.on('connection', (socket) => {
  const getCurrentRoom = () => [...rooms.values()].find((room) => room.players.some((p) => p.id === socket.id));

  socket.on('room:create', (profile) => {
    const room = createRoomState(socket.id, profile);
    rooms.set(room.code, room);
    socket.join(room.code);
    emitRoom(room);
  });

  socket.on('room:join', (profile) => {
    const room = rooms.get(profile.roomCode);
    if (!room) return;
    if (room.players.length >= room.settings.maxPlayers) return;
    room.players.push({ id: socket.id, username: profile.username, avatar: profile.avatar, language: profile.language, score: 0 });
    socket.join(room.code);
    emitRoom(room);
  });

  socket.on('game:start', () => {
    const room = getCurrentRoom();
    if (!room || room.hostId !== socket.id || room.players.length < 4) return;
    room.phase = 'playing';
    room.turnCount = 0;
    room.votes = {};
    room.books = room.players.map((player) => ({
      ownerId: player.id,
      ownerName: player.username,
      entries: [{ type: 'text', value: randomWord(room.settings.customWords, room.settings.preset), by: player.id }]
    }));
    room.pending = new Set(room.players.map((p) => p.id));
    emitRoom(room);
  });

  socket.on('turn:stroke', (stroke) => {
    const room = getCurrentRoom();
    if (!room || room.phase !== 'playing') return;
    room.turnStrokes.push(stroke);
    socket.to(room.code).emit('turn:stroke', stroke);
  });

  socket.on('turn:submit', (payload) => {
    const room = getCurrentRoom();
    if (!room || room.phase !== 'playing') return;
    const playerIndex = room.players.findIndex((p) => p.id === socket.id);
    const bookIndex = (playerIndex - room.turnCount + room.players.length) % room.players.length;
    const book = room.books[bookIndex];
    if (!book) return;

    const entry = room.turnCount % 2 === 0
      ? { type: 'drawing', value: payload.drawing || [], by: socket.id }
      : { type: 'text', value: payload.text || '???', by: socket.id };

    book.entries.push(entry);
    room.pending.delete(socket.id);

    if (room.pending.size === 0) {
      nextTurn(room);
    }

    emitRoom(room);
  });

  socket.on('room:chat', (text) => {
    const room = getCurrentRoom();
    if (!room) return;
    const author = room.players.find((p) => p.id === socket.id);
    room.chat.push({ id: nanoid(), author: author?.username || 'Anon', text });
    emitRoom(room);
  });

  socket.on('result:vote', (ownerId) => {
    const room = getCurrentRoom();
    if (!room || room.phase !== 'results') return;
    if (!room.votes[ownerId]) room.votes[ownerId] = new Set();
    room.votes[ownerId].add(socket.id);
    room.players = room.players.map((player) =>
      player.id === ownerId ? { ...player, score: room.votes[ownerId].size } : player
    );
    emitRoom(room);
  });

  socket.on('disconnect', () => {
    const room = getCurrentRoom();
    if (!room) return;
    room.players = room.players.filter((player) => player.id !== socket.id);
    if (!room.players.length) {
      rooms.delete(room.code);
      return;
    }
    if (room.hostId === socket.id) room.hostId = room.players[0].id;
    emitRoom(room);
  });
});

app.get('/health', (_, res) => res.json({ ok: true, rooms: rooms.size }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
