document.addEventListener('DOMContentLoaded', () => {
    // Theme switcher logic
    const darkModeBtn = document.getElementById('dark-mode-btn');
    const lightModeBtn = document.getElementById('light-mode-btn');
    const body = document.body;

    // Function to set theme
    function setTheme(theme) {
        if (theme === 'light') {
            body.classList.remove('dark-mode');
            body.classList.add('light-mode');
            lightModeBtn.classList.add('active');
            lightModeBtn.disabled = true;
            darkModeBtn.classList.remove('active');
            darkModeBtn.disabled = false;
        } else {
            body.classList.remove('light-mode');
            body.classList.add('dark-mode');
            darkModeBtn.classList.add('active');
            darkModeBtn.disabled = true;
            lightModeBtn.classList.remove('active');
            lightModeBtn.disabled = false;
        }
        localStorage.setItem('theme', theme);
    }

    // Load saved theme or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);

    // Theme button event listeners
    darkModeBtn.addEventListener('click', () => setTheme('dark'));
    lightModeBtn.addEventListener('click', () => setTheme('light'));

    // Artist Search Logic
    const artistSearchInput = document.getElementById('artist-search-input');
    const artistSearchButton = document.getElementById('artist-search-button');
    const artistResultsContainer = document.getElementById('artist-results-container');
    const gameContainer = document.getElementById('game-container');
    const feedbackArea = document.getElementById('feedback-area'); // Moved for wider scope

    // API details will be added here for the new service
    let currentArtistDetails = null; // Will store { id, name, image, songs: [] }
    let currentSong = null;
    let currentScore = 0;
    let lastPlaybackDuration = 0;

    const DEEZER_API_BASE_URL = 'https://api.deezer.com';
    // Using a CORS proxy for development. Replace with your own or a server-side solution for production.
    const CORS_PROXY_BASE = 'https://api.codetabs.com/v1/proxy?quest='; 

    async function searchArtists(query) {
        artistResultsContainer.innerHTML = '<p>Searching...</p>';
        try {
            const targetUrl = `${DEEZER_API_BASE_URL}/search/artist?q=${encodeURIComponent(query)}`;
            const response = await fetch(`${CORS_PROXY_BASE}${encodeURIComponent(targetUrl)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            displayArtistResults(data.data);
        } catch (error) {
            console.error('Error searching artists:', error);
            artistResultsContainer.innerHTML = '<p>Error searching for artists. Please try again.</p>';
        }
    }

    function displayArtistResults(artists) {
        artistResultsContainer.innerHTML = ''; // Clear previous results
        if (!artists || artists.length === 0) {
            artistResultsContainer.innerHTML = '<p>No artists found.</p>';
            return;
        }

        const ul = document.createElement('ul');
        ul.className = 'artist-list';
        artists.slice(0, 10).forEach(artist => { // Display top 10 results
            const li = document.createElement('li');
            li.className = 'artist-item';
            li.innerHTML = `
                <img src="${artist.picture_small}" alt="${artist.name}" class="artist-item-image">
                <span class="artist-item-name">${artist.name}</span>
            `;
            li.addEventListener('click', () => selectArtist(artist.id, artist.name, artist.picture_medium));
            ul.appendChild(li);
        });
        artistResultsContainer.appendChild(ul);
    }

    artistSearchButton.addEventListener('click', () => {
        const query = artistSearchInput.value.trim();
        if (query) {
            searchArtists(query); // Changed from searchArtistsSpotify
        }
    });

    async function getArtistTracks(artistId) {
        try {
            // Fetch top tracks for the artist
            const targetUrl = `${DEEZER_API_BASE_URL}/artist/${artistId}/top?limit=50`;
            const response = await fetch(`${CORS_PROXY_BASE}${encodeURIComponent(targetUrl)}`); // Fetch up to 50 top tracks
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            // Filter tracks that have a preview URL
            return data.data ? data.data.filter(track => track.preview && track.preview !== '') : [];
        } catch (error) {
            console.error('Error fetching artist tracks:', error);
            document.getElementById('feedback-area').textContent = 'Error fetching tracks. Please try again.';
            return [];
        }
    }

    async function selectArtist(artistId, artistName, artistImage) {
        document.getElementById('game-artist-image').src = artistImage;
        document.getElementById('game-artist-name').textContent = artistName;
        artistResultsContainer.innerHTML = ''; // Clear search results
        artistSearchInput.value = ''; // Clear search input

        // const tracks = await getArtistTopTracks(artistId); // Old Spotify call
        const tracks = await getArtistTracks(artistId); // New API call placeholder
        if (tracks.length === 0) {
            document.getElementById('feedback-area').textContent = 'No playable song previews found for this artist.';
            gameContainer.style.display = 'none';
            return;
        }

        currentArtistDetails = {
            id: artistId,
            name: artistName,
            image: artistImage,
            songs: tracks.map(track => ({ title: track.title, preview: track.preview })) // Adjusted for Deezer's track object structure
        };
        gameContainer.style.display = 'block';
        loadNewSong();
    }

    function loadNewSong() {
        if (!currentArtistDetails || currentArtistDetails.songs.length === 0) {
            document.getElementById('feedback-area').textContent = 'No songs available for the selected artist.';
            // Optionally hide game container or show a message
            return;
        }
        const songs = currentArtistDetails.songs;
        currentSong = songs[Math.floor(Math.random() * songs.length)];
        // Ensure the audio preview URL uses HTTPS
        const previewUrl = currentSong.preview.replace('http://', 'https://');
        document.getElementById('song-snippet-audio').src = previewUrl;
        document.getElementById('song-guess-input').value = '';
        document.getElementById('feedback-area').textContent = 'Ready to play! Choose a duration.';
        resetPlaybackButtons();
    }

    // Playback Controls
    const audioElement = document.getElementById('song-snippet-audio');
    const play1sButton = document.getElementById('play-1s-button');
    const play3sButton = document.getElementById('play-3s-button');
    const play5sButton = document.getElementById('play-5s-button');
    const skipButton = document.getElementById('skip-button'); // Added skip button
    let buttonRevealTimer1 = null;
    let buttonRevealTimer2 = null;

    function resetPlaybackButtons() {
        play1sButton.style.display = 'inline-block';
        play3sButton.style.display = 'none';
        play5sButton.style.display = 'none';

        clearTimeout(buttonRevealTimer1);
        clearTimeout(buttonRevealTimer2);

        buttonRevealTimer1 = setTimeout(() => {
            play3sButton.style.display = 'inline-block';
        }, 10000); // Show 3s button after 10 seconds

        buttonRevealTimer2 = setTimeout(() => {
            play5sButton.style.display = 'inline-block';
        }, 20000); // Show 5s button after 20 seconds (10s after 3s button)
    }
    
    function playSnippet(duration) {
        if (!currentSong) return;
        lastPlaybackDuration = duration;
        audioElement.currentTime = 0;
        audioElement.play();
        setTimeout(() => audioElement.pause(), duration * 1000);
    }

    document.getElementById('play-1s-button').addEventListener('click', () => playSnippet(1));
    document.getElementById('play-3s-button').addEventListener('click', () => playSnippet(3));
    document.getElementById('play-5s-button').addEventListener('click', () => playSnippet(5));

    // Skip button event listener
    skipButton.addEventListener('click', () => {
        if (currentSong) {
            currentScore -= 2; // Penalty for skipping, adjust as needed
            document.getElementById('current-score').textContent = currentScore;
            feedbackArea.textContent = 'Song skipped! -2 points.';
            loadNewSong();
        }
    });

    // Guess Submission
    function normalizeTitle(title) {
        if (!title) return '';
        // Convert to lowercase
        let normalized = title.toLowerCase();
        // Remove content in parentheses (e.g., feat, remix, version)
        normalized = normalized.replace(/\s*\([^)]*\)/g, '');
        // Remove common punctuation that might cause mismatches, but keep spaces
        normalized = normalized.replace(/[\.,'"!\?&\-#]/g, '');
        // Remove extra spaces that might have been created
        normalized = normalized.replace(/\s+/g, ' ').trim();
        return normalized;
    }

    document.getElementById('submit-guess-button').addEventListener('click', () => {
        if (!currentSong) return;

        const userGuess = document.getElementById('song-guess-input').value;
        const actualTitle = currentSong.title;

        const normalizedGuess = normalizeTitle(userGuess);
        const normalizedActual = normalizeTitle(actualTitle);
        
        // feedbackArea is now declared at a higher scope

        if (normalizedGuess === normalizedActual && normalizedGuess !== '') {
            let points = 0;
            switch (lastPlaybackDuration) {
                case 1: points = 10; break;
                case 3: points = 5; break;
                case 5: points = 2; break;
                default: points = 1;
            }
            currentScore += points;
            document.getElementById('current-score').textContent = currentScore;
            feedbackArea.textContent = `Correct! +${points} points`;
            clearTimeout(buttonRevealTimer1);
            clearTimeout(buttonRevealTimer2);
            loadNewSong(); // This will call resetPlaybackButtons()
        } else {
            feedbackArea.textContent = 'Wrong guess. Try again!';
        }
    });

    // No API token initialization needed for basic Deezer public API calls used here.

    // Initialize with random gradient background
    function setRandomGradientBackground() {
        const h1 = Math.floor(Math.random() * 360);
        const h2 = Math.floor(Math.random() * 360);
        const angle = Math.floor(Math.random() * 360);
        body.style.background = `linear-gradient(${angle}deg, hsl(${h1}, 70%, 45%), hsl(${h2}, 70%, 45%))`;
        body.style.backgroundAttachment = 'fixed';
        body.style.backgroundSize = 'cover';
    }

    setRandomGradientBackground();
});