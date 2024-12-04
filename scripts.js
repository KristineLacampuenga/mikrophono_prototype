const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const muteButton = document.getElementById('muteButton');
const echoButton = document.getElementById('echoButton');
const volumeControl = document.getElementById('volumeControl');
const pitchControl = document.getElementById('pitchControl');
const volumePercentage = document.getElementById('volumePercentage');
const pitchPercentage = document.getElementById('pitchPercentage');
const status = document.getElementById('status');
const visualizer = document.getElementById('visualizer');
const canvasContext = visualizer.getContext('2d');

let audioContext, analyser, gainNode, microphone, audioOutput;
let dataArray, bufferLength;
let isMuted = false;
let pitchShifter;
let echoEnabled = false;
let echoGainNode, echoDelayNode;
let bassFilter, midFilter, trebleFilter;

// Class for pitch shifting modulation (Jungle effect)
class Jungle {
    constructor(context) {
        this.context = context;
        this.input = context.createGain();
        this.output = context.createGain();
        this.modulationNode = context.createGain();
        this.delayNode = context.createDelay();

        this.delayNode.delayTime.value = 0.01;
        this.modulationOscillator = context.createOscillator();
        this.modulationOscillator.type = 'sine';
        this.modulationOscillator.frequency.value = 60;
        this.modulationOscillator.connect(this.modulationNode.gain);

        this.input.connect(this.delayNode);
        this.delayNode.connect(this.modulationNode);
        this.modulationNode.connect(this.output);

        this.modulationOscillator.start();
    }

    setPitchOffset(offset) {
        this.modulationNode.gain.value = offset * 10;
    }

    applyAITransformations(inputBuffer) {
        return inputBuffer;
    }
}

// Initialize the audio visualizer and processing setup
const initializeVisualizer = async () => {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    gainNode = audioContext.createGain();
    pitchShifter = new Jungle(audioContext);

    echoGainNode = audioContext.createGain();
    echoDelayNode = audioContext.createDelay();
    echoDelayNode.delayTime.value = 0.2;

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
            enableEcho();
        }

        const audioElement = new Audio();
        audioElement.srcObject = audioOutput.stream;
        audioElement.play();

        await setAudioOutputToBluetooth(audioElement);

        visualize();
    } catch (error) {
        console.error('Error accessing microphone:', error);
        status.innerText = `Error accessing microphone: ${error.message}`;
    }
};

// Function to set audio output to Bluetooth
const setAudioOutputToBluetooth = async (audioElement) => {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const bluetoothDevice = devices.find(device => device.kind === 'audiooutput' && device.label.includes('Bluetooth'));

        if (bluetoothDevice) {
            await audioElement.setSinkId(bluetoothDevice.deviceId);
            console.log('Audio output set to Bluetooth:', bluetoothDevice);
        } else {
            console.log('No Bluetooth audio output found.');
        }
    } catch (error) {
        console.error('Error setting audio output to Bluetooth:', error);
    }
};

// Visualize audio waveform
const visualize = () => {
    requestAnimationFrame(visualize);
    analyser.getByteTimeDomainData(dataArray);

    canvasContext.fillStyle = 'black';
    canvasContext.fillRect(0, 0, visualizer.width, visualizer.height);

    const gradient = canvasContext.createLinearGradient(0, 0, visualizer.width, 0);
    gradient.addColorStop(0, 'rgb(255, 0, 255)');
    gradient.addColorStop(0.5, 'rgb(0, 255, 255)');
    gradient.addColorStop(1, 'rgb(255, 0, 255)');

    canvasContext.lineWidth = 3;
    canvasContext.strokeStyle = gradient;
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

    canvasContext.lineWidth = 6;
    canvasContext.strokeStyle = 'rgba(255, 0, 255, 0.3)';
    canvasContext.shadowColor = 'rgba(255, 0, 255, 0.7)';
    canvasContext.shadowBlur = 10;
    canvasContext.stroke();

    canvasContext.lineWidth = 2;
    canvasContext.strokeStyle = gradient;
    canvasContext.stroke();
};

// Start and stop button functionality
startButton.addEventListener('click', async () => {
    await initializeVisualizer();
    status.innerText = 'Microphone is live...';
    startButton.disabled = true;
    stopButton.disabled = false;
    muteButton.disabled = false;
    echoButton.disabled = false;
});

stopButton.addEventListener('click', () => {
    audioContext.close();
    status.innerText = 'Microphone stopped.';
    startButton.disabled = false;
    stopButton.disabled = true;
    muteButton.disabled = true;
    echoButton.disabled = true;
});

// Mute/Unmute functionality
muteButton.addEventListener('click', () => {
    isMuted = !isMuted;

    if (isMuted) {
        gainNode.gain.value = 0;
        muteButton.style.backgroundColor = '#888';
    } else {
        gainNode.gain.value = 1;
        muteButton.style.backgroundColor = '#FF6347';
    }
});

// Echo functionality
echoButton.addEventListener('click', () => {
    echoEnabled = !echoEnabled;

    if (echoEnabled) {
        enableEcho();
        echoButton.style.backgroundColor = '#32CD32';
    } else {
        disableEcho();
        echoButton.style.backgroundColor = '#FF6347';
    }
});

// Enable echo effect
const enableEcho = () => {
    echoGainNode.gain.value = 0.5;
    gainNode.connect(echoDelayNode);
    echoDelayNode.connect(echoGainNode);
    echoGainNode.connect(audioContext.destination);
    status.innerText = 'ECHO';
};

// Disable echo effect
const disableEcho = () => {
    gainNode.disconnect(echoDelayNode);
    echoGainNode.disconnect(audioContext.destination);
    status.innerText = 'ECHO STOPPED';
};

// Volume control
volumeControl.addEventListener('input', () => {
    const volume = 1 - volumeControl.value / volumeControl.max;
    gainNode.gain.value = volume;
    volumePercentage.innerText = Math.round(volume * 100) + '%';
});

// Pitch control
pitchControl.addEventListener('input', () => {
    const pitch = 1 - pitchControl.value / pitchControl.max;
    pitchShifter.setPitchOffset(pitch);
    pitchPercentage.innerText = Math.round(pitch * 100) + '%';
});

// Equalizer controls for bass, mid, and treble
bassControl.addEventListener('input', () => {
    const bassValue = 1 - bassControl.value / bassControl.max;
    bassFilter.gain.value = bassValue * 2;
    bassPercentage.innerText = Math.round(bassValue * 100) + '%';
});

midControl.addEventListener('input', () => {
    const midValue = 1 - midControl.value / midControl.max;
    midFilter.gain.value = midValue * 2;
    midPercentage.innerText = Math.round(midValue * 100) + '%';
});

trebleControl.addEventListener('input', () => {
    const trebleValue = 1 - trebleControl.value / trebleControl.max;
    trebleFilter.gain.value = trebleValue * 2;
    treblePercentage.innerText = Math.round(trebleValue * 100) + '%';
});
