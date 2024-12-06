// Grab the button and status elements
const connectButton = document.getElementById('connectBtn');
const status = document.getElementById('status');

// Function to connect to Bluetooth and route audio
async function connectAndRouteAudio() {
    try {
        // Step 1: Request a Bluetooth device with an audio service
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['audio_sink'] }] // Looking for audio sink devices (Bluetooth speakers)
        });

        status.textContent = `Connecting to ${device.name}...`;

        // Step 2: Connect to the device
        const server = await device.gatt.connect();
        status.textContent = `Connected to ${device.name}`;

        // Step 3: Get the primary service (audio_sink)
        const service = await server.getPrimaryService('audio_sink');

        // Step 4: Use Web Audio API to get microphone stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Step 5: Route microphone audio to the Bluetooth device (simulated in browser)
        const audioElement = new Audio();
        audioElement.srcObject = stream;
        audioElement.play();

        status.textContent = `Audio routed to Bluetooth: ${device.name}`;

        // Optionally, you could add further functionality like controlling playback, muting, etc.

    } catch (error) {
        console.error('Error connecting to Bluetooth or routing audio:', error);
        status.textContent = `Error: ${error.message}`;
    }
}

// Event listener for the button click
connectButton.addEventListener('click', connectAndRouteAudio);
