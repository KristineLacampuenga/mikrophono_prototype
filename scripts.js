const connectButton = document.getElementById('connect');
const statusText = document.getElementById('status');

connectButton.addEventListener('click', () => {
    connectToBluetoothDevice();
});

async function connectToBluetoothDevice() {
    try {
        // Request Bluetooth device
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['battery_service'] }] // You can customize this filter for your specific device
        });

        // Display device name
        console.log('Device Name:', device.name);

        // Connect to the GATT server
        const server = await device.gatt.connect();
        statusText.textContent = `Status: Connected to ${device.name}`;

        // Now you can interact with the Bluetooth device.
        // For example, read a battery level:
        const service = await server.getPrimaryService('battery_service');
        const characteristic = await service.getCharacteristic('battery_level');
        const batteryLevel = await characteristic.readValue();
        console.log('Battery Level: ', batteryLevel.getUint8(0));

    } catch (error) {
        console.error('Error:', error);
        statusText.textContent = 'Status: Error while connecting';
    }
}
