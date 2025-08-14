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

    // Search Logic
    const searchInput = document.getElementById('artist-search-input');
    const searchButton = document.getElementById('artist-search-button');
    const searchResultsContainer = document.getElementById('search-results-container');
    const gameContainer = document.getElementById('game-container');
    const feedbackArea = document.getElementById('feedback-area');
    const artistButton = document.getElementById('artist-button');
    const albumButton = document.getElementById('album-button');
    const songSnippetAudio = document.getElementById('song-snippet-audio');

    let searchMode = 'artist'; // 'artist' or 'album'
    let currentSelectionDetails = null; // Will store { id, name, image, songs: [] }
    let currentSong = null;
    let currentScore = 0;
    let lastPlaybackDuration = 0;

    const DEEZER_API_BASE_URL = 'https://api.deezer.com';
    const CORS_PROXY_BASE = 'https://api.codetabs.com/v1/proxy?quest=';

    const backToSearchButton = document.getElementById('back-to-search-button');
    const currentScoreDisplay = document.getElementById('current-score');

    function resetGameState() {
        currentScore = 0;
        currentScoreDisplay.textContent = currentScore;
        gameContainer.style.display = 'none';
        feedbackArea.textContent = '';
        if (songSnippetAudio) {
            songSnippetAudio.pause();
            songSnippetAudio.currentTime = 0;
        }
    }

    artistButton.addEventListener('click', () => {
        searchMode = 'artist';
        artistButton.classList.add('active');
        albumButton.classList.remove('active');
        searchInput.placeholder = "Enter an artist name";
        searchResultsContainer.innerHTML = '';
        resetGameState();
    });

    albumButton.addEventListener('click', () => {
        searchMode = 'album';
        albumButton.classList.add('active');
        artistButton.classList.remove('active');
        searchInput.placeholder = "Enter an album name";
        searchResultsContainer.innerHTML = '';
        resetGameState();
    });

    backToSearchButton.addEventListener('click', () => {
        resetGameState();
        searchResultsContainer.innerHTML = ''; 
        searchInput.value = '';
    });

    function performSearch() {
        const query = searchInput.value.trim();
        if (query) {
            if (searchMode === 'artist') {
                searchArtists(query);
            } else {
                searchAlbums(query);
            }
        }
    }

    searchButton.addEventListener('click', performSearch);

    searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            performSearch();
        }
    });

    async function searchArtists(query) {
        searchResultsContainer.innerHTML = '<p>Searching...</p>';
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
            searchResultsContainer.innerHTML = '<p>Error searching for artists. Please try again.</p>';
        }
    }

    function displayArtistResults(artists) {
        searchResultsContainer.innerHTML = ''; 
        if (!artists || artists.length === 0) {
            searchResultsContainer.innerHTML = '<p>No artists found.</p>';
            return;
        }

        const ul = document.createElement('ul');
        ul.className = 'artist-list';
        artists.slice(0, 10).forEach(artist => { 
            const li = document.createElement('li');
            li.className = 'artist-item';
            li.innerHTML = `
                <img src="${artist.picture_small}" alt="${artist.name}" class="artist-item-image">
                <span class="artist-item-name">${artist.name}</span>
            `;
            li.addEventListener('click', () => selectArtist(artist.id, artist.name, artist.picture_medium));
            ul.appendChild(li);
        });
        searchResultsContainer.appendChild(ul);
    }

    async function getArtistTracks(artistId) {
        try {
            const targetUrl = `${DEEZER_API_BASE_URL}/artist/${artistId}/top?limit=100`;
            const response = await fetch(`${CORS_PROXY_BASE}${encodeURIComponent(targetUrl)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
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
        searchResultsContainer.innerHTML = '';
        searchInput.value = '';

        const tracks = await getArtistTracks(artistId);
        if (tracks.length === 0) {
            document.getElementById('feedback-area').textContent = 'No playable song previews found for this artist.';
            gameContainer.style.display = 'none';
            return;
        }

        currentSelectionDetails = {
            id: artistId,
            name: artistName,
            image: artistImage,
            songs: tracks.map(track => ({ title: track.title, preview: track.preview }))
        };
        gameContainer.style.display = 'block';
        loadNewSong();
    }

    async function searchAlbums(query) {
        searchResultsContainer.innerHTML = '<p>Searching...</p>';
        try {
            const targetUrl = `${DEEZER_API_BASE_URL}/search/album?q=${encodeURIComponent(query)}`;
            const response = await fetch(`${CORS_PROXY_BASE}${encodeURIComponent(targetUrl)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            displayAlbumResults(data.data);
        } catch (error) {
            console.error('Error searching albums:', error);
            searchResultsContainer.innerHTML = '<p>Error searching for albums. Please try again.</p>';
        }
    }

    function displayAlbumResults(albums) {
        searchResultsContainer.innerHTML = '';
        if (!albums || albums.length === 0) {
            searchResultsContainer.innerHTML = '<p>No albums found.</p>';
            return;
        }

        const ul = document.createElement('ul');
        ul.className = 'artist-list';
        albums.slice(0, 10).forEach(album => {
            const li = document.createElement('li');
            li.className = 'artist-item';
            li.innerHTML = `
                <img src="${album.cover_small}" alt="${album.title}" class="artist-item-image">
                <span class="artist-item-name">${album.title} - ${album.artist.name}</span>
            `;
            li.addEventListener('click', () => selectAlbum(album.id, album.title, album.cover_medium, album.artist.name));
            ul.appendChild(li);
        });
        searchResultsContainer.appendChild(ul);
    }

    async function getAlbumTracks(albumId) {
        try {
            const targetUrl = `${DEEZER_API_BASE_URL}/album/${albumId}/tracks`;
            const response = await fetch(`${CORS_PROXY_BASE}${encodeURIComponent(targetUrl)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data.data ? data.data.filter(track => track.preview && track.preview !== '') : [];
        } catch (error) {
            console.error('Error fetching album tracks:', error);
            document.getElementById('feedback-area').textContent = 'Error fetching tracks. Please try again.';
            return [];
        }
    }

    async function selectAlbum(albumId, albumTitle, albumCover, artistName) {
        document.getElementById('game-artist-image').src = albumCover;
        document.getElementById('game-artist-name').textContent = `${albumTitle} by ${artistName}`;
        searchResultsContainer.innerHTML = '';
        searchInput.value = '';

        const tracks = await getAlbumTracks(albumId);
        if (tracks.length === 0) {
            document.getElementById('feedback-area').textContent = 'No playable song previews found for this album.';
            gameContainer.style.display = 'none';
            return;
        }

        currentSelectionDetails = {
            id: albumId,
            name: albumTitle,
            image: albumCover,
            songs: tracks.map(track => ({ title: track.title, preview: track.preview }))
        };
        gameContainer.style.display = 'block';
        loadNewSong();
    }

    function loadNewSong() {
        if (!currentSelectionDetails || currentSelectionDetails.songs.length === 0) {
            document.getElementById('feedback-area').textContent = 'No songs available.';
            return;
        }
        const songs = currentSelectionDetails.songs;
        currentSong = songs[Math.floor(Math.random() * songs.length)];
        const previewUrl = currentSong.preview.replace('http://', 'https://');
        document.getElementById('song-snippet-audio').src = previewUrl;
        document.getElementById('song-guess-input').value = '';
        document.getElementById('feedback-area').textContent = 'Ready to play! Choose a duration.';
        document.getElementById('skipped-song-display').textContent = '';
        resetPlaybackButtons();
    }

    // Playback Controls
    const audioElement = document.getElementById('song-snippet-audio');
    const play1sButton = document.getElementById('play-1s-button');
    const play3sButton = document.getElementById('play-3s-button');
    const play5sButton = document.getElementById('play-5s-button');
    const skipButton = document.getElementById('skip-button');
    const skippedSongDisplay = document.getElementById('skipped-song-display');
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
        }, 15000);

        buttonRevealTimer2 = setTimeout(() => {
            play5sButton.style.display = 'inline-block';
        }, 25000);
    }
    
    function playSnippet(duration) {
        if (!currentSong) return;
        lastPlaybackDuration = duration;
        audioElement.currentTime = 0;
        audioElement.play();
        setTimeout(() => audioElement.pause(), duration * 1000);

        let penalty = 0;
        if (duration === 3) {
            penalty = -2;
        } else if (duration === 5) {
            penalty = -5;
        }

        if (penalty !== 0) {
            currentScore += penalty;
            document.getElementById('current-score').textContent = currentScore;
            feedbackArea.textContent = `Playing for ${duration} seconds. ${penalty} points.`;
        } else {
            feedbackArea.textContent = `Playing for ${duration} seconds.`;
        }
    }

    document.getElementById('play-1s-button').addEventListener('click', () => playSnippet(1));
    document.getElementById('play-3s-button').addEventListener('click', () => playSnippet(3));
    document.getElementById('play-5s-button').addEventListener('click', () => playSnippet(5));

    skipButton.addEventListener('click', () => {
        if (currentSong) {
            currentScore -= 5;
            document.getElementById('current-score').textContent = currentScore;
            skippedSongDisplay.textContent = `Skipped: ${currentSong.title}`;
            feedbackArea.textContent = `-5 points. You missed: ${currentSong.title}`;
            loadNewSong();
        }
    });

    function normalizeTitle(title) {
        if (!title) return '';
        let normalized = title.toLowerCase();
        normalized = normalized.replace(/\s*\(.*?\)\s*/g, '');
        normalized = normalized.replace(/[.,'"!?&#-]/g, '');
        normalized = normalized.replace(/\s+/g, ' ').trim();
        return normalized;
    }

    document.getElementById('submit-guess-button').addEventListener('click', () => {
        if (!currentSong) return;

        const userGuess = document.getElementById('song-guess-input').value;
        const actualTitle = currentSong.title;

        const normalizedGuess = normalizeTitle(userGuess);
        const normalizedActual = normalizeTitle(actualTitle);
        
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
            loadNewSong();
        } else {
            feedbackArea.textContent = 'Wrong guess. Try again!';
        }
    });

    function setRandomGradientBackground() {
        const h1 = Math.floor(Math.random() * 360);
        const h2 = Math.floor(Math.random() * 360);
        const angle = Math.floor(Math.random() * 360);
        body.style.background = `linear-gradient(${angle}deg, hsl(${h1}, 70%, 45%), hsl(${h2}, 70%, 45%))`;
        body.style.backgroundAttachment = 'fixed';
        body.style.backgroundSize = 'cover';
    }

    // "Will it take" buttons logic
    document.querySelectorAll('.tile-play-button').forEach(button => {
        button.addEventListener('click', function() {
            const duration = parseInt(this.closest('.tile').dataset.duration);
            if (currentSong && songSnippetAudio) {
                songSnippetAudio.currentTime = 0;
                songSnippetAudio.play();
                setTimeout(() => songSnippetAudio.pause(), duration * 1000);

                let penalty = 0;
                if (duration === 3) {
                    penalty = -2;
                } else if (duration === 5) {
                    penalty = -5;
                }

                if (penalty !== 0) {
                    currentScore += penalty;
                    document.getElementById('current-score').textContent = currentScore;
                    feedbackArea.textContent = `Playing for ${duration} seconds. ${penalty} points.`;
                } else {
                    feedbackArea.textContent = `Playing for ${duration} seconds.`;
                }
            } else {
                feedbackArea.textContent = 'Please select an artist/album first to load a song.';
            }
        });
    });

    setRandomGradientBackground();
});
