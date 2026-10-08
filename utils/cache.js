const memoryCache = new Map();
const cacheTimers = new Map();

function getCache(key, ttlSeconds = 900) {
  const cached = memoryCache.get(key);
  if (cached && (Date.now() - cached.timestamp < ttlSeconds * 1000)) {
    console.log(`[CACHE HIT] ${key}`);
    return cached.data;
  }
  return null;
}

function setCache(key, data, ttlSeconds = 900) {
  console.log(`[CACHE SET] ${key}`);
  memoryCache.set(key, { data, timestamp: Date.now() });
  
  if (cacheTimers.has(key)) {
    clearTimeout(cacheTimers.get(key));
  }
  const timer = setTimeout(() => {
    memoryCache.delete(key);
    cacheTimers.delete(key);
  }, ttlSeconds * 1000);
  cacheTimers.set(key, timer);
}

function clearCachePrefix(prefix) {
  console.log(`[CACHE CLEAR] Prefix: ${prefix}`);
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
      if (cacheTimers.has(key)) {
        clearTimeout(cacheTimers.get(key));
        cacheTimers.delete(key);
      }
    }
  }
}

module.exports = {
  getCache,
  setCache,
  clearCachePrefix
};
