# Browser renderer

* Browser renderer is video clopping sample wiht headless Chrome
* Browser renderer はヘッドレススChromeを用いて映像の加工、配信を行うサンプルです


## Confirmed Environment / 動作確認環境

* Server OS
  * Mac OS X 10.12.5
  * Ubuntu 16.04 LTS
* Web Browser
  * Chrome  61.0.3163.100 (64-bit) for MacOS X
  * Firefox 55.0.3 (64-bit) for MacOS X


## Usage / 利用方法

#### Preparation / 準備

```
git clone https://github.com/mganeko/renderer_server.git
npm install
```

#### Start Server / サーバー開始

```
npm renderer_server.js
```

or 

```
npm start
```

#### Browser / ブラウザ

(1) Renderer Server

In case of { autoStartHeadless : false}  / 自動起動しない場合

* open http://localhost:3000/renderer_mcu.html with Chrome


(2) Client

* open http://localhost:3000/ with Chrome (room will be desiced automatically)

or

* open http://localhost:3000/?room=roomname with Chrome (to use specific room)



### NOTE / 注意

* mixed video will not be updated when window/tab is hidden
  * In headless browser, this is not a restriction
* ウィンドウ/タブが完全に隠れていると、合成した映像が更新されません
  * ヘッドレスブラウザの場合は、画面が見えなくても問題ありません

## License / ライセンス

* Browser renderer is under the MIT license
* Browser renderer はMITランセンスで提供されます
* サンプル動画は https://pixabay.com/ja/videos/リフト-ドライブ-山-風景-交通手段-夏-座る-登山鉄道-11237/ のものを利用させていただきました


## To Do

