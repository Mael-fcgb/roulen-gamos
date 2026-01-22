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

// Store rooms and basic game state
// roomCode => { players: [], gameState: 'WAITING'|'PLAYING', currentRound: 0, ... }
const rooms = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', () => {
        // Generate simple 4-char room code
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms.set(roomCode, {
            players: [{ id: socket.id, score: 0, name: 'Host' }],
            gameState: 'WAITING',
            currentImage: null
        });
        socket.join(roomCode);
        socket.emit('room_created', roomCode);
    });

    socket.on('join_room', (roomCode) => {
        if (rooms.has(roomCode)) {
            const room = rooms.get(roomCode);
            room.players.push({ id: socket.id, score: 0, name: `Player ${room.players.length + 1}` });
            socket.join(roomCode); // User joins the socket room
            io.to(roomCode).emit('player_joined', room.players); // Notify everyone in room
            socket.emit('joined_success', roomCode);
        } else {
            socket.emit('error', 'Room not found');
        }
    });

    socket.on('start_game', async (roomCode) => {
        if (rooms.has(roomCode)) {
            console.log("Starting game for room", roomCode);
            const room = rooms.get(roomCode);
            room.gameState = 'PLAYING';
            // Mock fetch simple image
            // In real implementation, this comes from Deezer API
            room.currentImage = {
                cover: "https://e-cdns-images.dzcdn.net/images/cover/2e018122cb56c86277102d506a77d33b/500x500-000000-80-0-0.jpg",
                artist: "Eminem",
                title: "The Eminem Show"
            };

            io.to(roomCode).emit('game_started', room.currentImage);

            // Start countdown logic here if needed
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Cleanup logic would go here
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
