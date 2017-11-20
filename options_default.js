'use strict';

module.exports =
{
  serverOptions: {
    listenPort : 3000,
    hostName : 'localhost',
    useHttps : false,
    httpsKeyFile: 'cert/server.key',
    httpsCertFile: 'cert/server.crt',
    dummyTail : false
  },
  mcuOptions : {
    autoStartHeadless : true,
    headlessFullpath: '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome', // for MacOS X
    //headlessFullpath: /usr/bin/google-chrome-stable', // for Ubuntu 16.04 LTS
    headlessArgs: ['--headless', '--no-sandbox',  '--remote-debugging-port=9222'], // With Debug port
    headlessUrlRenderer: 'renderer_mcu.html',
    dummyTail : false
  }
}
