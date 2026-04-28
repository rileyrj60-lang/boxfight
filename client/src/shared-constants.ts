// Mirror of shared/src/constants.ts. Kept inline so the client builds
// standalone on Vercel (which sets Root Directory: client and can't see
// the parent workspace). Update both files together if values change.
export const SERVER_PORT = 2567;
export const ROOM_NAME = 'arena';
export const LOBBY_ROOM_NAME = 'lobby';
export const MAX_CLIENTS = 2;
export const WINS_REQUIRED = 3;

export const PATCH_RATE_MS = 50;
export const INPUT_RATE_HZ = 30;
export const INPUT_INTERVAL_MS = 1000 / INPUT_RATE_HZ;
export const INTERPOLATION_DELAY_MS = 100;
export const INTERPOLATION_BUFFER_SIZE = 4;

export const SPAWN_RANGE = 5;
