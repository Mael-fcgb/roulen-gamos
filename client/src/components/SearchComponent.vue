<template>
  <div class="relative w-full max-w-md">
    <input 
      type="text" 
      v-model="query"
      @input="onInput"
      placeholder="Guess the album..."
      class="w-full px-4 py-3 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/20 focus:outline-none focus:border-green-400 placeholder-white/50 transition-all font-semibold"
      :disabled="disabled"
    />
    
    <ul v-if="results.length > 0 && showResults" class="absolute top-full left-0 right-0 mt-2 bg-gray-900/90 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl max-h-60 overflow-y-auto z-10">
      <li 
        v-for="album in results" 
        :key="album.id" 
        @click="selectTrack(album)"
        class="px-4 py-3 hover:bg-white/10 cursor-pointer flex items-center gap-3 transition-colors border-b border-white/5 last:border-0"
      >
        <img :src="album.artist.picture_small" alt="" class="w-8 h-8 rounded-full" />
        <div class="flex flex-col text-left">
            <span class="text-white font-bold text-sm">{{ album.title }}</span>
            <span class="text-gray-400 text-xs">{{ album.artist.name }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { searchTracks } from '../services/api';
import debounce from 'lodash.debounce'; // Need to install lodash.debounce or write a util

const props = defineProps({
  disabled: Boolean
});

const emit = defineEmits(['guess']);

const query = ref('');
const results = ref([]);
const showResults = ref(false);

const onInput = debounce(async () => {
  if (query.value.length < 2) {
    results.value = [];
    return;
  }
  const data = await searchTracks(query.value);
  
  // Sort: Prioritize exact artist match, then "starts with"
  const lowerQuery = query.value.toLowerCase();
  
  data.sort((a, b) => {
    const artistA = a.artist.name.toLowerCase();
    const artistB = b.artist.name.toLowerCase();
    
    // 1. Exact Artist Match
    if (artistA === lowerQuery && artistB !== lowerQuery) return -1;
    if (artistA !== lowerQuery && artistB === lowerQuery) return 1;
    
    // 2. Artist Starts With Query
    const startA = artistA.startsWith(lowerQuery);
    const startB = artistB.startsWith(lowerQuery);
    if (startA && !startB) return -1;
    if (!startA && startB) return 1;
    
    return 0; // Keep original order
  });

  // data is now a list of albums directly from /search/album
  results.value = data.slice(0, 50); 
  showResults.value = true;
}, 300);

const selectTrack = (album) => {
  emit('guess', album); // We are guessing the Album
  query.value = '';
  showResults.value = false;
};

// Simple debounce implementation if lodash is not installed
function customDebounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Override onInput with custom if needed, but I'll assume I can install lodash or just use the custom one inline
</script>
