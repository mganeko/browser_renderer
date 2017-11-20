//
// Browser RENDERER Core
//   https://github.com/mganeko/browser_renderer_core
//   browser_renderer_core is provided under MIT license
//
//  Description:
//    Browser RENDERER Core is a part of Browser RENDERER series.
//    Provide Video / Audio mix only, no signaling, no PeerConnections

// --- RENDERER core tasks --
//  - re-write README.md
//  DONE - clean up, when member reloded (server)
//  DONE - modify init() with args
//  NOT HERE. Canvas will be given from outside. - change canvas size
//  NO EFFECT: - change remote video size
//  DONE - remote video visible/hidden
//  DONE - chage FPS
//  NOT HERE. should be done with PeerConnection.  - change bandwidth
//  - support free size Canvas
//
//  - support multiple video for same peer 
//  - support multiple audio for same peer



"use strict"

var BrowserRENDERER = function() {
  // --- for video mix ---
  const MAX_SOURCE_COUNT = 1;
  let remoteStreams = [];
  let remoteVideos = [];
  let mixStream = null;
  let videoContainer = null;
  let view_channel_key = null;
  let angle = 0;
  
//  const MIX_CAPTURE_FPS = 15;
  const MIX_CAPTURE_FPS = 30;
  //const canvasMix = document.getElementById('canvas_mix');
  //const ctxMix = canvasMix.getContext('2d');
  //ctxMix.fillStyle = 'rgb(128, 128, 255)';
  let canvasMix = null;
  let ctxMix = null;
  let animationId = null;
  let keepAnimation = false;
  //let mixWidth = 320;
  //let mixHeight = 180;
  let mixWidth = 1920;
  let mixHeight = 1080;
  let remoteVideoWidthRate = 16; // 16:9
  let remoteVideoHeightRate = 9; // 16:9
  //let remoteVideoUnit = 20; // NOTE: seems no effect
  let remoteVideoUnit = 120; // NOTE: seems no effect
    // remoteVideoWidth = remoteVideoWidthRate*remoteVideoUnit = 16*20 = 320
    // remoteVideoHeight = remoteVideoHeightRate*remoteVideoUnit = 9*20 = 180
  let frameRate = MIX_CAPTURE_FPS; // Frame per second
  let hideChannelVideoFlag = false; // Hide Channel Video

  // -- for audio mix --
  //const _AUDIO_MODE_NONE = 0;
  //const _AUDIO_MODE_MINUS_ONE = 1;
  const _AUDIO_MODE_ALL = 1;
  const AuidoContect = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AuidoContect(); //new window.AudioContext();
  let audioMode = _AUDIO_MODE_ALL;
  let inputNodes = [];
  let gainNodes = [];
  let mixAllOutputNode = null;
  let audioMixAllStream = null;


  // --- init MCU ----
  this.setCanvas = function(canvas) {
    canvasMix = canvas;
    ctxMix = canvasMix.getContext('2d');
    ctxMix.fillStyle = 'rgb(128, 128, 255)';
    mixWidth = canvasMix.width;
    mixHeight = canvasMix.height;
  }

  this.setContainer = function(container) {
    videoContainer = container;
  }

  this.setAudioMode = function(mode) {
    audioMode = mode;
  }

  // --- init at once ---
  this.init = function(canvas, container, mode) {
    this.setCanvas(canvas);
    this.setContainer(container);
    this.setAudioMode(mode);
  }

  // -- set Frame Rate (FPS) --
  this.setFrameRate = function(rate) {
    frameRate = rate;
  }
  this.setAngle = function(angle_data) {
    _clearMixCanvas();
    angle = angle_data;
  }

  // NOTE: seems no effect
  this.setChannelVideoUnit = function(unit) {
    remoteVideoUnit = unit;
  }

  this.hideChannelVideo = function(hideFlag) {
    hideChannelVideoFlag = hideFlag;
  }

  // --- start/stop Mix ----
  this.startMix = function() {
    //mixStream = canvasMix.captureStream(MIX_CAPTURE_FPS);
    mixStream = canvasMix.captureStream(frameRate);
    if (audioMode === BrowserRENDERER.AUDIO_MODE_ALL) {
      mixAllOutputNode = audioContext.createMediaStreamDestination();
      audioMixAllStream = mixAllOutputNode.stream;
      mixStream.addTrack(audioMixAllStream.getAudioTracks()[0]);
    }

    animationId = window.requestAnimationFrame(_drawMixCanvas);
    keepAnimation = true;
    console.log('--start mix and capture stream--');
  }

  this.stopMix = function() {
    if (mixAllOutputNode) {
      // NG mixAllOutputNode.stop();
      audioMixAllStream = null;
      mixAllOutputNode = null;
    }

    if (mixStream) {
      _stopStream(mixStream);
      mixStream = null;
    }

    if (animationId) {
      window.cancelAnimationFrame(animationId);
      animationId = null;
    }
    keepAnimation = false;

    console.log('--stop mix and capture stream--');
  }

  function _stopStream(stream) {
    let tracks = stream.getTracks();
    if (! tracks) {
      console.warn('NO tracks');
      return;
    }

    for (let track of tracks) {
      track.stop();
    }
  }

  this.getMixStream = function() {
    return mixStream;
  }

  // ---- mix video ----
  function _clearMixCanvas() {
    ctxMix.fillRect(0, 0, mixWidth, mixHeight);
  }

  function _drawMixCanvas() {
    //console.log('--drawMixCanvas--');
    let i = 0;
    // for(let key in remoteVideos) {
    //   let video = remoteVideos[key];
    //   _drawVideo(video, i, horzCount, vertCount);
    //   i++;
    // }
    if (view_channel_key) {
      let video = remoteVideos[view_channel_key];
      _drawVideo(video);
    }

    if (keepAnimation) {
      window.requestAnimationFrame(_drawMixCanvas);
    }
  }

  // ---- matrix info ---

  function _drawVideo(video) {
    const destTop = 0;
    let destLeft = 0; 
    let destWidth = mixWidth;
    let destHeight =mixHeight;

    const destRatio = destWidth / destHeight;
    const destRatioAdjust = destRatio / (16 / 9);
    //console.log('destRatio=' + destRatio + '  adjust=' + destRatioAdjust);

    // === make 4:3 area ====
    //const horzUnit = video.videoWidth / 4;
    //const vertUnit = video.videoHeight / 3;
    const horzUnit = video.videoWidth / 16 / destRatioAdjust;
    const vertUnit = video.videoHeight / 9;
    let unit = 20;

    if (horzUnit > vertUnit) {
      // -- landscape, so clip side --
      unit = vertUnit;
    }
    else {
      // --- portrait, so cut top/bottom -- 
      unit = horzUnit;
    }

    let srcWidth = unit * 16 * destRatioAdjust;
    const srcHeight = unit * 9;
    const xCenter = video.videoWidth / 2;
    const yCenter =  video.videoHeight / 2;
    let srcLeft = xCenter - (srcWidth /2);
    const srcTop = yCenter - (srcHeight /2);

    if (angle == 1) {
      srcWidth = unit * 16 * destRatioAdjust / 2;
      srcLeft = srcWidth * (angle - 1);
      destLeft = mixWidth /2 - mixWidth / 4;
      destWidth = mixWidth / 2;
    }
    if (angle == 2) {
      srcWidth = unit * 16 * destRatioAdjust / 2;
      srcLeft = xCenter - (srcWidth /2);
      destLeft = mixWidth /2 - mixWidth / 4;
      destWidth = mixWidth / 2;
    }
    if (angle == 3) {
      srcWidth = unit * 16 * destRatioAdjust / 2;
      srcLeft = srcWidth * (angle - 2);
      destLeft = mixWidth /2 - mixWidth / 4;
      destWidth = mixWidth / 2;
    }

    ctxMix.drawImage(video, srcLeft, srcTop, srcWidth, srcHeight,
      destLeft, destTop, destWidth, destHeight
    );
  }

  function _checkVideoCount() {
    let sourceCount = _getChannelVideoCount();
    if (sourceCount > MAX_SOURCE_COUNT) {
      console.warn('TOO MANY source. max=' + MAX_SOURCE_COUNT);
    }
  }

  // ------- handling remote video --------------
  function _getChannelVideoCount() {
    return Object.keys(remoteVideos).length;
  }

  this.getChannelVideoKeys = function() {
    return Object.keys(remoteVideos);
  }
  this.setViewChannelKey = function(channelKey) {
    view_channel_key = channelKey;
    for(let key in inputNodes) {
      let remoteGainNode = gainNodes[key];
      if (key === channelKey) {
        remoteGainNode.gain.value = 1;

      } else {
        remoteGainNode.gain.value = 0;
      }
    }

  }

  this.addChannelVideo = function(remoteVideo) {
    //let remoteVideo = document.createElement('video');
    //remoteVideo.id = 'remotevideo_' + stream.id;
    remoteVideo.style.border = '1px solid black';
    //remoteVideo.style.width = "320px"; // 16x20; //"480px"; // 16x30
    //remoteVideo.style.height = "180px"; // 9x20; //"270px"; // 9x30
    remoteVideo.style.width = remoteVideoWidthRate * remoteVideoUnit + 'px'; 
    remoteVideo.style.height = remoteVideoHeightRate * remoteVideoUnit + 'px'; 

    // to hide :: remoteVideo.style.display = 'none'; // for Chrome (hidden NG)
    if (hideChannelVideoFlag) {
      // -- hide remote video --
      remoteVideo.style.display = 'none'; // for Chrome (hidden NG)
    }
    //remoteVideo.controls = true;

    //remoteVideo.srcObject = stream;
    //videoContainer.appendChild(remoteVideo);
    //remoteVideo.volume = 0;
    remoteVideo.volume = 1;
    remoteVideo.muted = false;
    remoteVideo.play();

    //remoteStreams[0] = stream;
    remoteVideos[remoteVideo.id] = remoteVideo;
    _checkVideoCount();
    _clearMixCanvas();
    //if (!view_channel_key) {
    //  view_channel_key = stream.id;
      view_channel_key = remoteVideo.id;
    //}
  }

  this.removeChannelVideo = function(remoteVideo) {
    //const videoId = "remotevideo_" + stream.id;
    //let remoteVideo = document.getElementById(videoId); //'remotevideo_' + event.stream.id);
    remoteVideo.pause();
    //remoteVideo.srcObject = null;
    //videoContainer.removeChild(remoteVideo);

    let video = remoteVideos[remoteVideo.id];
    if (video !== remoteVideo) {
      console.error('VIDEO element NOT MATCH');
    }
    // NG //console.log('Before Delete video len=' + remoteVideos.length);
    console.log('Before Delete video keys=' + Object.keys(remoteVideos).length);
    delete remoteVideos[remoteVideo.id];
    // NG //console.log('After Delete video len=' + remoteVideos.length);
    console.log('After Delete video keys=' + Object.keys(remoteVideos).length);

    // NG //console.log('Before Delete Stream len=' + remoteStreams.length);
    // console.log('Before Delete Stream keys=' + Object.keys(remoteStreams).length);
    // delete remoteStreams[0];
    // NG //console.log('After Delete Stream len=' + remoteStreams.length);
    //console.log('After Delete Stream keys=' + Object.keys(remoteStreams).length);

    _checkVideoCount();
    _clearMixCanvas();
    //if (view_channel_key == stream.id) {
    //  view_channel_key = null;
      view_channel_key = null;
    //}
  }

  this.removeAllChannelVideo = function() {
    console.log('===== removeAllChannelVideo ======');
    for(let key in remoteVideos) {
      let video = remoteVideos[key];
      video.pause();
      //video.srcObject = null;
      //videoContainer.removeChild(video);
    }
    remoteVideos = [];

    // for(let key in remoteStreams) {
    //   let stream = remoteStreams[key];
    //   _stopStream(stream);
    // }
    // remoteStreams = [];

    _checkVideoCount();
    _clearMixCanvas();
    view_channel_key = null;
  }

  // --- handling remote audio ---
  this.addChannelAudio = function(video) {
    console.log('addChannelAudio()');
    let remoteNode = audioContext.createMediaElementSource(video);
    let gainNode = audioContext.createGain();
    inputNodes[video.id] = remoteNode;
    gainNodes[video.id] = gainNode;

    if (audioMode === BrowserRENDERER.AUDIO_MODE_ALL) {
      console.log('BrowserRENDERER.AUDIO_MODE_ALL: mix all audo');
      gainNodes[video.id].gain.value = 1;
      inputNodes[video.id].connect(gainNodes[video.id]);
      gainNodes[video.id].connect(mixAllOutputNode);
      //inputNodes[stream.id].connect(mixAllOutputNode);
    }
    else if (audioMode === BrowserRENDERER.AUDIO_MODE_NONE) {
      // AUDIO_MODE_NONE
      console.log('BrowserRENDERER.AUDIO_MODE_NONE: ignore remote audio');
    }
    else {
      // WRONG audioMode
      console.error('BAD audioMode');
    }
  }

  this.removeChannelAudio = function(video) {
    let remoteNode = inputNodes[video.id];
    if (remoteNode) {
      inputNodes[video.id].disconnect(gainNodes[video.id]);
      gainNodes[video.id].disconnect(mixAllOutputNode);
      delete inputNodes[video.id];
      delete gainNodes[video.id];
    }
    else {
      console.warn('removeChannelAudio() remoteStream NOT EXIST');
    }
  }

  this.removeAllChannelAudio = function() {
    console.log('===== removeAllChannelAudio ======');
    for(let key in inputNodes) {
      let remoteInputNode = inputNodes[key];
      let remoteGainNode = gainNodes[key];
      remoteInputNode.disconnect(remoteGainNode);
      remoteGainNode.disconnect(mixAllOutputNode);
    }
    inputNodes = [];
    gainNodes = [];
  }

};

BrowserRENDERER.AUDIO_MODE_NONE = 0;
BrowserRENDERER.AUDIO_MODE_ALL = 1;

