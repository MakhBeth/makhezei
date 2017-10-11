const electron = require('electron')
// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

const path = require('path')
const url = require('url')


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 800, height: 600})

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
const ipc = require('electron').ipcMain;
const Store = require('electron-store');
const store = new Store();
const notifier = require('node-notifier');
const Tray = require('electron').Tray;
const Menu = require('electron').Menu;
var moment = require('moment');
var Timer = require('time-counter');

var https = require('https');

var promiseReq = require('request-promise');

// const promiseReq = (options, body) => {
//     return new Promise((resolve, reject) => {
//         const request = https.request(options, (response) => {

//           if (response.statusCode < 200 || response.statusCode > 299) {
//              reject(new Error('Failed to load page, status code: ' + response.statusCode, response));
//            }

//           const body = [];
//           response.on('data', (chunk) => body.push(chunk));
//           response.on('end', () => resolve(JSON.parse(body.join(''))));
//         });

//         request.on('error', (err) => reject(err))

//         if (body) {
//             request.write(JSON.stringify(body))
//         }
//         request.end();
//     })
// }

async function userToken(apiKey, apiSecret) {
    if(store.get('token')) {
        return store.get('token');
    } else {
        const userToken = promiseReq(
            {
                uri: 'https://api.timeular.com/api/v1/developer/sign-in',
                method: 'POST',
                body: {
                    'apiKey': apiKey,
                    'apiSecret': apiSecret
                },
                json: true
            }
        );
        const token = await userToken;
        store.set('token', token);
        return token;
    }
}

async function logUser (public, private) {
    const token = await userToken(public, private);
    const getUser = promiseReq.bind(null,
        {
            uri: 'https://api.timeular.com/api/v1/user/profile', 
            headers: {
                'Authorization': 'Bearer ' + token.token
            },
            json: true
        }
    );
    const user = await getUser();
    mainWindow.webContents.send('user', user);
    store.set('user', user);
    startApp();
}

ipc.on('keys', (e, keys) => {
  logUser(keys.public, keys.private);
})



async function getTracking () {
    const token = await userToken();
    const tracking = promiseReq.bind(null,
        {
            uri: 'https://api.timeular.com/api/v1/tracking', 
            headers: {
                'Authorization': 'Bearer ' + token.token
            },
            json: true
        }
    );
    const track = await tracking();
    mainWindow.webContents.send('tracking', track);
    return track;
}

let currentTracking = '';

async function getActivities () {
    const token = await userToken();

    const getActivities = promiseReq.bind(null,
        {
            uri: 'https://api.timeular.com/api/v1/activities', 
            headers: {
                'Authorization': 'Bearer ' + token.token
            },
            json: true
        }
    );
    const activities = await getActivities();
    mainWindow.webContents.send('activities', activities);
    return activities.activities;
}

async function stopActivity (id) {
    let stopped = moment.utc().format("YYYY-MM-DDTHH:mm:ss.SSS");
    let currentActivity = await getTracking().currentTracking;
    const token = await userToken();
    const postActivity = promiseReq.bind(null,
        {
            uri: 'https://api.timeular.com/api/v1/tracking/' + id + '/stop', 
            headers: {
                'Authorization': 'Bearer ' + token.token,
                'Content-Type': 'application/json'
            },
            method: 'POST',
            body: {
                "stoppedAt": stopped
            },
            json: true
        }
    );
    const activity = await postActivity();
}

async function startActivity (id) {
    let started = moment.utc().format("YYYY-MM-DDTHH:mm:ss.SSS");
    const token = await userToken();
    const postActivity = promiseReq.bind(null,
        {
            uri: 'https://api.timeular.com/api/v1/tracking/' + id + '/start', 
            headers: {
                'Authorization': 'Bearer ' + token.token,
                'Content-Type': 'application/json'
            },
            method: 'POST',
            body: {
                "startedAt": started
            },
            json: true
        }
    );
    const activity = await postActivity();
    mainWindow.webContents.send('activity-stopped', activity);
}
async function startApp () {
    setInterval(async function() {
        if(store.get('token')) {
            let tracking = await getTracking();
            
            let trackingId = tracking && tracking.currentTracking && tracking.currentTracking.activity ? tracking.currentTracking.activity.id : false;
            
            if (trackingId !== currentTracking) {
                currentTracking = trackingId;
                osUpdate(tracking)
            }
        }
    }, 1500);

    const countUpTimer = new Timer({
        direction: 'up'
    });
    countUpTimer.on('change', (time) => {
        appIcon.setTitle(countUpTimer.config.string + ' ' + time);
        appIcon.setToolTip(countUpTimer.config.string + ' ' + time);
    });

    // tray
    const iconName = process.platform === 'win32' ? 'windows-icon.png' : 'iconTemplate.png'
    const iconPath = path.resolve(__dirname, 'img', iconName);
    let appIcon = new Tray(iconPath);

    const activities = await getActivities();
    let menuItems = activities.map((activity) => {
        let result = {
            'label': activity.name,
            'click': async () => {
                let currentActivity = await getTracking();
                if(currentActivity.currentTracking) {
                    stopActivity(
                        currentActivity.currentTracking.activity.id
                    ).then( () => startActivity(activity.id));
                } else {
                    startActivity(activity.id, moment.utc().format("YYYY-MM-DDTHH:mm:ss.SSS"));
                }
            }
        };
        return result;
    });
    menuItems.push(
        {'type': 'separator'},
        {
            'id': 'stopTracking',
            'label': 'Tracking stopped'
        },
        {'type': 'separator'},
        {'label': 'Settings'}
    );
    let stopIndex = menuItems.findIndex((el) => el.id == 'stopTracking');
    let contextMenu = Menu.buildFromTemplate(menuItems)
    appIcon.setContextMenu(contextMenu);

    function osUpdate (tracking) {
        if (tracking.currentTracking) {
            notifier.notify({
                title: 'Tracking started',
                message: tracking.currentTracking.activity.name
            });

            let now = moment.utc();
            let then = moment.utc(tracking.currentTracking.startedAt);
            let diff = moment.utc(now.diff(then)).format("HH:mm:ss");
            
            countUpTimer.config.startValue = diff;
            countUpTimer.config.string = tracking.currentTracking.activity.name;
            countUpTimer.start();

            menuItems[stopIndex] = {
                'label': 'Stop ' + tracking.currentTracking.activity.name,
                'click': () => stopActivity(tracking.currentTracking.activity.id)
            };
            contextMenu = Menu.buildFromTemplate(menuItems)
            appIcon.setContextMenu(contextMenu);
            
        } else {
            notifier.notify({
                title: 'Tracking stopped',
                message: 'Enjoy!'
            });
            countUpTimer.stop();
            appIcon.setTitle('');
            menuItems[stopIndex] = {
                'label': 'Tracking stopped',
            };
            contextMenu = Menu.buildFromTemplate(menuItems)
            appIcon.setContextMenu(contextMenu);
        }
    }
}

app.on('ready', async () => {
    if(store.get('token')) { startApp() }
});