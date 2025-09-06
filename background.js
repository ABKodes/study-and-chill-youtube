function storageGet(keys){return new Promise(res=>chrome.storage.local.get(keys,res));}
function storageSet(obj){return new Promise(res=>chrome.storage.local.set(obj,res));}
function storageRemove(keys){return new Promise(res=>chrome.storage.local.remove(keys,res));}

chrome.runtime.onMessage.addListener((msg)=>{
  if(!msg?.action) return;
  if(msg.action==='tutorialPlaying') handleTutorialPlaying().catch(console.error);
  else if(msg.action==='tutorialPaused') handleTutorialPaused().catch(console.error);
});

async function handleTutorialPlaying(){
  const data = await storageGet(['musicTab','mode','bgVolume','fgVolume']);
  const musicTab = data.musicTab, mode=data.mode||'stop', bgVol=data.bgVolume??20;

  if(!musicTab) return;

  try{
    if(mode==='stop'){
      const results = await chrome.scripting.executeScript({
        target:{tabId:musicTab},
        func:()=>{const videos=Array.from(document.querySelectorAll('video')); let pausedAny=false; videos.forEach(v=>{try{if(!v.paused&&!v.ended){v.pause();v.setAttribute('data-paused-by-yt-switcher','1');pausedAny=true;}}catch(e){}}); return {pausedAny};}
      });
      if(results?.[0]?.result?.pausedAny) await storageSet({musicPausedByExt:musicTab});
    }else if(mode==='background'){
      const targetVol = Math.min(100,Math.max(0,bgVol))/100;
      const results = await chrome.scripting.executeScript({
        target:{tabId:musicTab},
        args:[targetVol],
        func:(targetVol)=>{const videos=Array.from(document.querySelectorAll('video')); let changed=false; videos.forEach(v=>{try{if(!v.hasAttribute('data-orig-volume'))v.setAttribute('data-orig-volume',v.volume); v.volume=targetVol; changed=true;}catch(e){}}); return {changed};}
      });
      if(results?.[0]?.result?.changed) await storageSet({musicVolumeLowered:musicTab});
    }
  }catch(err){console.error(err);}
}

async function handleTutorialPaused(){
  const data = await storageGet(['musicTab','mode','musicPausedByExt','musicVolumeLowered','fgVolume']);
  const musicTab=data.musicTab, mode=data.mode||'stop', fgVol=data.fgVolume??100;

  if(!musicTab) return;

  try{
    if(mode==='stop' && data.musicPausedByExt===musicTab){
      await chrome.scripting.executeScript({
        target:{tabId:musicTab},
        func:()=>{const videos=Array.from(document.querySelectorAll('video[data-paused-by-yt-switcher]')); videos.forEach(v=>{try{const p=v.play(); if(p&&p.then)p.catch(()=>{}); v.removeAttribute('data-paused-by-yt-switcher');}catch(e){}});}
      });
      await storageRemove(['musicPausedByExt']);
    }else if(mode==='background' && data.musicVolumeLowered===musicTab){
      const targetVol = Math.min(100,Math.max(0,fgVol))/100;
      await chrome.scripting.executeScript({
        target:{tabId:musicTab},
        args:[targetVol],
        func:(vol)=>{const videos=Array.from(document.querySelectorAll('video[data-orig-volume]')); videos.forEach(v=>{try{v.volume=vol; v.removeAttribute('data-orig-volume');}catch(e){}});}
      });
      await storageRemove(['musicVolumeLowered']);
    }
  }catch(err){console.error(err);}
}
