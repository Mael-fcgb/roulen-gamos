import axios from 'axios';

// Using a proxy or direct depending on CORS. 
// Deezer API allows JSONP but axios creates XHR/Fetch. 
// For dev, we might need a proxy or rely on the server to fetch.
// Let's implement client-side first and check CORS. 
// If CORS fails, we'll route through our Node server (which is safer anyway).

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api'; // Use env var or default to local

export const searchTracks = async (query) => {
    try {
        const response = await axios.get(`${API_URL}/search`, {
            params: { q: query }
        });
        return response.data;
    } catch (error) {
        console.error("Search error", error);
        return [];
    }
};

export const fetchGameCovers = async () => {
    try {
        const response = await axios.get(`${API_URL}/covers`);
        return response.data;
    } catch (error) {
        console.error("Error fetching game covers:", error);
        return [];
    }
};
