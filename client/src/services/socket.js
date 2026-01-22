import { io } from 'socket.io-client';

const PROD_URL = 'https://roulen-gamos-server.onrender.com';
const isNetlify = window.location.hostname.includes('netlify.app');
const SOCKET_URL = import.meta.env.VITE_API_URL || (isNetlify ? PROD_URL : 'http://localhost:3000');

console.log('Socket se connecte à:', SOCKET_URL);

export const socket = io(SOCKET_URL, {
    autoConnect: false
});

export const connectSocket = () => {
    if (!socket.connected) {
        socket.connect();
    }
};

export const disconnectSocket = () => {
    if (socket.connected) {
        socket.disconnect();
    }
};
