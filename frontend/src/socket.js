import { io } from 'socket.io-client';

// For multi-laptop/LAN setups, set REACT_APP_GATEWAY_URL at build/start time.
// Example: REACT_APP_GATEWAY_URL=http://192.168.1.50:3000 npm start
const gatewayUrl =
  process.env.REACT_APP_GATEWAY_URL || 'http://localhost:3000';

console.log('Frontend using gateway URL:', gatewayUrl);

const socket = io(gatewayUrl); // Gateway
export default socket;
