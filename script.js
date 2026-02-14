document.addEventListener('DOMContentLoaded', () => {
  // Theme switcher logic
  const darkModeBtn = document.getElementById('dark-mode-btn');
  const lightModeBtn = document.getElementById('light-mode-btn');
  const body = document.body;

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

  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);

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
  const backToSearchButton = document.getElementById('back-to-search-button');
  const currentScoreDisplay = document.getElementById('current-score');

  let searchMode = 'artist';
  let currentSelectionDetails = null;
  let currentSong = null;
  let currentScore = 0;
  let lastPlaybackDuration = 0;

  const DEEZER_API_BASE_URL = 'https://api.deezer.com';
  const CORS_PROXY_BASE = 'https://corsproxy.io/?';

  async function fetchFromDeezer(url) {
    const response = await fetch(`${CORS_PROXY_BASE}${encodeURIComponent(url)}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  }

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
    searchInput.placeholder = 'Enter an artist name';
    searchResultsContainer.innerHTML = '';
    resetGameState();
  });

  albumButton.addEventListener('click', () => {
    searchMode = 'album';
    albumButton.classList.add('active');
    artistButton.classList.remove('active');
    searchInput.placeholder = 'Enter an album name';
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
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });

  async function searchArtists(query) {
    searchResultsContainer.innerHTML = '<p>Searching...</p>';
    try {
      const data = await fetchFromDeezer(`${DEEZER_API_BASE_URL}/search/artist?q=${encodeURIComponent(query)}`);
      displayArtistResults(data.data);
    } catch (error) {
      console.error('Error:', error);
      searchResultsContainer.innerHTML = '<p>Error searching. Please try again.</p>';
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
    artists.slice(0, 10).forEach((artist) => {
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
      const data = await fetchFromDeezer(`${DEEZER_API_BASE_URL}/artist/${artistId}/top?limit=100`);
      return data.data ? data.data.filter((t) => t.preview) : [];
    } catch (error) {
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
      feedbackArea.textContent = 'No playable previews found.';
      return;
    }
    currentSelectionDetails = { songs: tracks.map(t => ({ title: t.title, preview: t.preview })) };
    gameContainer.style.display = 'block';
    loadNewSong();
  }

  async function searchAlbums(query) {
    searchResultsContainer.innerHTML = '<p>Searching...</p>';
    try {
      const data = await fetchFromDeezer(`${DEEZER_API_BASE_URL}/search/album?q=${encodeURIComponent(query)}`);
      displayAlbumResults(data.data);
    } catch (error) {
      searchResultsContainer.innerHTML = '<p>Error searching.</p>';
    }
  }

  function displayAlbumResults(albums) {
    searchResultsContainer.innerHTML = '';
    const ul = document.createElement('ul');
    ul.className = 'artist-list';
    albums.slice(0, 10).forEach((album) => {
      const li = document.createElement('li');
      li.className = 'artist-item';
      li.innerHTML = `<img src="${album.cover_small}" class="artist-item-image"> <span>${album.title}</span>`;
      li.addEventListener('click', () => selectAlbum(album.id, album.title, album.cover_medium, album.artist.name));
      ul.appendChild(li);
    });
    searchResultsContainer.appendChild(ul);
  }

  async function getAlbumTracks(albumId) {
    try {
      const data = await fetchFromDeezer(`${DEEZER_API_BASE_URL}/album/${albumId}/tracks`);
      return data.data ? data.data.filter(t => t.preview) : [];
    } catch (error) { return []; }
  }

  async function selectAlbum(albumId, albumTitle, albumCover, artistName) {
    document.getElementById('game-artist-image').src = albumCover;
    document.getElementById('game-artist-name').textContent = `${albumTitle} by ${artistName}`;
    searchResultsContainer.innerHTML = '';
    const tracks = await getAlbumTracks(albumId);
    currentSelectionDetails = { songs: tracks.map(t => ({ title: t.title, preview: t.preview })) };
    gameContainer.style.display = 'block';
    loadNewSong();
  }

  function loadNewSong() {
    if (!currentSelectionDetails || !currentSelectionDetails.songs.length) return;
    currentSong = currentSelectionDetails.songs[Math.floor(Math.random() * currentSelectionDetails.songs.length)];
    
    console.log(`%c DEBUG: Correct Song: ${currentSong.title}`, 'background: #222; color: #bada55; font-size: 14px');

    songSnippetAudio.src = currentSong.preview.replace('http://', 'https://');
    document.getElementById('song-guess-input').value = '';
    feedbackArea.textContent = 'Ready! Choose duration.';
    document.getElementById('skipped-song-display').textContent = '';
    resetPlaybackButtons();
  }

  const play1sButton = document.getElementById('play-1s-button');
  const play3sButton = document.getElementById('play-3s-button');
  const play5sButton = document.getElementById('play-5s-button');
  let timer1, timer2;

  function resetPlaybackButtons() {
    play1sButton.style.display = 'inline-block';
    play3sButton.style.display = 'none';
    play5sButton.style.display = 'none';
    clearTimeout(timer1); clearTimeout(timer2);
    timer1 = setTimeout(() => play3sButton.style.display = 'inline-block', 15000);
    timer2 = setTimeout(() => play5sButton.style.display = 'inline-block', 25000);
  }

  function playSnippet(duration) {
    if (!currentSong) return;
    lastPlaybackDuration = duration;
    songSnippetAudio.currentTime = 0;
    songSnippetAudio.play();
    setTimeout(() => songSnippetAudio.pause(), duration * 1000);
    let penalty = duration === 3 ? -2 : (duration === 5 ? -5 : 0);
    currentScore += penalty;
    currentScoreDisplay.textContent = currentScore;
    feedbackArea.textContent = `Playing ${duration}s. ${penalty ? penalty + ' points' : ''}`;
  }

  play1sButton.addEventListener('click', () => playSnippet(1));
  play3sButton.addEventListener('click', () => playSnippet(3));
  play5sButton.addEventListener('click', () => playSnippet(5));

  document.getElementById('skip-button').addEventListener('click', () => {
    if (!currentSong) return;
    currentScore -= 5;
    currentScoreDisplay.textContent = currentScore;
    feedbackArea.textContent = `-5 points. You missed: ${currentSong.title}`;
    document.getElementById('skipped-song-display').textContent = `Skipped: ${currentSong.title}`;
    loadNewSong();
  });

  function cleanString(str) {
    if (!str) return '';
    return str.toLowerCase()
      .replace(/\s*\(.*?\)\s*/g, '')
      .replace(/[.,'"!?&#-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  document.getElementById('submit-guess-button').addEventListener('click', () => {
    if (!currentSong) return;
    const userGuess = cleanString(document.getElementById('song-guess-input').value);
    const actualFullTitle = currentSong.title;

    const titleParts = actualFullTitle.split(/[\/\-]/).map(part => cleanString(part));
    const normalizedFullTitle = cleanString(actualFullTitle);

    const isCorrect = (userGuess === normalizedFullTitle) || titleParts.some(part => part === userGuess);

    if (isCorrect && userGuess !== '') {
      let pts = lastPlaybackDuration === 1 ? 10 : (lastPlaybackDuration === 3 ? 5 : 2);
      if (lastPlaybackDuration === 0) pts = 1;
      currentScore += pts;
      currentScoreDisplay.textContent = currentScore;
      feedbackArea.textContent = `Correct! +${pts}`;
      loadNewSong();
    } else {
      feedbackArea.textContent = 'Wrong! Try again.';
    }
  });

  function setRandomGradientBackground() {
    const h1 = Math.floor(Math.random() * 360), h2 = Math.floor(Math.random() * 360);
    body.style.background = `linear-gradient(${Math.random() * 360}deg, hsl(${h1}, 70%, 45%), hsl(${h2}, 70%, 45%)) fixed`;
  }

  setRandomGradientBackground();
});