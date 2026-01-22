<template>
  <div class="min-h-screen bg-gray-950 text-white font-sans selection:bg-green-500 selection:text-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
    
    <!-- Ambient Background -->
    <div class="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
        <div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600 rounded-full blur-[100px] animate-pulse"></div>
        <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-green-500 rounded-full blur-[100px] animate-pulse" style="animation-duration: 4s;"></div>
    </div>

    <!-- Header -->
    <header class="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10">
      <h1 @click="goHome" class="text-2xl font-black tracking-tighter italic cursor-pointer hover:scale-105 transition-transform">
        ROULEN<span class="text-green-500">GAMOS</span>
      </h1>
      <div v-if="gameState === 'PLAYING' || gameState === 'ROUND_END' || gameState === 'MULTI_PLAYING'" class="font-mono text-xl">
        {{ isMultiplayer ? '' : score + ' pts' }}
      </div>
    </header>

    <!-- Content -->
    <div class="z-10 w-full max-w-lg flex flex-col items-center gap-8 text-center transition-all duration-500">
        
        <!-- HOME VIEW -->
        <div v-if="gameState === 'HOME'" class="space-y-6">
            <h2 class="text-5xl md:text-6xl font-black leading-tight">
                DEVINE LA<br/>
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">COVER</span>
            </h2>
            <p class="text-gray-400 text-lg">Solo ou Contre tes potes.</p>
            
            <div class="flex flex-col gap-3 w-full">
                <button @click="startSoloGame" class="w-full py-4 bg-white text-black font-black text-xl rounded-full hover:scale-105 transition-transform">
                    MODE SOLO
                </button>
                <button @click="gameState = 'PSEUDO_INPUT'" class="w-full py-4 border border-white/20 text-white font-black text-xl rounded-full hover:bg-white/10 transition-colors">
                    MULTIJOUEUR
                </button>
            </div>
        </div>

        <!-- PSEUDO INPUT -->
        <div v-else-if="gameState === 'PSEUDO_INPUT'" class="space-y-6 w-full">
            <h2 class="text-3xl font-black">TON PSEUDO</h2>
            <input 
                v-model="myPseudo" 
                @keyup.enter="checkJoinOrCreate"
                type="text" 
                placeholder="Entre ton pseudo..."
                class="w-full px-6 py-4 bg-white/10 border border-white/20 rounded-full text-center text-xl font-bold focus:outline-none focus:border-green-500 transition-colors"
                maxlength="15"
            />
            <div class="flex flex-col gap-3">
                <button @click="createRoom" :disabled="!myPseudo.trim()" class="w-full py-4 bg-green-500 text-black font-black text-xl rounded-full hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    CRÉER UNE PARTIE
                </button>
                <button @click="gameState = 'JOIN_ROOM'" :disabled="!myPseudo.trim()" class="w-full py-4 border border-white/20 text-white font-black rounded-full hover:bg-white/10 transition-colors disabled:opacity-50">
                    REJOINDRE UNE PARTIE
                </button>
            </div>
            <button @click="goHome" class="text-gray-500 hover:text-white transition-colors">← Retour</button>
        </div>

        <!-- JOIN ROOM -->
        <div v-else-if="gameState === 'JOIN_ROOM'" class="space-y-6 w-full">
            <h2 class="text-3xl font-black">CODE DE LA SALLE</h2>
            <input 
                v-model="joinRoomCode" 
                @keyup.enter="joinRoom"
                type="text" 
                placeholder="XXXX"
                class="w-full px-6 py-4 bg-white/10 border border-white/20 rounded-full text-center text-3xl font-black uppercase tracking-widest focus:outline-none focus:border-green-500 transition-colors"
                maxlength="4"
            />
            <button @click="joinRoom" :disabled="joinRoomCode.length !== 4" class="w-full py-4 bg-green-500 text-black font-black text-xl rounded-full hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                REJOINDRE
            </button>
            <p v-if="errorMessage" class="text-red-400">{{ errorMessage }}</p>
            <button @click="gameState = 'PSEUDO_INPUT'" class="text-gray-500 hover:text-white transition-colors">← Retour</button>
        </div>

        <!-- LOBBY -->
        <div v-else-if="gameState === 'LOBBY'" class="space-y-6 w-full">
            <h2 class="text-3xl font-black">SALLE</h2>
            <div class="text-5xl font-black tracking-widest text-green-500">{{ roomCode }}</div>
            
            <div class="bg-white/5 p-4 rounded-xl border border-white/10">
                <button @click="copyLink" class="w-full py-3 bg-white/10 rounded-lg font-bold hover:bg-white/20 transition-colors flex items-center justify-center gap-2">
                    📋 {{ linkCopied ? 'Lien copié !' : 'Copier le lien d\'invitation' }}
                </button>
            </div>

            <div class="space-y-2">
                <p class="text-gray-400 text-sm uppercase tracking-widest">Joueurs ({{ players.length }})</p>
                <div class="space-y-2">
                    <div v-for="player in players" :key="player.id" class="bg-white/5 p-3 rounded-lg flex items-center justify-between">
                        <span class="font-bold">{{ player.pseudo }}</span>
                        <span v-if="player.id === hostId" class="text-xs bg-green-500 text-black px-2 py-1 rounded-full font-bold">HÔTE</span>
                    </div>
                </div>
            </div>

            <button 
                v-if="isHost" 
                @click="startMultiGame" 
                :disabled="players.length < 2"
                class="w-full py-4 bg-green-500 text-black font-black text-xl rounded-full hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {{ players.length < 2 ? 'EN ATTENTE DE JOUEURS...' : 'LANCER LA PARTIE' }}
            </button>
            <p v-else class="text-gray-400">En attente que l'hôte lance la partie...</p>
            <p v-if="errorMessage" class="text-red-400">{{ errorMessage }}</p>
        </div>

        <!-- MULTIPLAYER GAME VIEW -->
        <div v-else-if="gameState === 'MULTI_PLAYING' || gameState === 'MULTI_ROUND_END'" class="w-full flex flex-col items-center gap-6">
            
            <!-- Scoreboard -->
            <div class="w-full flex justify-center gap-4 flex-wrap">
                <div v-for="player in players" :key="player.id" 
                     :class="['px-4 py-2 rounded-full text-sm font-bold', player.id === mySocketId ? 'bg-green-500 text-black' : 'bg-white/10']">
                    {{ player.pseudo }}: {{ player.score }}
                </div>
            </div>

            <GameCanvas 
                :imageUrl="currentRound.cover" 
                :timeLeft="timeLeft" 
                :maxTime="20"
            />
            
            <SearchComponent 
                v-if="gameState === 'MULTI_PLAYING'"
                @guess="handleMultiGuess"
            />

            <div v-if="gameState === 'MULTI_ROUND_END'" class="space-y-4 animate-fade-in-up">
                <p class="text-2xl font-bold">
                    {{ roundWinner ? (roundWinner.id === mySocketId ? 'Tu as trouvé ! 🔥' : roundWinner.pseudo + ' a trouvé !') : 'Personne n\'a trouvé... 💀' }}
                </p>
                <div class="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center gap-4">
                    <img :src="currentRound.cover" class="w-16 h-16 rounded-lg shadow-sm" />
                    <div class="text-left">
                        <p class="font-bold text-lg">{{ currentRound.title }}</p>
                        <p class="text-gray-400">{{ currentRound.artist }}</p>
                    </div>
                </div>
                <p class="text-gray-400">Prochain round dans 3s...</p>
            </div>
        </div>

        <!-- GAME OVER (Multi) -->
        <div v-else-if="gameState === 'GAME_OVER'" class="space-y-6">
            <h2 class="text-5xl font-black">FIN DE PARTIE</h2>
            <div class="space-y-2">
                <div v-for="(player, index) in sortedPlayers" :key="player.id" 
                     :class="['p-4 rounded-xl flex items-center justify-between', index === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30' : 'bg-white/5']">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">{{ index === 0 ? '🏆' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : '')) }}</span>
                        <span class="font-bold text-lg">{{ player.pseudo }}</span>
                    </div>
                    <span class="font-black text-xl">{{ player.score }} pts</span>
                </div>
            </div>
            <button @click="goHome" class="w-full py-4 bg-white text-black font-black text-xl rounded-full hover:scale-105 transition-transform">
                RETOUR À L'ACCUEIL
            </button>
        </div>

        <!-- SOLO GAME VIEW -->
        <div v-else-if="gameState === 'PLAYING' || gameState === 'ROUND_END'" class="w-full flex flex-col items-center gap-6">
            
            <div v-if="gameState === 'PLAYING'" class="w-full flex justify-end">
                <button 
                  @click="handleSkip" 
                  class="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors border-b border-transparent hover:border-white pb-1"
                >
                  Passer ➔
                </button>
            </div>

            <GameCanvas 
                :imageUrl="currentRound.cover" 
                :timeLeft="timeLeft" 
                :maxTime="20"
            />
            
            <SearchComponent 
                v-if="gameState === 'PLAYING'"
                @guess="handleGuess"
            />

            <div v-if="gameState === 'ROUND_END'" class="space-y-4 animate-fade-in-up">
                <p class="text-2xl font-bold">
                    {{ roundResult === 'WIN' ? 'Bien joué ! 🔥' : (roundResult === 'SKIP' ? 'Passé ⏩' : 'Dommage... 💀') }}
                </p>
                <div class="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center gap-4">
                    <img :src="currentRound.cover" class="w-16 h-16 rounded-lg shadow-sm" />
                    <div class="text-left">
                        <p class="font-bold text-lg">{{ currentRound.title }}</p>
                        <p class="text-gray-400">{{ currentRound.artist }}</p>
                    </div>
                </div>
                <button @click="nextRound" class="px-8 py-3 bg-green-500 text-black font-bold rounded-full hover:bg-green-400 transition-colors">
                    Suivant ➔
                </button>
            </div>

        </div>

    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import GameCanvas from './components/GameCanvas.vue';
import SearchComponent from './components/SearchComponent.vue';
import { fetchGameCovers } from './services/api'; 
import { socket, connectSocket, disconnectSocket } from './services/socket';

// Game State
const gameState = ref('HOME');
const score = ref(0);
const roundResult = ref(null);
const isMultiplayer = ref(false);

// Multiplayer State
const myPseudo = ref('');
const mySocketId = ref('');
const roomCode = ref('');
const joinRoomCode = ref('');
const players = ref([]);
const hostId = ref('');
const roundWinner = ref(null);
const errorMessage = ref('');
const linkCopied = ref(false);

// Round Data
const currentRound = ref({
    cover: '',
    title: '',
    artist: '',
    id: null
});

// Timer
const timeLeft = ref(20);
let timerInterval = null;

const covers = ref([]);

// Computed
const isHost = computed(() => mySocketId.value === hostId.value);
const sortedPlayers = computed(() => [...players.value].sort((a, b) => b.score - a.score));

// Fallback covers
const FALLBACK_COVERS = [
    { title: "Destin", artist: "Ninho", cover: "https://e-cdns-images.dzcdn.net/images/cover/ac0ec199892ba83b2f8969a592530a79/500x500-000000-80-0-0.jpg", id: 1 },
    { title: "Ipséité", artist: "Damso", cover: "https://e-cdns-images.dzcdn.net/images/cover/79ba3cd515942d1dc62f49f859a374fd/500x500-000000-80-0-0.jpg", id: 2 },
    { title: "Cyborg", artist: "Nekfeu", cover: "https://e-cdns-images.dzcdn.net/images/cover/bac0ea75cfad929e85de82ee823cd638/500x500-000000-80-0-0.jpg", id: 3 },
    { title: "Civilisation", artist: "Orelsan", cover: "https://e-cdns-images.dzcdn.net/images/cover/974e863966461c44768f0732752695c9/500x500-000000-80-0-0.jpg", id: 4 },
];

// Check URL for room code on mount
onMounted(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoomCode = urlParams.get('room');
    if (urlRoomCode) {
        joinRoomCode.value = urlRoomCode.toUpperCase();
        gameState.value = 'PSEUDO_INPUT';
    }
    
    // Fetch covers for solo mode
    const fetchedCovers = await fetchGameCovers();
    if (fetchedCovers && fetchedCovers.length > 0) {
        covers.value = fetchedCovers;
    } else {
        covers.value = FALLBACK_COVERS;
    }
    
    // Socket event listeners
    setupSocketListeners();
});

onUnmounted(() => {
    disconnectSocket();
});

function setupSocketListeners() {
    socket.on('connect', () => {
        mySocketId.value = socket.id;
        console.log('Connected with ID:', socket.id);
    });
    
    socket.on('room_created', (data) => {
        roomCode.value = data.roomCode;
        players.value = data.players;
        hostId.value = socket.id;
        gameState.value = 'LOBBY';
    });
    
    socket.on('joined_success', (data) => {
        roomCode.value = data.roomCode;
        players.value = data.players;
        hostId.value = data.hostId;
        gameState.value = 'LOBBY';
    });
    
    socket.on('player_joined', (data) => {
        players.value = data.players;
    });
    
    socket.on('player_left', (data) => {
        players.value = data.players;
    });
    
    socket.on('new_host', (data) => {
        hostId.value = data.hostId;
    });
    
    socket.on('game_starting', () => {
        errorMessage.value = '';
    });
    
    socket.on('round_start', (data) => {
        currentRound.value = { cover: data.cover, title: '', artist: '' };
        timeLeft.value = data.timeLeft;
        players.value = data.players;
        roundWinner.value = null;
        gameState.value = 'MULTI_PLAYING';
    });
    
    socket.on('timer_tick', (time) => {
        timeLeft.value = time;
    });
    
    socket.on('round_end', (data) => {
        roundWinner.value = data.winner;
        currentRound.value = data.answer;
        players.value = data.players;
        timeLeft.value = 0;
        gameState.value = 'MULTI_ROUND_END';
    });
    
    socket.on('game_over', (data) => {
        players.value = data.players;
        gameState.value = 'GAME_OVER';
    });
    
    socket.on('error', (data) => {
        errorMessage.value = data.message;
    });
}

function checkJoinOrCreate() {
    if (joinRoomCode.value.length === 4) {
        gameState.value = 'JOIN_ROOM';
    }
}

function createRoom() {
    if (!myPseudo.value.trim()) return;
    isMultiplayer.value = true;
    connectSocket();
    socket.emit('create_room', myPseudo.value.trim());
}

function joinRoom() {
    if (!myPseudo.value.trim() || joinRoomCode.value.length !== 4) return;
    isMultiplayer.value = true;
    errorMessage.value = '';
    connectSocket();
    socket.emit('join_room', { roomCode: joinRoomCode.value.toUpperCase(), pseudo: myPseudo.value.trim() });
}

function startMultiGame() {
    socket.emit('start_game', roomCode.value);
}

function handleMultiGuess(album) {
    socket.emit('submit_guess', { roomCode: roomCode.value, albumTitle: album.title });
}

function copyLink() {
    const link = `${window.location.origin}${window.location.pathname}?room=${roomCode.value}`;
    navigator.clipboard.writeText(link);
    linkCopied.value = true;
    setTimeout(() => linkCopied.value = false, 2000);
}

// ============ SOLO MODE ============

const startSoloGame = () => {
    if (covers.value.length === 0) return;
    isMultiplayer.value = false;
    score.value = 0;
    nextRound();
};

const nextRound = async () => {
    gameState.value = 'PLAYING';
    roundResult.value = null;
    timeLeft.value = 20;
    
    if (covers.value.length === 0) {
        const fetchedCovers = await fetchGameCovers();
        if (fetchedCovers && fetchedCovers.length > 0) {
            covers.value = fetchedCovers;
        } else {
            covers.value = [...FALLBACK_COVERS];
        }
    }

    const randomIndex = Math.floor(Math.random() * covers.value.length);
    const random = covers.value[randomIndex];
    covers.value.splice(randomIndex, 1);
    currentRound.value = { ...random };
    startTimer();
};

const startTimer = () => {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft.value -= 0.1;
        timeLeft.value = Math.round(timeLeft.value * 10) / 10;
        
        if (timeLeft.value <= 0) {
            endRound('LOSS');
        }
    }, 100);
};

const endRound = (result) => {
    clearInterval(timerInterval);
    roundResult.value = result;
    gameState.value = 'ROUND_END';
    timeLeft.value = 0;
    
    if (result === 'WIN') score.value += 100 + Math.ceil(timeLeft.value * 10);
};

const handleSkip = () => {
    endRound('SKIP');
};

const handleGuess = (album) => {
    const targetTitle = currentRound.value.title.toLowerCase();
    const guessTitle = album.title.toLowerCase();
    
    if (guessTitle.includes(targetTitle) || targetTitle.includes(guessTitle)) {
        endRound('WIN');
    } else {
        console.log("Wrong guess", guessTitle, targetTitle);
    }
};

const goHome = () => {
    gameState.value = 'HOME';
    isMultiplayer.value = false;
    score.value = 0;
    if (timerInterval) clearInterval(timerInterval);
    timeLeft.value = 20;
    roundResult.value = null;
    currentRound.value = { cover: '', title: '', artist: '', id: null };
    roomCode.value = '';
    players.value = [];
    hostId.value = '';
    errorMessage.value = '';
    disconnectSocket();
};
</script>

<style>
.animate-fade-in-up {
    animation: fadeInUp 0.5s ease-out;
}
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>
