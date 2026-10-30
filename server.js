const express = require('express');
const querystring = require('querystring');
const app = express();

// Serve static HTML/CSS/JS files from this folder
app.use(express.static(__dirname));

// Your Spotify Credentials
const client_id = '06aab99918954b6f90155823d9de1257';
const client_secret = 'fb8b75ae26c440789a44776d1a9b4977'; // <-- Replace with your actual client secret
const redirect_uri = 'http://127.0.0.1:3000/select_audio.html';

// Global variable to store the access token for this session
global.spotifyAccessToken = '';

function generateRandomString(length) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// 1. Explicit login route
app.get('/login', function(req, res) {
    console.log('-> /login route was triggered!');
    var state = generateRandomString(16);
    var scope = 'user-read-private user-read-email';

    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
        }));
});

// 2. Token exchange route (trades the auth code for a token)
app.get('/get-token', async (req, res) => {
    const code = req.query.code;
    
    try {
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64')
            },
            body: new URLSearchParams({
                code: code,
                redirect_uri: redirect_uri,
                grant_type: 'authorization_code'
            })
        });

        const data = await tokenResponse.json();
        
        if (data.access_token) {
            global.spotifyAccessToken = data.access_token;
            console.log('Successfully acquired access token!');
            res.json({ success: true });
        } else {
            console.error('Failed to get token:', data);
            res.status(400).json({ error: 'Failed to get token', details: data });
        }
    } catch (error) {
        console.error('Token exchange error:', error);
        res.status(500).json({ error: 'Server error during token exchange' });
    }
});

// 3. Search route
app.get('/search', async (req, res) => {
    const searchQuery = req.query.q;
    const accessToken = global.spotifyAccessToken; 

    if (!accessToken) {
        return res.status(401).json({ error: 'No access token available. Please log in first.' });
    }

    try {
        const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track,show`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Spotify Search Error:', error);
        res.status(500).json({ error: 'Failed to fetch search results' });
    }
});

// 4. Start the server (Must be at the bottom)
app.listen(3000, function() {
    console.log('Server is running on http://127.0.0.1:3000');
});

// Make sure this is near the top of server.js with your other middleware
app.use(express.json());

// Add this route to trigger playback via Spotify API
app.post('/play-alarm', async (req, res) => {
    const { trackUri } = req.body;
    const accessToken = global.spotifyAccessToken;

    if (!accessToken) {
        return res.status(401).json({ error: 'No access token available.' });
    }

    try {
        const response = await fetch('https://api.spotify.com/v1/me/player/play', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uris: [trackUri]
            })
        });

        // Spotify returns 204 No Content on successful playback commands
        if (response.status === 204 || response.ok) {
            res.json({ success: true });
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('Spotify Playback Error:', errorData);
            res.status(400).json({ error: 'Failed to play track. Ensure Spotify is open on an active device.', details: errorData });
        }
    } catch (error) {
        console.error('Server Playback Error:', error);
        res.status(500).json({ error: 'Server error during playback' });
    }
});