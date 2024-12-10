const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const echoButton = document.getElementById('echoButton');
const recordButton = document.getElementById('recordButton');
const playbackButton = document.getElementById('playbackButton');
const volumeControl = document.getElementById('volumeControl');
const pitchControl = document.getElementById('pitchControl');
const volumePercentage = document.getElementById('volumePercentage');
const pitchPercentage = document.getElementById('pitchPercentage');
const status = document.getElementById('status');
const visualizer = document.getElementById('visualizer');
const canvasContext = visualizer.getContext('2d');

let audioContext, analyser, gainNode, microphone, audioOutput, mediaRecorder, liveRecorder;
let dataArray, bufferLength, recordedChunks = [], liveAudioChunks = [];
let pitchShifter;
let echoEnabled = false;
let echoGainNode, echoDelayNode;
let recordedAudioURL = null;

// Class for pitch shifting modulation (Jungle effect)
class Jungle {
    constructor(context) {
        this.context = context;
        this.input = context.createGain();
        this.output = context.createGain();
        this.modulationNode = context.createGain();
        this.delayNode = context.createDelay();

        this.delayNode.delayTime.value = 0.005;
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
}

// Initialize the audio visualizer and processing setup
const initializeVisualizer = async () => {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    gainNode = audioContext.createGain();
    pitchShifter = new Jungle(audioContext);

    echoGainNode = audioContext.createGain();
    echoDelayNode = audioContext.createDelay();
    echoDelayNode.delayTime.value = 0.1;

    const bassFilter = audioContext.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 200;

    const midFilter = audioContext.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = 1000;
    midFilter.Q.value = 1;

    const trebleFilter = audioContext.createBiquadFilter();
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

        const livePlayback = audioContext.createMediaStreamDestination();
        const audioElement = new Audio();
        audioElement.srcObject = livePlayback.stream;
        audioElement.play();

        microphone.connect(livePlayback);

        liveRecorder = new MediaRecorder(livePlayback.stream);
        liveRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                liveAudioChunks.push(event.data);
            }
        };
        liveRecorder.start();

        mediaRecorder = new MediaRecorder(audioOutput.stream);
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            if (recordedChunks.length > 0) {
                const blob = new Blob(recordedChunks, { type: 'audio/webm' });
                recordedAudioURL = URL.createObjectURL(blob);

                // Auto-download recording
                const downloadLink = document.createElement('a');
                downloadLink.href = recordedAudioURL;
                downloadLink.setAttribute('download', 'recording.webm');
                downloadLink.click();

                playbackButton.disabled = false;
            } else {
                console.error('No audio recorded.');
                recordedAudioURL = null;
            }
        };

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

    canvasContext.clearRect(0, 0, visualizer.width, visualizer.height);

    canvasContext.lineWidth = 3;
    canvasContext.strokeStyle = 'rgba(255, 0, 255, 0.6)';
    canvasContext.beginPath();

    const sliceWidth = visualizer.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * visualizer.height) / 2;

        if (i === 0) {
            canvasContext.moveTo(x, y);
        } else {
            canvasContext.lineTo(x, y);
        }

        x += sliceWidth;
    }

    canvasContext.stroke();
};

// Start and stop functionality
startButton.addEventListener('click', async () => {
    await initializeVisualizer();
    status.innerText = 'Microphone is live...';
    startButton.disabled = true;
    stopButton.disabled = false;
    echoButton.disabled = false;
    recordButton.disabled = false;
    playbackButton.disabled = true; // Disable playback while live mic is active
});

stopButton.addEventListener('click', () => {
    audioContext.close();
    liveRecorder.stop();
    status.innerText = 'Microphone stopped.';
    startButton.disabled = false;
    stopButton.disabled = true;
    echoButton.disabled = true;
    recordButton.disabled = true;
    playbackButton.disabled = false; // Enable playback when mic is stopped
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

const enableEcho = () => {
    echoGainNode.gain.value = 0.5;
    gainNode.connect(echoDelayNode);
    echoDelayNode.connect(echoGainNode);
    echoGainNode.connect(gainNode);
    echoGainNode.connect(audioContext.destination);
    status.innerText = 'Echo Enabled...';
};

const disableEcho = () => {
    gainNode.disconnect(echoDelayNode);
    echoDelayNode.disconnect(echoGainNode);
    echoGainNode.disconnect(audioContext.destination);
    status.innerText = 'Echo Disabled...';
};

// Volume control
volumeControl.addEventListener('input', () => {
    const volume = volumeControl.value / volumeControl.max;
    gainNode.gain.value = volume;
    volumePercentage.innerText = `${Math.round(volume * 100)}%`;
});

// Pitch control
pitchControl.addEventListener('input', () => {
    const pitch = pitchControl.value / pitchControl.max;
    pitchShifter.setPitchOffset(pitch * 3);
    pitchPercentage.innerText = `${Math.round(pitch * 100)}%`;
});

// Record functionality
recordButton.addEventListener('click', () => {
    if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        recordButton.style.backgroundColor = '#FF6347';
        status.innerText = 'Recording stopped.';
    } else {
        mediaRecorder.start();
        recordButton.style.backgroundColor = '#32CD32';
        status.innerText = 'Recording...';
    }
});

// Playback functionality
playbackButton.addEventListener('click', () => {
    if (!recordedAudioURL) {
        console.error('No valid recording to play.');
        status.innerText = 'No recording available to play.';
        return;
    }

    const audio = new Audio(recordedAudioURL);
    audio.play();
});

// Initialize the application with a safety alert
window.onload = () => {
    alert("How to make best, safe use of this microphone? \n1. Set volume to 20% \n2. Connect your device audio to external speaker. \n3. Tap the mic icon. \n4. Adjust volume levels as per your need. \n5. If you want to record, click the record button for automatic download to your device.");
};
