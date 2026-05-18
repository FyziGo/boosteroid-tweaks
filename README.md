# Boosteroid Tweaks 🚀

[🇬🇧 English](README.md) | [🇷🇺 Русский](README.ru.md) | [🇺🇦 Українська](README.uk.md) | [🇪🇸 Español](README.es.md)

Boosteroid Tweaks is a powerful Userscript that significantly improves your experience with the [Boosteroid](https://cloud.boosteroid.com/) cloud gaming service.

The script adds capabilities for server management, robust protection against inactivity disconnections (Anti-AFK), and a convenient session statistics overlay.

## ✨ Features & Advantages

*   **🛡️ Multi-Mode Anti-AFK (Idle Disconnect Protection)**
    Forget about "Are you still there?" warnings and the 10-minute timeout. Features three modes: 'Off', 'Network Intercept' (instant socket replies without dialogs), and 'F15 Simulation' (safe hardware key simulation). Perfect for long gaming sessions or using Steam Remote Play.
*   **🌍 Server Manager (Lagging Data Center Blocker)**
    Ended up on a server with high ping or poor quality? The script automatically detects your current server and allows you to add it to a "blacklist". Next time you launch a game, the script will block the connection to the unwanted server, forcing Boosteroid to reroute you to a different data center.
*   **🎬 Video Codec Selector & Bitrate Limiter**
    Force your preferred video stream codec (H.265/HEVC, H.264, or AV1) and set a custom maximum bitrate via SDP manipulation to improve stream stability on slow networks.
*   **🚀 Skip Exit Screen**
    Automatically skips the post-game rating and feedback screen to immediately return you to the home menu.
*   **🎨 Clean UI**
    Settings are accessible by clicking the gear icon and are embedded directly into the Boosteroid page using Shadow DOM technology (which guarantees no conflicts with the site's own design).
*   **🌐 Multi-language**
    Supports English, Russian, Ukrainian, and Spanish, automatically matching your system language.

---

## ⚙️ How to Install

Installation takes just a couple of minutes:

1. **Install the Tampermonkey extension** for your browser (Chrome, Firefox, Edge, Safari, Opera supported):
   * [Tampermonkey for Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   * [Tampermonkey for Firefox](https://addons.mozilla.org/ru/firefox/addon/tampermonkey/)
   * [Tampermonkey for Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
   
2. **Install the script itself:**
   * Open the Tampermonkey extension and select **"Create a new script"**.
   * Delete all the contents in the opened editor.
   * Copy all the code from the `boosteroid_tweaks.user.js` file in this repository and paste it into the Tampermonkey editor.
   * Press `Ctrl+S` (or File -> Save) to save the script.

3. **Done!**
   * Go to [cloud.boosteroid.com](https://cloud.boosteroid.com/).
   * In the bottom left corner of the screen (or on the launch page), you will see the **Boosteroid Tweaks** ⚙️ icon. Click it to configure!

---

## 📝 How to use the Server Manager

1. Launch any game.
2. Open the **Boosteroid Tweaks** panel (the ⚙️ button).
3. In the **"Last Server"** section, you will see the address of the data center you are connected to (for example, `gw-par.boosteroid.com`).
4. If the server is performing poorly (high ping/packet loss), click the **"Block this server"** button.
5. End the session and launch the game again — the script will block the connection to that address, and Boosteroid will select a different data center for you.

---

## 👨‍💻 For Developers

The script uses advanced injection techniques:
* Overriding the `window.WebSocket` constructor to monitor and filter network traffic with Boosteroid servers (Anti-AFK and blocking).
* Using the WebRTC API (`RTCPeerConnection`) to gather native telemetry without delays.

**Disclaimer:** *This project is not an official Boosteroid product and is developed by the community. Use at your own risk.*
