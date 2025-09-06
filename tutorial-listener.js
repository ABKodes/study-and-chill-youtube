(function() {
  if (window.__yt_tab_switcher_attached) return;
  window.__yt_tab_switcher_attached = true;

  function notify(action) {
    try { chrome.runtime.sendMessage({action}); } catch(e){}
  }

  function attach(video){
    if (!video || video.__yt_tab_switcher_listened) return;
    video.__yt_tab_switcher_listened = true;
    video.addEventListener('play',()=>notify('tutorialPlaying'),{passive:true});
    video.addEventListener('playing',()=>notify('tutorialPlaying'),{passive:true});
    video.addEventListener('pause',()=>notify('tutorialPaused'),{passive:true});
    video.addEventListener('ended',()=>notify('tutorialPaused'),{passive:true});
  }

  function checkVideo(){
    const v = document.querySelector('video');
    if(v) attach(v);
  }

  checkVideo();
  const observer = new MutationObserver(()=>checkVideo());
  observer.observe(document,{childList:true,subtree:true});
  document.addEventListener('visibilitychange',checkVideo);
  window.addEventListener('yt-navigate-finish',checkVideo,true);
})();
