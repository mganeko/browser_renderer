// ICE Server Config

let _PeerConnectionConfig = {
  "iceServers":[
    {"urls": "stun:stun.l.google.com:19302"}
  ]
};
let _PeerBandWidthConfig = { 
  "bandwidth": {
	"audio": 64,
	"video": 512
  }
};
