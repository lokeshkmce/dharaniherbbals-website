export const API_BASE_URL = '/herbal';
export const BASE_URL = '/herbal';
export const NGROK_DOMAIN = '/herbal';
export const BACKEND_SERVER_URL = 'http://179.197.251.47:30080';
export const getMyOrdersUrl = (userId) => `${API_BASE_URL}/my-orders/${userId}/`;
export const SLIDERS_API_URL = `${API_BASE_URL}/sliders/`;
export const PRODUCTS_API_URL = `${API_BASE_URL}/products/`;
export const NEW_PRODUCTS_API_URL = `${API_BASE_URL}/new-products/`;
export const MOST_LOVED_API_URL = `${API_BASE_URL}/most-loved/`;
export const CATEGORIES_API_URL = `${API_BASE_URL}/categories/`;
export const BRANDS_API_URL = `${API_BASE_URL}/brands/`;

export const API_HEADERS = {
  'ngrok-skip-browser-warning': 'true'
};

export const resolveMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;

  // 1. Direct backend media image URL from Django (16 newer products)
  if (trimmed.startsWith('http://179.197.251.47:30080/')) {
    return trimmed;
  }

  // 2. Existing vedanmart.com image URLs (253 products) - exactly as returned by API
  if (trimmed.startsWith('http://vedanmart.com/')) {
    return trimmed.replace('http://vedanmart.com/', 'https://vedanmart.com/');
  }
  if (trimmed.startsWith('https://vedanmart.com/')) {
    return trimmed;
  }

  // 3. Direct backend media image paths (relative paths like /media/... or media/...)
  // Resolve against backend base URL (http://179.197.251.47:30080)
  if (trimmed.startsWith('/media/')) {
    return `${BACKEND_SERVER_URL}${trimmed}`;
  }
  if (trimmed.startsWith('media/')) {
    return `${BACKEND_SERVER_URL}/${trimmed}`;
  }

  // 4. Legacy local dev/staging backend paths -> route to backend server URL
  if (trimmed.includes('127.0.0.1:8000/media/') || trimmed.includes('localhost:8000/media/')) {
    const mediaPath = trimmed.split(/\/media\//)[1];
    return `${BACKEND_SERVER_URL}/media/${mediaPath}`;
  }
  if (trimmed.includes('api.codingboss')) {
    if (trimmed.includes('/media/')) {
      const mediaPath = trimmed.split(/\/media\//)[1];
      return `${BACKEND_SERVER_URL}/media/${mediaPath}`;
    }
  }

  // 5. Handle backend anomaly if Django prepends /media/ to external URLs (e.g. /media/https%3A/...)
  if (trimmed.includes('/media/')) {
    const afterMedia = trimmed.split(/\/media\//)[1];
    if (afterMedia && (afterMedia.includes('http%3A') || afterMedia.includes('https%3A') || afterMedia.includes('http:/') || afterMedia.includes('https:/') || afterMedia.includes('vedanmart') || afterMedia.includes('dharaniherbbals'))) {
      let unwrapped = afterMedia;
      try {
        unwrapped = decodeURIComponent(decodeURIComponent(unwrapped));
      } catch (e) {
        try { unwrapped = decodeURIComponent(unwrapped); } catch (e2) {}
      }
      unwrapped = unwrapped.replace(/^https?:\/*/, 'https://').replace(/ /g, '%20');
      if (!unwrapped.startsWith('https://') && (unwrapped.startsWith('vedanmart') || unwrapped.startsWith('www.vedanmart'))) {
        unwrapped = 'https://' + unwrapped;
      }
      return unwrapped;
    }
  }

  if (trimmed.startsWith('http://www.dharaniherbbals.in/')) {
    return trimmed.replace('http://www.dharaniherbbals.in/', 'https://www.dharaniherbbals.in/');
  }
  if (trimmed.startsWith('http://dharaniherbbals.in/')) {
    return trimmed.replace('http://dharaniherbbals.in/', 'https://dharaniherbbals.in/');
  }

  // 6. Absolute web URLs (http/https)
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }

  // 7. Local frontend public assets (like /logo.png)
  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  return trimmed;
};
