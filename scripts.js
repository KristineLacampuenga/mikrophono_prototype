// Grab the elements
const connectButton = document.getElementById('connectBtn');
const status = document.getElementById('status');

// Function to connect to Bluetooth and route audio
async function connectAndRouteAudio() {
    try {
        // Request Bluetooth device with the 'audio_sink' service (Bluetooth speaker/headphone)
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['audio_sink'] }] // Looking for audio sink devices
        });

        status.textContent = `Connecting to ${device.name}...`;

        // Connect to the device
        const server = await device.gatt.connect();
        status.textContent = `Connected to ${device.name}`;

        // Get primary service (audio_sink)
        const service = await server.getPrimaryService('audio_sink');

        // Handle audio routing (this part will depend on browser support and device capabilities)
        await setAudioOutputToBluetooth(device);

    } catch (error) {
        console.error('Error connecting to Bluetooth:', error);
        status.textContent = `Error: ${error}`;
    }
}

// Function to route audio output to Bluetooth (Web Audio API interaction)
const setAudioOutputToBluetooth = async (device) => {
    try {
        // Check if the browser supports setting audio output to Bluetooth (may depend on device and browser)
        const audioElement = new Audio();
        audioElement.srcObject = device;
        audioElement.play();

        status.textContent = `Audio routed to Bluetooth: ${device.name}`;

    } catch (error) {
        console.error('Error routing audio to Bluetooth:', error);
        status.textContent = 'Failed to route audio to Bluetooth.';
    }
};

// Event listener for the connect button
connectButton.addEventListener('click', connectAndRouteAudio);
