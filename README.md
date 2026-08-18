<div align="center">
  <img src="https://github.com/arvi-OpenSaas/music-playlist-transferer/blob/main/public/logo.png?text=HS" alt="Harmony Sync Logo" width="120" height="120">
  <h1>Harmony Sync 🎵</h1>
  <p><b>A robust, fully automated Chrome Extension for migrating playlists seamlessly across music providers.</b></p>
  
  <p>
    <img src="https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat-square&logo=google-chrome&logoColor=white" alt="Chrome Extension" />
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Spotify-API-1DB954?style=flat-square&logo=spotify&logoColor=white" alt="Spotify" />
    <img src="https://img.shields.io/badge/Apple_Music-Supported-FA243C?style=flat-square&logo=apple-music&logoColor=white" alt="Apple Music" />
  </p>
</div>

<br/>

<p align="center">
  <a href="https://www.buymeacoffee.com/urbro" target="_blank">
    <img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-%23ffdd00.svg?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee" height="45">
  </a>
</p>

## ✨ Features

* **Seamless Cross-Platform Migration:** Effortlessly transfer playlists between Apple Music, Spotify, and YouTube Music.
* **Smart Sequencing:** No more duplicate overwrites. Harmony Sync automatically detects existing migration playlists and increments their names (e.g., `Harmony Sync - Apple Music - 2`).
* **Robust Background Processing:** Built with a modern Service Worker architecture. Transfers run reliably in the background, surviving tab switches and UI closes.
* **Secure Authentication:** Implements secure OAuth PKCE flows for provider logins directly within the extension—no third-party servers required.
* **API-Native Extraction:** Uses official provider Web APIs (including Spotify's strict 2026 endpoint updates) rather than fragile DOM scraping.

---

## ⚠️ Important Prerequisites

**Spotify Premium is Required:** Due to Spotify's recent developer API changes, an active Spotify Premium subscription is required to read or write playlists using their official endpoints. If you are using Spotify as a source or a destination, the extension will verify your Premium status.

---

## 🚀 Installation (Developer Mode)

Since this extension is currently in active development, you can install it directly from the source code:

1. Clone this repository:
   ```bash
   git clone https://github.com/arvi-OpenSaas/music-playlist-transferer.git
