import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Manager-side access control list for the admin app.
 *
 * The education schema can only be changed through reviewed SQL migrations, so
 * the block/allow list is stored locally on the manager's device and enforced
 * everywhere the admin app reads contacts (support list and registered users).
 * Clearing it is only possible through the explicit «اجازهٔ دسترسی» action.
 */
const BLOCKS_KEY = 'milo_admin_access_blocks_v1';

export interface AccessBlock {
  userId: string;
  name: string;
  blockedAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

async function readRaw(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(BLOCKS_KEY) ?? null;
    } catch {
      return null;
    }
  }
  return AsyncStorage.getItem(BLOCKS_KEY);
}

async function writeRaw(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(BLOCKS_KEY, value);
      return;
    } catch {
      // A private-mode browser can still use the in-memory page session.
    }
  }
  await AsyncStorage.setItem(BLOCKS_KEY, value);
}

function parseBlocks(value: string | null): Record<string, AccessBlock> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return {};
    const result: Record<string, AccessBlock> = {};
    for (const [userId, entry] of Object.entries(parsed)) {
      if (!isRecord(entry) || typeof entry.blockedAt !== 'string') continue;
      result[userId] = {
        userId,
        name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : 'کاربر',
        blockedAt: entry.blockedAt,
      };
    }
    return result;
  } catch {
    return {};
  }
}

export async function loadAccessBlocks(): Promise<Record<string, AccessBlock>> {
  return parseBlocks(await readRaw());
}

/** Blocks access (true) or restores it (false) and returns the fresh list. */
export async function setUserAccessBlocked(
  userId: string,
  name: string,
  blocked: boolean,
): Promise<Record<string, AccessBlock>> {
  const blocks = await loadAccessBlocks();
  if (blocked) {
    blocks[userId] = {
      userId,
      name: name.trim() || blocks[userId]?.name || 'کاربر',
      blockedAt: new Date().toISOString(),
    };
  } else {
    delete blocks[userId];
  }
  await writeRaw(JSON.stringify(blocks));
  return blocks;
}
