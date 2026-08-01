const memoryCache = new Map();

function getCache(key, ttlSeconds = 900) {
  const cached = memoryCache.get(key);
  if (cached && (Date.now() - cached.timestamp < ttlSeconds * 1000)) {
    console.log(`[CACHE HIT] ${key}`);
    return cached.data;
  }
  return null;
}

function setCache(key, data) {
  console.log(`[CACHE SET] ${key}`);
  memoryCache.set(key, { data, timestamp: Date.now() });
}

function clearCachePrefix(prefix) {
  console.log(`[CACHE CLEAR] Prefix: ${prefix}`);
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
}

module.exports = {
  getCache,
  setCache,
  clearCachePrefix
};
