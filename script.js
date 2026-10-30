// Declare them only ONCE at the very top of your file
let currentSelectedTrackUri = null;
let currentSelectedTrackName = null;

function CreateNewAlarm() {
    location.replace("create_alarm.html");
}

function proceedToSelectAudio() {
    const alarmTime = document.getElementById('alarm-time').value;
    if (!alarmTime) {
        alert('Please select a time for your alarm!');
        return;
    }

    localStorage.setItem('tempAlarmTime', alarmTime);
    location.replace("select_audio.html");
}

function SpotifyLogin() {
    window.location.href = '/login';
}

// Runs automatically when the page loads
document.addEventListener('DOMContentLoaded', () => {

    if (document.getElementById('saved-alarms-container')) {
        showSavedAlarms();
    }

    const urlParams = new URLSearchParams(window.location.search);
    const authorizationCode = urlParams.get('code');
    const loginButton = document.getElementById('spotify-login');

    if (authorizationCode && loginButton) {
        console.log('Authorization code found:', authorizationCode);
        
        // Send the code to our backend to trade it for an access token
        fetch(`/get-token?code=${authorizationCode}`)
            .then(res => res.json())
            .then(data => {
                if (data.success && loginButton) {
                    loginButton.style.backgroundColor = 'green';
                    loginButton.style.color = '#fff';
                    loginButton.textContent = 'Connected to Spotify';
                    loginButton.disabled = true;
                    console.log('App is fully authenticated with Spotify!');
                }
            })
            .catch(err => console.error('Error exchanging token:', err));

    } else {
        console.log('No authorization code found in the URL.');
        if (loginButton) {
            loginButton.style.backgroundColor = ''; 
            loginButton.style.color = '';
            loginButton.textContent = 'Connect to Spotify';
            loginButton.disabled = false;
        }
    }
}); 

function openTrackSelector() {
    const trackUri = document.getElementById('search-input-result').value; 
    const playTime = document.getElementById('alarm-time-input').value; 
}

function searchSpotify() {
    const query = document.getElementById('search-query').value;
    
    if (!query) {
        alert('Please enter a search term!');
        return;
    }

    // Send the search query to your backend server
    fetch(`/search?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            if (data.tracks && data.tracks.items) {
                displayResults(data.tracks.items);
            } else {
                console.error('Unexpected response format or unauthenticated:', data);
            }
        })
        .catch(error => {
            console.error('Error searching Spotify:', error);
        });
}

function displayResults(tracks) {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = ''; // Clear previous results

    tracks.forEach(track => {
        const trackElement = document.createElement('div');
        trackElement.style.margin = '10px 0';
        trackElement.innerHTML = `
            <span>🎵 <strong>${track.name}</strong> by ${track.artists[0].name}</span>
            <button onclick="selectTrack('${track.uri}', '${track.name}')">Select for Alarm</button>
        `;
        resultsContainer.appendChild(trackElement);
    });
}

function selectTrack(trackUri, trackName) {
    currentSelectedTrackUri = trackUri;
    currentSelectedTrackName = trackName;
    console.log('DEBUG: Selected track URI:', trackName, trackUri);
    alert(`Selected: ${trackName}! Saved for your alarm.`);
}

function completeAlarmCreation() {
    const alarmTime = localStorage.getItem('tempAlarmTime');

    if (!alarmTime) {
        alert('Alarm time was not found. Please start from Create Alarm.');
        location.replace("create_alarm.html");
        return;
    }
    if (!currentSelectedTrackUri) {
        alert('Please search and select a song/podcast first!');
        return;
    }

    // Get existing alarms or start a new array
    let savedAlarms = JSON.parse(localStorage.getItem('savedAlarms')) || [];

    // Push the new alarm object
    savedAlarms.push({
        time: alarmTime,
        trackUri: currentSelectedTrackUri,
        trackName: currentSelectedTrackName
    });

    // Save back to storage and clean up temp value
    localStorage.setItem('savedAlarms', JSON.stringify(savedAlarms));
    localStorage.removeItem('tempAlarmTime');

    // Go to saved alarms page
    location.replace("saved_alarms.html");
}

function Index() {
    location.replace("index.html");
}

function savedAlarms() {
    location.replace("saved_alarms.html");
}

function showSavedAlarms() {
    const container = document.getElementById('saved-alarms-container');
    if (!container) return; // Safely exits if the container isn't on the current page

    const savedAlarms = JSON.parse(localStorage.getItem('savedAlarms')) || [];
    
    container.innerHTML = '';
    if (savedAlarms.length === 0) {
        container.innerHTML = '<p>No saved alarms yet.</p>';
        return;
    }

    savedAlarms.forEach((alarm, index) => {
        const alarmItem = document.createElement('div');
        alarmItem.style.margin = '10px 0';
        alarmItem.style.padding = '10px';
        alarmItem.style.background = '#f4f4f4';
        alarmItem.style.borderRadius = '5px';
        alarmItem.innerHTML = `
            <span>⏰ <strong>${alarm.time}</strong> — 🎵 ${alarm.trackName}</span>
        `;
        container.appendChild(alarmItem);
    });
}

// Function to trigger playback on the backend
function triggerAlarmPlayback(trackUri, trackName) {
    fetch('/play-alarm', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ trackUri: trackUri })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(`⏰ ALARM! Now playing: ${trackName}`);
        } else {
            console.error('Could not start playback:', data);
            alert(`⏰ ALARM TIME! (Make sure your Spotify app is open and active to play: ${trackName})`);
        }
    })
    .catch(err => console.error('Error triggering alarm playback:', err));
}

// Background Clock Checker (Runs every 10 seconds)
setInterval(() => {
    const savedAlarms = JSON.parse(localStorage.getItem('savedAlarms')) || [];
    if (savedAlarms.length === 0) return;

    // Get current time in HH:MM format (24-hour format matching <input type="time">)
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;

    // Get today's date string to prevent the alarm from triggering multiple times in the same minute
    const todayDate = now.toISOString().split('T')[0];

    savedAlarms.forEach((alarm) => {
        // Create a unique tracking key for today's alarm trigger
        const triggerKey = `triggered_${alarm.time}_${todayDate}`;
        const alreadyTriggered = localStorage.getItem(triggerKey);

        if (alarm.time === currentTime && !alreadyTriggered) {
            console.log(`Alarm triggered for time: ${alarm.time}`);
            
            // Mark as triggered for today so it doesn't loop repeatedly this minute
            localStorage.setItem(triggerKey, 'true');

            // Play the track
            triggerAlarmPlayback(alarm.trackUri, alarm.trackName);
        }
    });
}, 10000); // Checks every 10 seconds