import axios from 'axios';

// Using a proxy or direct depending on CORS. 
// Deezer API allows JSONP but axios creates XHR/Fetch. 
// For dev, we might need a proxy or rely on the server to fetch.
// Let's implement client-side first and check CORS. 
// If CORS fails, we'll route through our Node server (which is safer anyway).

const PROD_URL = 'https://roulen-gamos-server.onrender.com';
const isNetlify = window.location.hostname.includes('netlify.app');
const API_URL = (import.meta.env.VITE_API_URL || (isNetlify ? PROD_URL : 'http://localhost:3000')) + '/api';

console.log("Connecté au serveur API:", API_URL);

export const searchTracks = async (query) => {
    try {
        const response = await axios.get(`${API_URL}/search`, {
            params: { q: query }
        });
        return response.data;
    } catch (error) {
        console.error("Search error at " + API_URL, error.message);
        return [];
    }
};

export const fetchGameCovers = async () => {
    try {
        console.log("Fetching game covers from:", `${API_URL}/covers`);
        const response = await axios.get(`${API_URL}/covers`);
        console.log("Successfully fetched covers:", response.data.length);
        return response.data;
    } catch (error) {
        console.error("Error fetching game covers at " + API_URL, error.message);
        if (error.code === 'ERR_NETWORK') {
            console.error("Network error: Is the backend server running and accessible?");
        }
        return [];
    }
};
