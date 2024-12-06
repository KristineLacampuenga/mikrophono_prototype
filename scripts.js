const scanButton = document.getElementById('scan');
const statusText = document.getElementById('status');
const deviceList = document.getElementById('device-list');

scanButton.addEventListener('click', () => {
    scanForBluetoothDevices();
});

async function scanForBluetoothDevices() {
    try {
        // Request Bluetooth device with no filters to scan all available devices
        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true, // This allows scanning for all available Bluetooth devices
            optionalServices: ['battery_service'] // You can specify other services to look for
        });

        // Display the selected device name
        statusText.textContent = `Status: Connected to ${device.name}`;
        const listItem = document.createElement('li');
        listItem.textContent = `Device: ${device.name}`;
        deviceList.appendChild(listItem);

        // Connect to the GATT server for further interactions
        const server = await device.gatt.connect();
        
        // Example: Read battery level if available
        const service = await server.getPrimaryService('battery_service');
        const characteristic = await service.getCharacteristic('battery_level');
        const batteryLevel = await characteristic.readValue();
        console.log('Battery Level: ', batteryLevel.getUint8(0));

    } catch (error) {
        console.error('Error:', error);
        statusText.textContent = 'Status: Error while scanning or connecting';
    }
}
