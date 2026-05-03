export function getDeviceId() {
  let id = localStorage.getItem('dominoDeviceId');
  if (!id) {
    id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    localStorage.setItem('dominoDeviceId', id);
  }
  return id;
}

export function getPlayerClaim(gameId) {
  const raw = localStorage.getItem(`dominoPlayerClaim_${gameId}`);
  return raw ? JSON.parse(raw) : null;
}

export function setPlayerClaim(gameId, player) {
  localStorage.setItem(`dominoPlayerClaim_${gameId}`, JSON.stringify(player));
}

export function clearPlayerClaim(gameId) {
  localStorage.removeItem(`dominoPlayerClaim_${gameId}`);
}
