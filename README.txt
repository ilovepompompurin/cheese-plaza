CHEESE PLAZA — Online multiplayer social game
Requires Node.js 18 or newer. No npm install or external packages needed.
1. Extract this ZIP and open a terminal in the extracted cheese-plaza folder.
2. Run: node server.js
3. Open http://localhost:3000 in a browser. Open a second tab to test multiplayer.
To play over the internet, deploy the folder to a Node.js web host that supports long-lived HTTP/SSE connections. Set the start command to node server.js. The server uses the PORT environment variable if provided. Share the host's public URL or the in-game invite link. A localhost link only works on your own computer. On your local network, use your host computer's LAN IP and allow port 3000 through the firewall.
Prototype limitations: rooms are room codes, not authenticated private rooms. Chat and player state are temporary and lost on restart. No moderation, accounts, permanent storage, collision detection or functioning cafe/game lounge activities yet. Do not expose publicly to strangers without moderation and security improvements. Up to 40 users per room; capacity not load tested.
