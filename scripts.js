document.addEventListener('DOMContentLoaded', () => {
    // Check if MediainJSBridge is available
    if (window.MediainJSBridge) {
        alert('MediainJSBridge is available.');

        // Function to connect to Bluetooth and route audio
        function connectAndRouteAudio() {
            try {
                // Step 1: Connect to Bluetooth
                window.MediainJSBridge.call(
                    'openBluetooth', // Native method for enabling Bluetooth
                    {}, // Optional parameters
                    function (bluetoothResponse) {
                        if (bluetoothResponse && bluetoothResponse.success) {
                            alert(`Bluetooth connected to: ${bluetoothResponse.deviceName}`);

                            // Step 2: Route audio to Bluetooth after successful connection
                            routeAudioToBluetooth();
                        } else {
                            alert(`Bluetooth Error: ${bluetoothResponse.error || 'Unable to connect to Bluetooth.'}`);
                        }
                    }
                );
            } catch (error) {
                console.error('Error connecting to Bluetooth:', error);
                alert('An error occurred while connecting to Bluetooth.');
            }
        }

        // Function to route audio output to the connected Bluetooth speaker
        function routeAudioToBluetooth() {
            try {
                window.MediainJSBridge.call(
                    'routeAudioToBluetooth', // Native method for routing audio
                    {}, // Optional parameters
                    function (audioResponse) {
                        if (audioResponse && audioResponse.success) {
                            alert('Audio successfully routed to the Bluetooth speaker.');
                        } else {
                            alert(`Audio Routing Error: ${audioResponse.error || 'Unable to route audio.'}`);
                        }
                    }
                );
            } catch (error) {
                console.error('Error routing audio to Bluetooth:', error);
                alert('An error occurred while routing audio to the Bluetooth speaker.');
            }
        }

        // Add a single button for both operations
        const actionButton = document.createElement('button');
        actionButton.textContent = 'Connect & Route Audio';
        actionButton.style = 'padding: 10px 20px; font-size: 16px; margin: 20px;';
        actionButton.onclick = connectAndRouteAudio;

        // Add the button to the body
        document.body.appendChild(actionButton);

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
                // Use MediainJSBridge to set audio output to Bluetooth
                window.MediainJSBridge.call(
                    'setAudioOutputToBluetooth',
                    {},
                    function (response) {
                        if (response && response.success) {
                            console.log('Audio output set to Bluetooth:', response.deviceName);
                        } else {
                            console.log('No Bluetooth audio output found.');
                        }
                    }
                );
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
            bassFilter.gain.value = bassValue * 15;
            bassPercentage.innerText = Math.round(bassValue * 100) + '%';
        });

        midControl.addEventListener('input', () => {
            const midValue = 1 - midControl.value / midControl.max;
            midFilter.gain.value = midValue * 15;
            midPercentage.innerText = Math.round(midValue * 100) + '%';
        });

        trebleControl.addEventListener('input', () => {
            const trebleValue = 1 - trebleControl.value / trebleControl.max;
            trebleFilter.gain.value = trebleValue * 15;
            treblePercentage.innerText = Math.round(trebleValue * 100) + '%';
        });
    } else {
        alert('MediainJSBridge is not available on this device.');
    }
});
