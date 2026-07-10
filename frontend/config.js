const TUNNEL_API_BASE_URL = "https://goes-bulletin-hartford-registration.trycloudflare.com";
const API_BASE_URL = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ? "http://localhost:8000"
  : TUNNEL_API_BASE_URL;