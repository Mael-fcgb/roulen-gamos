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
      <div v-if="gameState === 'PLAYING'" class="font-mono text-xl">
        {{ score }} pts
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
                <button class="w-full py-4 border border-white/20 text-white font-black text-xl rounded-full hover:bg-white/10 transition-colors opacity-50 cursor-not-allowed">
                    MULTIJOUEUR (Bientôt)
                </button>
            </div>
        </div>

        <!-- GAME VIEW -->
        <div v-else-if="gameState === 'PLAYING' || gameState === 'ROUND_END'" class="w-full flex flex-col items-center gap-6">
            
            <!-- SKIP BUTTON (Top Right of game area) -->
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
import { ref, computed, onMounted } from 'vue';
import GameCanvas from './components/GameCanvas.vue';
import SearchComponent from './components/SearchComponent.vue';
import { searchTracks, fetchGameCovers } from './services/api'; 

// Game State
const gameState = ref('HOME'); // HOME, PLAYING, ROUND_END
const score = ref(0);
const roundResult = ref(null); // WIN, LOSS, SKIP

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

// Fallback covers in case API fails
const FALLBACK_COVERS = [
    { title: "Destin", artist: "Ninho", cover: "https://e-cdns-images.dzcdn.net/images/cover/ac0ec199892ba83b2f8969a592530a79/500x500-000000-80-0-0.jpg", id: 1 },
    { title: "Ipséité", artist: "Damso", cover: "https://e-cdns-images.dzcdn.net/images/cover/79ba3cd515942d1dc62f49f859a374fd/500x500-000000-80-0-0.jpg", id: 2 },
    { title: "Cyborg", artist: "Nekfeu", cover: "https://e-cdns-images.dzcdn.net/images/cover/bac0ea75cfad929e85de82ee823cd638/500x500-000000-80-0-0.jpg", id: 3 },
    { title: "Civilisation", artist: "Orelsan", cover: "https://e-cdns-images.dzcdn.net/images/cover/974e863966461c44768f0732752695c9/500x500-000000-80-0-0.jpg", id: 4 },
];

onMounted(async () => {
  const fetchedCovers = await fetchGameCovers();
  if (fetchedCovers && fetchedCovers.length > 0) {
    covers.value = fetchedCovers;
  } else {
    covers.value = FALLBACK_COVERS;
  }
});

const startSoloGame = () => {
    if (covers.value.length === 0) return;
    score.value = 0;
    nextRound();
};

const nextRound = async () => {
    gameState.value = 'PLAYING';
    roundResult.value = null;
    timeLeft.value = 20;
    
    // Check if we need to refill
    if (covers.value.length === 0) {
        const fetchedCovers = await fetchGameCovers();
        if (fetchedCovers && fetchedCovers.length > 0) {
            covers.value = fetchedCovers;
        } else {
            // If refill fails, use fallback or show game over (using fallback for now)
            covers.value = [...FALLBACK_COVERS];
        }
    }

    // Pick random cover and REMOVE it from pool (No Repeats)
    const randomIndex = Math.floor(Math.random() * covers.value.length);
    const random = covers.value[randomIndex];
    
    // Remove from array so it doesn't come back
    covers.value.splice(randomIndex, 1);

    currentRound.value = { ...random };

    startTimer();
};

const startTimer = () => {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft.value -= 0.1;
        // Float precision fix
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
    // Reveal fully (set time left to 0 for canvas update)
    timeLeft.value = 0;
    
    if (result === 'WIN') score.value += 100 + Math.ceil(timeLeft.value * 10);
};

const handleSkip = () => {
    endRound('SKIP');
};

const handleGuess = (album) => {
    // Basic fuzzy match or direct ID match if we had correct IDs.
    // Since we mock, let's just match Title or Artist vaguely for now, or assume the mock data matches API result structure.
    
    // In real app, we should compare IDs.
    // Since mock IDs might not match Deezer IDs, we'll try to match Title loosely.
    
    const targetTitle = currentRound.value.title.toLowerCase();
    const guessTitle = album.title.toLowerCase();
    
    if (guessTitle.includes(targetTitle) || targetTitle.includes(guessTitle)) {
        endRound('WIN');
    } else {
        // Penalty or shake effect?
        console.log("Wrong guess", guessTitle, targetTitle);
    }
};

const goHome = () => {
    gameState.value = 'HOME';
    score.value = 0;
    if (timerInterval) clearInterval(timerInterval);
    timeLeft.value = 20;
    roundResult.value = null;
    currentRound.value = { cover: '', title: '', artist: '', id: null };
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
