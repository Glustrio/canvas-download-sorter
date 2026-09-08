// In-memory stand-in for the parts of the chrome.* API the extension uses.
// Events record their listeners so tests can fire them with `emit`.
export function createFakeChrome({ storage = {}, tabs = [] } = {}) {
  const listeners = new Map();
  const state = {
    storage: structuredClone(storage),
    writes: 0,
    badgeText: null,
    badgeColor: null,
    optionsPageOpens: 0,
    injections: [],
  };

  const event = (name) => ({
    addListener(listener) {
      listeners.set(name, [...(listeners.get(name) ?? []), listener]);
    },
  });

  const emit = (name, ...args) => {
    for (const listener of listeners.get(name) ?? []) listener(...args);
  };

  const chrome = {
    action: {
      onClicked: event('action.onClicked'),
      async setBadgeText({ text }) {
        state.badgeText = text;
      },
      async setBadgeBackgroundColor({ color }) {
        state.badgeColor = color;
      },
    },
    downloads: {
      onDeterminingFilename: event('downloads.onDeterminingFilename'),
    },
    runtime: {
      onInstalled: event('runtime.onInstalled'),
      onStartup: event('runtime.onStartup'),
      async openOptionsPage() {
        state.optionsPageOpens += 1;
      },
    },
    storage: {
      onChanged: event('storage.onChanged'),
      sync: {
        async get(defaults) {
          const stored = Object.fromEntries(
            Object.keys(defaults)
              .filter((key) => key in state.storage)
              .map((key) => [key, state.storage[key]]),
          );
          return structuredClone({ ...defaults, ...stored });
        },
        async set(items) {
          const changes = Object.fromEntries(
            Object.entries(items).map(([key, newValue]) => [
              key,
              { oldValue: state.storage[key], newValue },
            ]),
          );
          Object.assign(state.storage, structuredClone(items));
          state.writes += 1;
          emit('storage.onChanged', changes, 'sync');
        },
      },
    },
    scripting: {
      async executeScript(injection) {
        state.injections.push(injection);
      },
    },
    tabs: {
      async query() {
        return tabs;
      },
    },
  };

  return { chrome, state, emit, listeners: (name) => listeners.get(name) ?? [] };
}

export const flush = () => new Promise((resolve) => setImmediate(resolve));
