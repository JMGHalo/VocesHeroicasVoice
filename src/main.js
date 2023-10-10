const http = require('http');
const url = require('url');
const querystring = require('querystring');
const WebSocket = require('ws');
const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');

let mainWindow;

//Flags de autoUpdater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('src/index.html');

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdates();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow()
    mainWindow.on('ready-to-show', () => {
      
    });
  };
});

ipcMain.on('app_version', (event) => {
  event.sender.send('app_version', { version: app.getVersion() });
});

autoUpdater.on('update-not-available', () => {
  connectWS();
});

autoUpdater.on('checking-for-update', () => {
  mainWindow.webContents.send('update_available');
});

autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update_available');
});

ipcMain.on('download_update', () => {
  autoUpdater.downloadUpdate();
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update_downloaded');
});


ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.on('restart_salty', () => {
  connectWS();
});


// SERVER

var conectado = false;
var serverUID = "";

var wsConnection = null; // Variable para mantener la conexión del WebSocket

// Configuración del cliente WebSocket
function connectWS(){
var wsClient = new WebSocket('ws://127.0.0.1:38088/', {
  perMessageDeflate: false, // Desactivar la compresión para mantener la conexión abierta
  handshakeTimeout: 0, // Deshabilitar el tiempo de espera del handshake
  maxPayload: 1024 * 1024, // Tamaño máximo del mensaje en bytes
});

// Control de errores
wsClient.on('error', (error) => {
  if (server != null){
    server.close();
    mainWindow.webContents.send('saltychat_disconnected');
  }else{
    mainWindow.webContents.send('saltychat_disconnected');
  }
    console.log('Error de websocket: ' + error);
})

wsClient.on('open', () => {
  console.log('Conexión WebSocket exitosa');
  wsConnection = wsClient;
  mainWindow.webContents.send('saltychat_connected');
});

wsClient.on('close', () => {
  server.close();
  console.log('Conexión WebSocket cerrada');
  mainWindow.webContents.send('saltychat_disconnected');
});

// Manejar los mensajes entrantes del WebSocket
wsClient.on('message', (message) => {
    try {
      const jsonMessage = JSON.parse(message);
      console.log('Mensaje JSON recibido:', jsonMessage);
	  
      // Si el mensaje es un "ping", responder con "pong"
      if (jsonMessage.Command === 3 && conectado) {
        console.log('Mensaje "3 - Ping" recibido de SaltyChat');

        // Responder al ping con un comando "4 - Pong"
        const pongCommand = {
          Command: 4,
          ServerUniqueIdentifier: serverUID,
          Parameter: null
        };
        wsConnection.send(JSON.stringify(pongCommand));
		console.log('Mensaje "4 - Pong" enviado a SaltyChat');
      }
    } catch (error) {
      console.error('Error al analizar el mensaje JSON:', error);
    }
});

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  const queryParams = querystring.parse(parsedUrl.query);

  if (queryParams.c === '1' && wsConnection) {
    // Enviar el comando "1 - Initiate" a SaltyChat
	serverUID = req.url.split("&suid=")[1];
    const initiateCommand = {
      Command: 1,
      ServerUniqueIdentifier: serverUID,
      Parameter: {
        ServerUniqueIdentifier: serverUID,
        Name: (parseInt(queryParams.n)*100).toString(),
        ChannelId: parseInt(queryParams.cid),
        ChannelPassword: queryParams.cpass,
        SoundPack: "default",
        SwissChannelIds: null,
        SendTalkStates: false,
        SendRadioTrafficStates: false,
        UltraShortRangeDistance: 1800.0,
        ShortRangeDistance: 3000.0,
        LongRangeDistace: 8000.0
      }
    };
    wsConnection.send(JSON.stringify(initiateCommand));

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Comando "1 - Initiate" enviado a SaltyChat');
	conectado = true;
  } else if (queryParams.c === '7' && wsConnection) {
    // Construir el mensaje JSON para el comando "7 - SelfStateUpdate"
    const selfStateUpdateCommand = {
      Command: 7,
      ServerUniqueIdentifier: serverUID,
      Parameter: {
        Position: { X: parseFloat(queryParams.x), Y: parseFloat(queryParams.y), Z: parseFloat(queryParams.z) },
        Rotation: parseFloat(queryParams.r),
        VoiceRange: parseFloat(queryParams.v),
        IsAlive: true,
        Echo: null
      }
    };

    // Enviar el mensaje JSON a SaltyChat
    wsConnection.send(JSON.stringify(selfStateUpdateCommand));

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Comando "7 - SelfStateUpdate" enviado a SaltyChat');
  } else if (queryParams.c === '8' && wsConnection) {
    // Construir el mensaje JSON para el comando "8 - PlayerStateUpdate"
    const playerStateUpdateCommand = {
      Command: 8,
      ServerUniqueIdentifier: serverUID,
      Parameter: {
        Name: (parseInt(queryParams.n)*100).toString(),
        Position: { X: parseFloat(queryParams.x), Y: parseFloat(queryParams.y), Z: parseFloat(queryParams.z) },
        Rotation: parseFloat(queryParams.r),
        VoiceRange: parseFloat(queryParams.v),
        IsAlive: true,
        VolumeOverride: null,
        DistanceCulled: false,
        Muffle: null
      }
    };

    // Enviar el mensaje JSON a SaltyChat
    wsConnection.send(JSON.stringify(playerStateUpdateCommand));

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Comando "8 - PlayerStateUpdate" enviado a SaltyChat');
	
  } else if (queryParams.c === '10' && wsConnection) {
    // Construir el mensaje JSON para el comando "10 - RemovePlayer"
    const playerStateUpdateCommand = {
      Command: 10,
      ServerUniqueIdentifier: serverUID,
      Parameter: {
        Name: (parseInt(queryParams.n)*100).toString()
      }
    };

    // Enviar el mensaje JSON a SaltyChat
    wsConnection.send(JSON.stringify(playerStateUpdateCommand));

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Comando "10 - RemovePlayer" enviado a SaltyChat');
  } else if (queryParams.c === '2' && wsConnection) {
    // Construir el mensaje JSON para el comando "2 - Reset"
    conectado = false;

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Comando "2 - Reset" enviado a SaltyChat');
  } else {
    // Manejar otros valores de "c" aquí según sea necesario
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Valor de "c" no válido');
  }
});

const PORT = 8080;

server.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
}