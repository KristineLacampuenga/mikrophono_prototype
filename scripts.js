const toggleButton = document.getElementById('toggleButton');
const recordButton = document.getElementById('recordButton');
const playbackButton = document.getElementById('playbackButton');
const volumeControl = document.getElementById('volumeControl');
const volumePercentage = document.getElementById('volumePercentage');
const echoControl = document.getElementById('echoControl');
const echoPercentage = document.getElementById('echoPercentage');
const status = document.getElementById('status');

let audioContext, gainNode, microphone, delayNode, mediaRecorder, recordedChunks;
let isRecording = false;
let audioUrl, audio;

// Initialize microphone and nodes
const initializeMicrophone = async () => {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = audioContext.createGain();
    delayNode = audioContext.createDelay(5.0); // Delay with maximum of 5 seconds
    delayNode.delayTime.value = 0;  // Start with no echo
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphone = audioContext.createMediaStreamSource(stream);
        
        // Initial audio routing without delay for direct output
        microphone.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Initialize MediaRecorder
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = event => {
            recordedChunks.push(event.data);
        };
        
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(recordedChunks, { type: 'audio/wav' });
            audioUrl = URL.createObjectURL(audioBlob);
            audio = new Audio(audioUrl);
            playbackButton.disabled = false;
            status.innerText = 'Recording stopped. Playback is available.';
            
            // Create a download link
            const downloadLink = document.createElement('a');
            downloadLink.href = audioUrl;
            downloadLink.download = 'recording.wav';  // Set the filename
            downloadLink.click();  // Automatically trigger the download
        };
        
        status.innerText = 'Microphone initialized!';
    } catch (error) {
        console.error('Error accessing microphone:', error);
        status.innerText = `Error accessing microphone: ${error.message}`;
    }
};

// Toggle Microphone functionality
toggleButton.addEventListener('click', async () => {
    if (!audioContext) {
        await initializeMicrophone();
        status.innerText = 'Microphone is live...';
        
        // Change to active mic image
        toggleButton.innerHTML = '<img src="realmic3.png" alt="Microphone" class="microphone-btn">';
    } else {
        audioContext.close();
        audioContext = null;
        mediaRecorder = null;
        recordedChunks = [];
        status.innerText = 'Microphone stopped.';
        
        // Change to muted mic image
        toggleButton.innerHTML = '<img src="realmic4.png" alt="Muted Microphone" class="microphone-btn">';
    }
    recordButton.disabled = !audioContext; // Enable/Disable record button based on microphone status
});

// Volume control functionality
volumeControl.addEventListener('input', () => {
    const volume = volumeControl.value / 100;
    gainNode.gain.value = volume;
    volumePercentage.innerText = `${volumeControl.value}%`;
});

// Echo control functionality
echoControl.addEventListener('input', () => {
    const echo = echoControl.value / 100;
    delayNode.delayTime.value = echo;  // Echo control (scaled between 0 and 1 second)
    
    // Adjust routing based on echo value
    if (echo > 0) {
        gainNode.disconnect(audioContext.destination);
        gainNode.connect(delayNode);
        delayNode.connect(audioContext.destination);
    } else {
        gainNode.disconnect(delayNode);
        gainNode.connect(audioContext.destination);
    }

    echoPercentage.innerText = `${echoControl.value}%`;
});

// Record functionality
recordButton.addEventListener('click', () => {
    if (isRecording) {
        mediaRecorder.stop();
        status.innerText = 'Recording stopped.';
        recordButton.innerText = 'Start Recording';
        recordButton.style.backgroundColor = '';  // Reset background color
    } else {
        recordedChunks = [];
        mediaRecorder.start();
        status.innerText = 'Recording started...';
        recordButton.innerText = 'Stop Recording';
        recordButton.style.backgroundColor = 'red';  // Turn the button red when recording
    }
    isRecording = !isRecording;
});

// Playback functionality
playbackButton.addEventListener('click', () => {
    if (audio) {
        audio.play();
        status.innerText = 'Playing back the recording...';
        playbackButton.style.backgroundColor = 'red';  // Turn the button red during playback
    } else {
        status.innerText = 'No recording available.';
    }
});

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
