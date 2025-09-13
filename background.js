// Simple Promise helpers for storage (works in MV2)
function storageGet(keys) {
  return new Promise(res => chrome.storage.local.get(keys, res));
}
function storageSet(obj) {
  return new Promise(res => chrome.storage.local.set(obj, res));
}
function storageRemove(keys) {
  return new Promise(res => chrome.storage.local.remove(keys, res));
}

// Helper: MV2 uses tabs.executeScript (callback). Wrap it in a Promise.
function tabsExecuteScript(tabId, details) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.executeScript(tabId, details, results => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(results);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || !msg.action) return;
  if (msg.action === 'tutorialPlaying') handleTutorialPlaying().catch(console.error);
  else if (msg.action === 'tutorialPaused') handleTutorialPaused().catch(console.error);
});

async function handleTutorialPlaying() {
  const data = await storageGet(['musicTab', 'mode', 'bgVolume', 'fgVolume']);
  const musicTab = data.musicTab;
  const mode = data.mode || 'stop';
  const bgVol = data.bgVolume ?? 20;

  if (!musicTab) return;

  try {
    if (mode === 'stop') {
      const results = await tabsExecuteScript(musicTab, {
        code: `
          (function(){
            const videos = Array.from(document.querySelectorAll('video'));
            let pausedAny = false;
            videos.forEach(v => {
              try {
                if (!v.paused && !v.ended) {
                  v.pause();
                  v.setAttribute('data-paused-by-yt-switcher','1');
                  pausedAny = true;
                }
              } catch(e){}
            });
            return {pausedAny};
          })();
        `
      });
      const r = results && results[0];
      if (r && r.pausedAny) await storageSet({ musicPausedByExt: musicTab });
    } else if (mode === 'background') {
      const targetVol = Math.min(100, Math.max(0, bgVol)) / 100;
      const results = await tabsExecuteScript(musicTab, {
        code: `
          (function(){
            const targetVol = ${targetVol};
            const videos = Array.from(document.querySelectorAll('video'));
            let changed = false;
            videos.forEach(v => {
              try {
                if (!v.hasAttribute('data-orig-volume')) {
                  v.setAttribute('data-orig-volume', String(v.volume));
                }
                if (Math.abs(v.volume - targetVol) > 0.001) {
                  v.volume = targetVol;
                  changed = true;
                }
              } catch(e){}
            });
            return {changed};
          })();
        `
      });
      const r = results && results[0];
      if (r && r.changed) await storageSet({ musicVolumeLowered: musicTab });
    }
  } catch (err) {
    console.error(err);
  }
}

async function handleTutorialPaused() {
  const data = await storageGet(['musicTab','mode','musicPausedByExt','musicVolumeLowered','fgVolume']);
  const musicTab = data.musicTab;
  const mode = data.mode || 'stop';
  const fgVol = data.fgVolume ?? 100;

  if (!musicTab) return;

  try {
    if (mode === 'stop' && data.musicPausedByExt === musicTab) {
      await tabsExecuteScript(musicTab, {
        code: `
          (function(){
            const videos = Array.from(document.querySelectorAll('video[data-paused-by-yt-switcher]'));
            videos.forEach(v => {
              try {
                const p = v.play();
                if (p && p.then) p.catch(()=>{});
                v.removeAttribute('data-paused-by-yt-switcher');
              } catch(e){}
            });
          })();
        `
      });
      await storageRemove(['musicPausedByExt']);
    } else if (mode === 'background' && data.musicVolumeLowered === musicTab) {
      const vol = Math.min(100, Math.max(0, fgVol)) / 100;
      await tabsExecuteScript(musicTab, {
        code: `
          (function(){
            const vol = ${vol};
            const videos = Array.from(document.querySelectorAll('video[data-orig-volume]'));
            videos.forEach(v => {
              try {
                v.volume = vol;
                v.removeAttribute('data-orig-volume');
              } catch(e){}
            });
          })();
        `
      });
      await storageRemove(['musicVolumeLowered']);
    }
  } catch (err) {
    console.error(err);
  }
}