// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
const ipc = require('electron').ipcRenderer;
const Store = require('electron-store');
const {shell} = require('electron');
const store = new Store();
var Timer = require('time-counter');
var moment = require('moment');
const viperHTML = require('viperhtml');

const countUpTimer = new Timer({
    direction: 'up'
});

let track;

function populateTrack () {
    var trackElement = document.getElementById('track');
    var timeElement = document.getElementById('time');
    
    if (track.currentTracking) {
        trackElement.style.backgroundColor = track.currentTracking.activity.color;
        trackElement.innerHTML = track.currentTracking.activity.name;

        // TIMER
        let now = moment.utc();
        let then = moment.utc(track.currentTracking.startedAt);
        let diff = moment.utc(now.diff(then)).format("HH:mm:ss");
        
        countUpTimer.config.startValue = diff;
        countUpTimer.start();
        countUpTimer.on('change', (time) => timeElement.innerHTML = time);
    } else {
        countUpTimer.stop();
        trackElement.innerHTML = "Nothing :O";
        timeElement.innerHTML = "";
    }
}

ipc.on('tracking', (e, tracking) => {
    track = tracking;
    populateTrack();
})

function openSettings(open) {
    if (open) {
        viperHTML.bind(document.getElementById('settings'))`
        <h1>Enter your keys:</h1>
        <form
            name=keys
            onsubmit=${function(e) {
                e.preventDefault();
                ipc.send('keys', {
                    public: this.public.value,
                    private: this.private.value
                });
            }}
        >
            <input placeholder="Public Key" type="text" name=public oninput=${this} required><br><br>
            <input placeholder="Private Key" type="text" name=private oninput=${this} type=password required><br><br>
            <input
                value='SET'
                type=submit
            >
        </form>
        <div class="key">Need the keys? 
            <span onclick="${() => shell.openExternal('https://profile.timeular.com/#/app/')}">
                Try here!
            </span>
        </div>
        `;
        viperHTML.bind(document.getElementById('app'))``;
    } else {
        viperHTML.bind(document.getElementById('settings'))``;
        viperHTML.bind(document.getElementById('app'))`
        <h2>You are tracking<br><span id="track"></span><br><span id="time"></span></h2>
        `;
    }
}


if (store.get('user')) {
    openSettings(false);
} else {
    openSettings(true);
    ipc.on('user', (e, user) => {
        openSettings(false);
    });
}