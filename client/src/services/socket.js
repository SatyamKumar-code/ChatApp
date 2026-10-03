import { io } from "socket.io-client";

const serverUrl = import.meta.env.VITE_SERVER_URL;

if (!serverUrl) {
  throw new Error("VITE_SERVER_URL is not configured");
}

const socket = io(serverUrl, {
  withCredentials: true,
  autoConnect: false,
});

export default socket;