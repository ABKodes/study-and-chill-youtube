document.addEventListener('DOMContentLoaded', () => {
  const setMusicBtn = document.getElementById('setMusic');
  const setTutorialBtn = document.getElementById('setTutorial');
  const clearBtn = document.getElementById('clear');
  const musicInfo = document.getElementById('musicInfo');
  const tutorialInfo = document.getElementById('tutorialInfo');
  const status = document.getElementById('status');
  const modeSelect = document.getElementById('modeSelect');
  const volumeSettings = document.getElementById('volumeSettings');
  const bgSlider = document.getElementById('bgVolumeSlider');
  const fgSlider = document.getElementById('fgVolumeSlider');
  const bgValue = document.getElementById('bgValue');
  const fgValue = document.getElementById('fgValue');

  function setStatus(msg, timeout = 3500) {
    status.textContent = msg || '';
    if (msg && timeout) setTimeout(() => { status.textContent = ''; }, timeout);
  }

  function isYouTubeUrl(url) {
    return url && (url.includes('youtube.com/watch') || url.includes('youtu.be') || url.includes('youtube.com/shorts'));
  }

  function updateUI() {
    chrome.storage.local.get(['musicTab','tutorialTab','mode','bgVolume','fgVolume'], (res) => {
      if (res.musicTab) {
        chrome.tabs.get(res.musicTab, tab => musicInfo.textContent = tab ? (tab.title.length>60?tab.title.slice(0,60)+'…':tab.title) : '(closed)');
      } else musicInfo.textContent = '—';

      if (res.tutorialTab) {
        chrome.tabs.get(res.tutorialTab, tab => tutorialInfo.textContent = tab ? (tab.title.length>60?tab.title.slice(0,60)+'…':tab.title) : '(closed)');
      } else tutorialInfo.textContent = '—';

      modeSelect.value = res.mode || 'stop';
      bgSlider.value = res.bgVolume ?? 20;
      fgSlider.value = res.fgVolume ?? 100;
      bgValue.textContent = bgSlider.value;
      fgValue.textContent = fgSlider.value;
      toggleVolumeSettings();
    });
  }

  function toggleVolumeSettings() {
    volumeSettings.style.display = (modeSelect.value === 'background') ? 'block' : 'none';
  }

  function saveSettings() {
    const mode = modeSelect.value;
    const bgVolume = parseInt(bgSlider.value) || 20;
    const fgVolume = parseInt(fgSlider.value) || 100;
    chrome.storage.local.set({mode, bgVolume, fgVolume});
  }

  modeSelect.addEventListener('change', () => { toggleVolumeSettings(); saveSettings(); });
  bgSlider.addEventListener('input', () => { bgValue.textContent = bgSlider.value; saveSettings(); });
  fgSlider.addEventListener('input', () => { fgValue.textContent = fgSlider.value; saveSettings(); });

  setMusicBtn.addEventListener('click', () => {
    chrome.tabs.query({active:true,currentWindow:true}, tabs => {
      const tab = tabs[0];
      if (!tab) return setStatus('No active tab.');
      if (!isYouTubeUrl(tab.url)) return setStatus('Please open a YouTube video in the tab before setting as Music.');
      chrome.storage.local.set({musicTab: tab.id}, () => { setStatus('Music tab set.'); updateUI(); });
    });
  });

  setTutorialBtn.addEventListener('click', () => {
    chrome.tabs.query({active:true,currentWindow:true}, tabs => {
      const tab = tabs[0];
      if (!tab) return setStatus('No active tab.');
      if (!isYouTubeUrl(tab.url)) return setStatus('Please open a YouTube video in the tab before setting as Tutorial.');
      // MV2 injection: use tabs.executeScript instead of scripting.executeScript
      chrome.tabs.executeScript(tab.id, { file: 'tutorial-listener.js' }, () => {
        if (chrome.runtime.lastError) return setStatus('Injection failed: ' + chrome.runtime.lastError.message);
        chrome.storage.local.set({tutorialTab: tab.id}, () => { setStatus('Tutorial tab set.'); updateUI(); });
      });
    });
  });

  clearBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['musicTab','tutorialTab','musicPausedByExt','musicVolumeLowered'], () => { setStatus('Cleared.'); updateUI(); });
  });

  updateUI();
});