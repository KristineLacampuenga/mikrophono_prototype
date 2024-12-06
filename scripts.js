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

let audioContext, analyser, gainNode, microphone, audioOutput, mediaRecorder;
let dataArray, bufferLength, recordedChunks = [];
let pitchShifter;
let echoEnabled = false;
let echoGainNode, echoDelayNode;

// Class for pitch shifting modulation (Jungle effect)
class Jungle {
    constructor(context) {
        this.context = context;
        this.input = context.createGain();
        this.output = context.createGain();
        this.modulationNode = context.createGain();
        this.delayNode = context.createDelay();

        this.delayNode.delayTime.value = 0.005; // Reduced delay time for a more natural effect
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
        this.modulationNode.gain.value = offset * 10; // Increased gain for higher pitch shifting
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
    echoDelayNode.delayTime.value = 0.1; // Reduced delay for more subtle echo

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

        const audioElement = new Audio();
        audioElement.srcObject = audioOutput.stream;
        audioElement.play();

        // Initialize MediaRecorder
        mediaRecorder = new MediaRecorder(audioOutput.stream);
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'audio/webm' });
            recordedChunks = [];
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.play();

            // Automatic download
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.setAttribute('download', 'recording.webm');
            downloadLink.click();
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
    echoButton.disabled = false;
    recordButton.disabled = false;
    playbackButton.disabled = true; // Initially disabled until recording is done
});

stopButton.addEventListener('click', () => {
    audioContext.close();
    status.innerText = 'Microphone stopped.';
    startButton.disabled = false;
    stopButton.disabled = true;
    echoButton.disabled = true;
    recordButton.disabled = true;
    playbackButton.disabled = true;
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
    echoGainNode.gain.value = 0.5; // Increased gain for echo effect
    gainNode.connect(echoDelayNode);
    echoDelayNode.connect(echoGainNode);
    echoGainNode.connect(gainNode); // Feedback loop to create echo
    echoGainNode.connect(audioContext.destination);
    status.innerText = 'Echo Enabled...';
};

// Disable echo effect
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
    volumePercentage.innerText = Math.round(volume * 100) + '%';
});

// Pitch control
pitchControl.addEventListener('input', () => {
    const pitch = pitchControl.value / pitchControl.max;
    pitchShifter.setPitchOffset(pitch * 3); // Increase the pitch shift range
    pitchPercentage.innerText = Math.round(pitch * 100) + '%'; // Display updated percentage
});

// Record functionality
recordButton.addEventListener('click', () => {
    if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        recordButton.style.backgroundColor = '#FF6347';
        playbackButton.disabled = false;
        status.innerText = 'Recording stopped.';
    } else {
        mediaRecorder.start();
        recordButton.style.backgroundColor = '#32CD32';
        playbackButton.disabled = true;
        status.innerText = 'Recording...';
    }
});

