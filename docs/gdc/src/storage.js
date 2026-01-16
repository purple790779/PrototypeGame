import { STORAGE_PREFIX } from './version.js';

export const keys = {
  save: `${STORAGE_PREFIX}:save`,
  meta: `${STORAGE_PREFIX}:meta`,
  metaUpgrades: `${STORAGE_PREFIX}:metaUpgrades`,
  settings: `${STORAGE_PREFIX}:settings`,
};

const legacySaveKeys = [
  'GEO_DEFENSE_V37_1',
];

const readStorage = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    return false;
  }
};

export const loadSavedData = () => {
  let raw = readStorage(keys.save);
  let migratedFrom = null;

  if (!raw) {
    for (const legacyKey of legacySaveKeys) {
      const legacyValue = readStorage(legacyKey);
      if (legacyValue) {
        writeStorage(keys.save, legacyValue);
        raw = legacyValue;
        migratedFrom = legacyKey;
        break;
      }
    }
  }

  if (!raw) {
    return { data: null, migratedFrom };
  }

  try {
    return { data: JSON.parse(raw), migratedFrom };
  } catch (error) {
    return { data: null, migratedFrom };
  }
};

export const saveSavedData = (payload) => {
  return writeStorage(keys.save, JSON.stringify(payload));
};

export const saveMeta = (payload) => {
  return writeStorage(keys.meta, JSON.stringify(payload));
};

const defaultMetaUpgrades = {
  atk: 0,
  fireRate: 0,
  range: 0,
  maxHp: 0,
  pickup: 0,
  startLevel: 0,
  startChoices: 0,
  rerolls: 0,
};

export const getMetaUpgrades = () => {
  const raw = readStorage(keys.metaUpgrades);
  if (!raw) {
    return { ...defaultMetaUpgrades };
  }
  try {
    return { ...defaultMetaUpgrades, ...JSON.parse(raw) };
  } catch (error) {
    return { ...defaultMetaUpgrades };
  }
};

export const setMetaUpgrades = (payload) => {
  return writeStorage(keys.metaUpgrades, JSON.stringify(payload));
};

export const resetMetaUpgrades = () => {
  try {
    localStorage.removeItem(keys.metaUpgrades);
    return true;
  } catch (error) {
    return false;
  }
};

const defaultSettings = {
  shake: true,
  dmgText: true,
};

export const getSettings = () => {
  const raw = readStorage(keys.settings);
  if (!raw) {
    return { ...defaultSettings };
  }
  try {
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch (error) {
    return { ...defaultSettings };
  }
};

export const setSettings = (payload) => {
  return writeStorage(keys.settings, JSON.stringify({ ...defaultSettings, ...payload }));
};
