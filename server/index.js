const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

app.use(cors());


// Proxy for Deezer API
app.get('/api/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });
    try {
        const response = await axios.get(`https://api.deezer.com/search/album`, {
            params: { q }
        });
        res.json(response.data.data);
    } catch (error) {
        console.error("Deezer API error:", error.message);
        res.status(500).json({ error: 'Failed to fetch from Deezer' });
    }
});

// Fetch random covers via User Loved Tracks
app.get('/api/covers', async (req, res) => {
    try {
        const userId = '5654460941';

        // 1. Fetch tracks from user's loved tracks
        // We fetch a larger limit to get a good pool (Limit 2000 covers most libraries)
        const tracksResponse = await axios.get(`https://api.deezer.com/user/${userId}/tracks`, {
            params: { limit: 2000 }
        });

        const tracks = tracksResponse.data.data;
        if (!tracks || tracks.length === 0) {
            console.warn(`No tracks found for user ${userId}`);
            return res.status(404).json({ error: 'No tracks found' });
        }
        console.log(`Found ${tracks.length} tracks for user ${userId}`);

        // 2. Extract unique albums
        const uniqueAlbums = new Map();
        tracks.forEach(track => {
            if (track.album && track.artist) {
                if (!uniqueAlbums.has(track.album.id)) {
                    uniqueAlbums.set(track.album.id, {
                        id: track.album.id,
                        title: track.album.title,
                        artist: track.artist.name,
                        cover: track.album.cover_xl || track.album.cover_big || track.album.cover_medium || track.album.cover,
                        // Track object from user/tracks usually DOES NOT have nb_tracks for the album
                        // It only has album { id, title, cover ... }
                    });
                }
            }
        });
        console.log(`Extracted ${uniqueAlbums.size} unique albums from tracks`);

        // 3. Shuffle the ENTIRE pool of unique albums
        const albumCandidates = Array.from(uniqueAlbums.values());
        for (let i = albumCandidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [albumCandidates[i], albumCandidates[j]] = [albumCandidates[j], albumCandidates[i]];
        }

        // 4. Verification Check
        // We verify a larger subset to ensure we return enough valid albums
        // Let's verify top 50 shuffled candidates
        const subsetToCheck = albumCandidates.slice(0, 50);

        const verificationRequests = subsetToCheck.map(album =>
            axios.get(`https://api.deezer.com/album/${album.id}`)
                .then(res => ({ ...album, details: res.data }))
                .catch(err => null) // Ignore failed fetches
        );

        const verifiedAlbums = await Promise.all(verificationRequests);

        const validAlbums = verifiedAlbums
            .filter(item => item && item.details && item.details.nb_tracks >= 3)
            .map(item => ({
                id: item.id,
                title: item.title,
                artist: item.artist,
                cover: item.cover
            }));

        console.log(`Returning ${validAlbums.length} valid albums after verification (nb_tracks >= 3)`);
        res.json(validAlbums);

    } catch (error) {
        console.error("Error fetching covers:", error.message);
        res.status(500).json({ error: 'Failed to fetch covers' });
    }
});

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store rooms and game state
// roomCode => { players, gameState, currentRound, covers, roundTimer, hostId }
const rooms = new Map();

// Helper: Fetch covers for a room
async function fetchCoversForRoom() {
    try {
        const userId = '5654460941';
        const tracksResponse = await axios.get(`https://api.deezer.com/user/${userId}/tracks`, {
            params: { limit: 2000 }
        });
        const tracks = tracksResponse.data.data || [];

        const uniqueAlbums = new Map();
        tracks.forEach(track => {
            if (track.album && track.artist && !uniqueAlbums.has(track.album.id)) {
                uniqueAlbums.set(track.album.id, {
                    id: track.album.id,
                    title: track.album.title,
                    artist: track.artist.name,
                    cover: track.album.cover_xl || track.album.cover_big || track.album.cover_medium || track.album.cover
                });
            }
        });

        // Shuffle
        const albums = Array.from(uniqueAlbums.values());
        for (let i = albums.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [albums[i], albums[j]] = [albums[j], albums[i]];
        }
        return albums.slice(0, 30); // Limit to 30 rounds max
    } catch (error) {
        console.error("Error fetching covers for room:", error.message);
        return [];
    }
}

// Helper: Start a new round
function startRound(roomCode) {
    const room = rooms.get(roomCode);
    if (!room || room.covers.length === 0) {
        io.to(roomCode).emit('game_over', { players: room?.players || [] });
        return;
    }

    room.currentRound = room.covers.pop();
    room.gameState = 'PLAYING';
    room.timeLeft = 20;

    io.to(roomCode).emit('round_start', {
        cover: room.currentRound.cover,
        timeLeft: room.timeLeft,
        players: room.players
    });

    // Timer countdown
    if (room.roundTimer) clearInterval(room.roundTimer);
    room.roundTimer = setInterval(() => {
        room.timeLeft -= 1;
        io.to(roomCode).emit('timer_tick', room.timeLeft);

        if (room.timeLeft <= 0) {
            clearInterval(room.roundTimer);
            room.gameState = 'ROUND_END';
            io.to(roomCode).emit('round_end', {
                winner: null,
                answer: room.currentRound,
                players: room.players
            });

            // Auto-start next round after 3 seconds
            setTimeout(() => {
                if (rooms.has(roomCode)) startRound(roomCode);
            }, 3000);
        }
    }, 1000);
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Create a new room
    socket.on('create_room', (pseudo) => {
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms.set(roomCode, {
            players: [{ id: socket.id, pseudo: pseudo || 'Hôte', score: 0 }],
            gameState: 'WAITING',
            currentRound: null,
            covers: [],
            roundTimer: null,
            hostId: socket.id
        });
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.emit('room_created', { roomCode, players: rooms.get(roomCode).players });
        console.log(`Room ${roomCode} created by ${pseudo}`);
    });

    // Join existing room
    socket.on('join_room', ({ roomCode, pseudo }) => {
        const room = rooms.get(roomCode);
        if (!room) {
            socket.emit('error', { message: 'Salle introuvable' });
            return;
        }
        if (room.gameState !== 'WAITING') {
            socket.emit('error', { message: 'La partie a déjà commencé' });
            return;
        }

        room.players.push({ id: socket.id, pseudo: pseudo || `Joueur ${room.players.length + 1}`, score: 0 });
        socket.join(roomCode);
        socket.roomCode = roomCode;

        io.to(roomCode).emit('player_joined', { players: room.players });
        socket.emit('joined_success', { roomCode, players: room.players, hostId: room.hostId });
        console.log(`${pseudo} joined room ${roomCode}`);
    });

    // Host starts the game
    socket.on('start_game', async (roomCode) => {
        const room = rooms.get(roomCode);
        if (!room) return;
        if (socket.id !== room.hostId) {
            socket.emit('error', { message: 'Seul l\'hôte peut lancer la partie' });
            return;
        }
        if (room.players.length < 2) {
            socket.emit('error', { message: 'Il faut au moins 2 joueurs' });
            return;
        }

        console.log(`Starting game for room ${roomCode}`);
        room.covers = await fetchCoversForRoom();

        if (room.covers.length === 0) {
            socket.emit('error', { message: 'Impossible de charger les covers' });
            return;
        }

        io.to(roomCode).emit('game_starting');
        setTimeout(() => startRound(roomCode), 1500);
    });

    // Player submits a guess
    socket.on('submit_guess', ({ roomCode, albumTitle }) => {
        const room = rooms.get(roomCode);
        if (!room || room.gameState !== 'PLAYING') return;

        const targetTitle = room.currentRound.title.toLowerCase();
        const guessTitle = albumTitle.toLowerCase();

        // Fuzzy match
        if (guessTitle.includes(targetTitle) || targetTitle.includes(guessTitle)) {
            // Winner found!
            clearInterval(room.roundTimer);

            const winner = room.players.find(p => p.id === socket.id);
            if (winner) winner.score += 1;

            room.gameState = 'ROUND_END';
            io.to(roomCode).emit('round_end', {
                winner: winner ? { pseudo: winner.pseudo, id: winner.id } : null,
                answer: room.currentRound,
                players: room.players
            });

            console.log(`${winner?.pseudo} found the answer in room ${roomCode}`);

            // Auto-start next round after 3 seconds
            setTimeout(() => {
                if (rooms.has(roomCode)) startRound(roomCode);
            }, 3000);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const roomCode = socket.roomCode;
        if (!roomCode || !rooms.has(roomCode)) return;

        const room = rooms.get(roomCode);
        room.players = room.players.filter(p => p.id !== socket.id);

        if (room.players.length === 0) {
            // Delete empty room
            if (room.roundTimer) clearInterval(room.roundTimer);
            rooms.delete(roomCode);
            console.log(`Room ${roomCode} deleted (empty)`);
        } else {
            // Notify remaining players
            io.to(roomCode).emit('player_left', { players: room.players });

            // If host left, assign new host
            if (socket.id === room.hostId) {
                room.hostId = room.players[0].id;
                io.to(roomCode).emit('new_host', { hostId: room.hostId });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
