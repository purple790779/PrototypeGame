import { STORAGE_PREFIX } from './version.js';

export const keys = {
  save: `${STORAGE_PREFIX}:save`,
  meta: `${STORAGE_PREFIX}:meta`,
  metaUpgrades: `${STORAGE_PREFIX}:metaUpgrades`,
  metaSpent: `${STORAGE_PREFIX}:metaSpent`,
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

const defaultMetaSpent = {
  fragments: 0,
  cores: 0,
};

const LEGACY_META_UPGRADES = [
  { key: 'atk', base: 50, growth: 1.22, currency: 'fragments' },
  { key: 'fireRate', base: 60, growth: 1.22, currency: 'fragments' },
  { key: 'range', base: 40, growth: 1.22, currency: 'fragments' },
  { key: 'maxHp', base: 70, growth: 1.22, currency: 'fragments' },
  { key: 'pickup', base: 80, growth: 1.22, currency: 'fragments' },
  { key: 'startLevel', base: 2, growth: 1.35, currency: 'cores' },
  { key: 'startChoices', base: 3, growth: 1.35, currency: 'cores' },
  { key: 'rerolls', base: 2, growth: 1.35, currency: 'cores' },
];

const calcLegacySpent = (metaUpgrades) => {
  let fragments = 0;
  let cores = 0;
  LEGACY_META_UPGRADES.forEach((def) => {
    const level = metaUpgrades?.[def.key] || 0;
    for (let i = 0; i < level; i += 1) {
      const cost = Math.round(def.base * Math.pow(def.growth, i));
      if (def.currency === 'fragments') {
        fragments += cost;
      } else {
        cores += cost;
      }
    }
  });
  return { fragments, cores };
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

export const getMetaSpent = () => {
  const raw = readStorage(keys.metaSpent);
  if (raw) {
    try {
      return { ...defaultMetaSpent, ...JSON.parse(raw) };
    } catch (error) {
      return { ...defaultMetaSpent };
    }
  }

  const metaRaw = readStorage(keys.metaUpgrades);
  if (!metaRaw) {
    return { ...defaultMetaSpent };
  }

  try {
    const metaUpgrades = { ...defaultMetaUpgrades, ...JSON.parse(metaRaw) };
    const hasLegacyUpgrades = Object.values(metaUpgrades).some((value) => value > 0);
    if (!hasLegacyUpgrades) {
      return { ...defaultMetaSpent };
    }
    const spent = calcLegacySpent(metaUpgrades);
    writeStorage(keys.metaSpent, JSON.stringify(spent));
    return spent;
  } catch (error) {
    return { ...defaultMetaSpent };
  }
};

export const addMetaSpent = (currency, amount) => {
  if (!currency || !Number.isFinite(amount)) return false;
  const current = getMetaSpent();
  const next = {
    ...defaultMetaSpent,
    ...current,
    [currency]: (current[currency] || 0) + amount,
  };
  return writeStorage(keys.metaSpent, JSON.stringify(next));
};

export const resetMetaSpent = () => {
  try {
    localStorage.removeItem(keys.metaSpent);
    return true;
  } catch (error) {
    return false;
  }
};

const defaultSettings = {
  shake: true,
  dmgText: true,
  sfx: true,
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
