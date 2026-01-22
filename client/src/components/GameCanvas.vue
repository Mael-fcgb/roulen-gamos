<template>
  <div class="relative w-full max-w-md aspect-square overflow-hidden rounded-lg shadow-2xl bg-black">
    <canvas 
      ref="canvasRef"
      class="w-full h-full object-contain"
    ></canvas>
    
    <!-- Timer Overlay -->
    <div v-if="timeLeft !== null" class="absolute top-2 right-2 bg-black/50 text-white px-3 py-1 rounded-full font-mono text-xl backdrop-blur-sm">
      {{ Math.ceil(timeLeft) }}s
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';

const props = defineProps({
  imageUrl: {
    type: String,
    required: true
  },
  timeLeft: {
    type: Number,
    default: 20
  },
  maxTime: {
    type: Number,
    default: 20
  }
});

const canvasRef = ref(null);
const imageObj = new Image();
let isImageLoaded = false;

// Load image when url changes
watch(() => props.imageUrl, (newUrl) => {
    isImageLoaded = false;
    imageObj.crossOrigin = "Anonymous";
    if (!newUrl) {
        console.warn("GameCanvas: Received empty imageUrl");
        return;
    }
    console.log("GameCanvas: Loading image:", newUrl);
    imageObj.src = newUrl;
    imageObj.onload = () => {
        console.log("GameCanvas: Image loaded successfully");
        isImageLoaded = true;
        drawPixelated();
    };
    imageObj.onerror = (err) => {
        console.error("GameCanvas: Failed to load image", newUrl, err);
    };
}, { immediate: true });

// Redraw when time changes
watch(() => props.timeLeft, () => {
    if (isImageLoaded) drawPixelated();
});

const drawPixelated = () => {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match display size (or fixed size)
    // Using a fixed size for the canvas helps with performance and consistency
    const size = 500; 
    canvas.width = size;
    canvas.height = size;
    
    // Calculate pixelation factor
    // 10s left -> 4px (very blocky)
    // 0s left -> size (full res) or sufficiently large
    
    let pixelCount;
    if (props.timeLeft <= 0) {
        pixelCount = size; // Full resolution
    } else {
        const progress = 1 - (props.timeLeft / props.maxTime); // 0 to 1
        // Start with very few pixels (e.g., 4x4 grid) and grow exponentially or linearly
        // Let's try exponential to keep it hard at first
        const minPixels = 5;
        const maxPixels = 100; // Cap at 100 for "almost clear" before reveal
        
        pixelCount = Math.floor(minPixels + (maxPixels - minPixels) * (progress * progress));
    }

    // Draw small to offscreen/temp, then scale up
    // Actually we can just draw small to the main canvas then draw that back to itself scaled up
    
    // 1. Turn off smoothing
    ctx.imageSmoothingEnabled = false;

    // 2. Draw scaled down
    const w = pixelCount;
    const h = pixelCount;
    
    // We need to maintain aspect ratio if image is not square? 
    // The container is square. Let's fit the image.
    
    // Clear
    ctx.clearRect(0, 0, size, size);

    // Draw image to small size
    // Create a temporary canvas for the small drawing to avoid clearing the main one mid-frame if we want to get fancy, 
    // but drawing directly is fine.
    
    // Helper to draw image cover style
    // Calculate aspect ratios
    const imgAspect = imageObj.width / imageObj.height;
    const canvasAspect = canvas.width / canvas.height;
    let renderW, renderH, offsetX, offsetY;

    if (imgAspect < canvasAspect) {
        renderW = canvas.width;
        renderH = canvas.width / imgAspect;
        offsetX = 0;
        offsetY = (canvas.height - renderH) / 2;
    } else {
        renderH = canvas.height;
        renderW = canvas.height * imgAspect;
        offsetY = 0;
        offsetX = (canvas.width - renderW) / 2;
    }
    
    // For pixelation, we want to draw the whole image into a tiny w x h grid, then scale that up.
    // If we just draw the image scaled down, we lose the "crop to cover" effect unless we crop first.
    // Simpler approach: Draw image full size to canvas (cropped to cover), then pixelate THAT result?
    // Or: Draw image to small canvas using cover logic, then draw small canvas to big canvas.
    
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = w;
    smallCanvas.height = h;
    const smallCtx = smallCanvas.getContext('2d');
    smallCtx.imageSmoothingEnabled = false;

    // Draw image to small canvas (cover)
    // We need to calculate how to draw imageObj onto smallCanvas (w x h) while maintaining aspect ratio and covering
    let smallRenderW, smallRenderH, smallOffsetX, smallOffsetY;
    
    if (imgAspect < (w/h)) {
         smallRenderW = w;
         smallRenderH = w / imgAspect;
         smallOffsetX = 0;
         smallOffsetY = (h - smallRenderH) / 2;
    } else {
         smallRenderH = h;
         smallRenderW = h * imgAspect;
         smallOffsetY = 0;
         smallOffsetX = (w - smallRenderW) / 2;
    }
    
    smallCtx.drawImage(imageObj, smallOffsetX, smallOffsetY, smallRenderW, smallRenderH);
    
    // Draw small canvas to big canvas
    ctx.drawImage(smallCanvas, 0, 0, w, h, 0, 0, size, size);
};

</script>

<style scoped>
canvas {
  image-rendering: pixelated; /* Essential for CSS scaling too */
}
</style>
