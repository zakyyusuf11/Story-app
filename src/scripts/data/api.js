const BASE = 'https://story-api.dicoding.dev/v1';

const ENDPOINTS = {
  REGISTER: `${BASE}/register`,
  LOGIN: `${BASE}/login`,
  STORIES: `${BASE}/stories`,
};

// Fetch all stories
export async function fetchStories() {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('No token found. Please login first.');
    return [];
  }

  try {
    const response = await fetch(ENDPOINTS.STORIES, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Fetch stories failed: ${response.status}`);
    }

    const result = await response.json();
    return result.listStory;
  } catch (error) {
    console.error('❌ Fetch stories failed:', error.message);
    return [];
  }
}

// Upload story
export async function postStory({ photoFile, description, lat = null, lon = null }) {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Authorization token required');

  const formData = new FormData();
  formData.append('photo', photoFile);
  formData.append('description', description);
  if (lat && lon) {
    formData.append('lat', lat);
    formData.append('lon', lon);
  }

  const response = await fetch(ENDPOINTS.STORIES, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Post story failed: ${response.status} ${errText}`);
  }

  return await response.json();
}

// Login
export async function login({ email, password }) {
  const response = await fetch(ENDPOINTS.LOGIN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Login failed: ${response.status} ${errText}`);
  }

  return await response.json();
}

// Register
export async function register({ name, email, password }) {
  const response = await fetch(ENDPOINTS.REGISTER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Register failed: ${response.status} ${errText}`);
  }

  return await response.json();
}
  