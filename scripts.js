const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const muteButton = document.getElementById('muteButton');
const echoButton = document.getElementById('echoButton');
const connectBluetoothButton = document.getElementById('connectBluetoothButton');
const disconnectBluetoothButton = document.getElementById('disconnectBluetoothButton');
const volumeControl = document.getElementById('volumeControl');
const pitchControl = document.getElementById('pitchControl');
const volumePercentage = document.getElementById('volumePercentage');
const pitchPercentage = document.getElementById('pitchPercentage');
const status = document.getElementById('status');
const visualizer = document.getElementById('visualizer');
const canvasContext = visualizer.getContext('2d');

let audioContext, analyser, gainNode, microphone, audioOutput, pitchShifter;
let dataArray, bufferLength;
let isMuted = false;
let echoEnabled = false;
let bluetoothDevice = null;
let bluetoothServer = null;
let bluetoothSpeaker = null;

class Jungle {
    constructor(context) {
        this.context = context;
        this.input = context.createGain();
        this.output = context.createGain();
        this.modulationNode = context.createGain();
        this.delayNode = context.createDelay();

        this.delayNode.delayTime.value = 0.05;

        this.modulationOscillator = context.createOscillator();
        this.modulationOscillator.type = 'sine';
        this.modulationOscillator.frequency.value = 10; // Higher frequency for chipmunk effect
        this.modulationOscillator.connect(this.modulationNode.gain);

        this.input.connect(this.delayNode);
        this.delayNode.connect(this.modulationNode);
        this.modulationNode.connect(this.output);

        this.modulationOscillator.start();
    }

    setPitchOffset(offset) {
        this.modulationNode.gain.value = offset * 4; // Increase offset for higher pitch
    }

    applyAITransformations(inputBuffer) {
        return inputBuffer;
    }
}

const initializeVisualizer = async () => {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    gainNode = audioContext.createGain();
    pitchShifter = new Jungle(audioContext);

    echoGainNode = audioContext.createGain();
    echoDelayNode = audioContext.createDelay();
    echoDelayNode.delayTime.value = 0.5;

    bassFilter = audioContext.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 200;

    midFilter = audioContext.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = 1000;
    midFilter.Q.value = 1;

    trebleFilter = audioContext.createBiquadFilter();
    trebleFilter.type = 'highshelf';
    trebleFilter.frequency.value = 3000;

    audioOutput = audioContext.createMediaStreamDestination();

    analyser.fftSize = 2048;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphone = audioContext.createMediaStreamSource(stream);
        microphone
            .connect(gainNode)
            .connect(pitchShifter.input)
            .connect(pitchShifter.output)
            .connect(bassFilter)
            .connect(midFilter)
            .connect(trebleFilter)
            .connect(analyser)
            .connect(audioOutput);

        if (echoEnabled) {
            enableEcho();  // Ensure echo is enabled if it's already active
        }

        const audioElement = new Audio();
        audioElement.srcObject = audioOutput.stream;
        audioElement.play();

        visualize();
    } catch (error) {
        console.error('Error accessing microphone:', error);
        status.innerText = `Error accessing microphone: ${error.message}`;
    }
};

// Start the microphone
startButton.addEventListener('click', () => {
    initializeVisualizer();
    status.innerText = 'Microphone is live...';
    startButton.disabled = true;
    stopButton.disabled = false;
    muteButton.disabled = false;
    echoButton.disabled = false;
    volumeControl.disabled = false;
    pitchControl.disabled = false;
});

// Stop the microphone
stopButton.addEventListener('click', () => {
    if (audioContext) {
        audioContext.close();
    }
    status.innerText = 'Microphone stopped.';
    startButton.disabled = false;
    stopButton.disabled = true;
    muteButton.disabled = true;
    echoButton.disabled = true;
    volumeControl.disabled = true;
    pitchControl.disabled = true;
});

// Mute functionality
muteButton.addEventListener('click', () => {
    isMuted = !isMuted;
    gainNode.gain.value = isMuted ? 0 : volumeControl.value / 100;
    changeButtonColor(muteButton, isMuted ? 'red' : 'blue');  // Change color based on mute status
});

// Echo functionality
echoButton.addEventListener('click', () => {
    echoEnabled = !echoEnabled;
    if (echoEnabled) {
        enableEcho();
    } else {
        disableEcho();
    }
    changeButtonColor(echoButton, echoEnabled ? 'yellow' : 'blue');  // Change color based on echo status
});

// Echo enable/disable functions
const enableEcho = () => {
    gainNode.connect(echoDelayNode);
    echoDelayNode.connect(echoGainNode);
    echoGainNode.connect(audioOutput);
};

const disableEcho = () => {
    gainNode.disconnect(echoDelayNode);
    echoDelayNode.disconnect(echoGainNode);
    echoGainNode.disconnect(audioOutput);
};

// Bluetooth connect/disconnect
connectBluetoothButton.addEventListener('click', async () => {
    const options = {
        acceptAllDevices: true
    };
    try {
        bluetoothDevice = await navigator.bluetooth.requestDevice(options);
        console.log(`> Name: ${bluetoothDevice.name}`);
        console.log(`> Id: ${bluetoothDevice.id}`);
        console.log(`> Connected: ${bluetoothDevice.gatt.connected}`);
        bluetoothServer = await bluetoothDevice.gatt.connect();
        const deviceName = bluetoothDevice.name || 'Unnamed Device';
        status.innerText = `Connected to ${deviceName}`;
        disconnectBluetoothButton.disabled = false;
        connectBluetoothButton.disabled = true;
        bluetoothSpeaker = bluetoothDevice; // Assigning the Bluetooth device to the output
    } catch (error) {
        if (error.name === 'NotFoundError') {
            status.innerText = 'No device selected. Please try again.';
        } else {
            console.error('Bluetooth connection failed:', error);
            status.innerText = `Error: ${error.message}`;
        }
    }
});

disconnectBluetoothButton.addEventListener('click', async () => {
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
        await bluetoothDevice.gatt.disconnect();
        const deviceName = bluetoothDevice.name || 'Unnamed Device';
        status.innerText = `Disconnected from ${deviceName}`;
        bluetoothSpeaker = null; // Clearing the Bluetooth speaker
    } else {
        status.innerText = 'No device is connected.';
    }
    disconnectBluetoothButton.disabled = true;
    connectBluetoothButton.disabled = false;
});

// Volume control
volumeControl.addEventListener('input', (event) => {
    const volume = event.target.value;
    gainNode.gain.value = volume / 100;
    volumePercentage.innerText = `${volume}%`;
});

// Pitch control
pitchControl.addEventListener('input', (event) => {
    const offset = event.target.value;
    pitchShifter.setPitchOffset((offset - 50) / 10); // Adjust to range -5 to 5 for higher pitch
    pitchPercentage.innerText = `${offset}%`;
});

// Visualizer function
const visualize = () => {
    requestAnimationFrame(visualize);
    analyser.getByteTimeDomainData(dataArray);
    canvasContext.clearRect(0, 0, visualizer.width, visualizer.height);

    // Create a gradient
    const gradient = canvasContext.createLinearGradient(0, 0, visualizer.width, visualizer.height);
    gradient.addColorStop(0, 'rgb(255, 0, 0)');
    gradient.addColorStop(0.5, 'rgb(0, 255, 0)');
    gradient.addColorStop(1, 'rgb(0, 0, 255)');
    canvasContext.strokeStyle = gradient;

    canvasContext.lineWidth = 2;
    canvasContext.beginPath();
    const sliceWidth = visualizer.width * 1.0 / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * visualizer.height / 2;
        if (i === 0) {
            canvasContext.moveTo(x, y);
        } else {
            canvasContext.lineTo(x, y);
        }
        x += sliceWidth;
    }
    canvasContext.lineTo(visualizer.width, visualizer.height / 2);
    canvasContext.stroke();
};

// Automatically guide user on page load
window.addEventListener('load', () => {
    status.innerText = 'Ready to start your audio experience.';
});
