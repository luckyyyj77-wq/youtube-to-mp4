const TUNNEL_API_BASE_URL = "https://cas-jerusalem-networking-main.trycloudflare.com";
const API_BASE_URL = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ? "http://localhost:8000"
  : TUNNEL_API_BASE_URL;