let port;
let reader;
let inputDone;
let outputDone;
let inputStream;
let outputStream;

let connected = false;

function logMessage(message, type) {
  const log = document.getElementById('log');
  const span = document.createElement('span');
  
  // Set the color based on the type
  if (type === 'status') {
      span.style.color = 'lightgray';
  } else if (type === 'command') {
      span.style.color = 'gold';
  } else if (type === 'response') {
      span.style.color = 'green';
  } else if (type === 'error') {
    span.style.color = 'red';
}

  span.textContent = message;
  log.appendChild(span);
  log.appendChild(document.createElement('br'));  // Line break

  // Auto scroll to the bottom
  log.scrollTop = log.scrollHeight;
}

logMessage('Tackle Sensor Configurator', 'status');
logMessage('--------------------------', 'status');
logMessage('Connect a tackle sensor to your PC via a serial port.', 'status');
logMessage('Click "Connect" to begin.', 'status');
logMessage('', 'status');

const connectButton = document.getElementById('connect-button');

connectButton.addEventListener('click', async () => {
  if (connected) {
    // Disconnect from the device
    try {
      await reader.cancel();
      await inputDone.catch(() => {});
      reader = null;
      inputDone = null;

      await outputStream.getWriter().close();
      await outputDone;
      outputStream = null;

      await port.close();
      port = null;

      logMessage('Disconnected', 'status');
      connected = false;
      connectButton.textContent = 'Connect';  // Update button text
      // Disable the tabs
      document.querySelector('.tab-button.active').click();
      document.querySelectorAll('.tab-button').forEach(btn => btn.disabled = true);
    } catch (err) {
      logMessage('Error disconnecting: ' + err.message, 'error');
    }
  } else {
    // Connect to the device
    try {
      connectButton.textContent = 'Connecting...';  // Update button text
      port = await navigator.serial.requestPort();
      logMessage('Requesting port...', 'status');

      await port.open({ baudRate: 115200 });
      logMessage('Port opened', 'status');

      let decoder = new TextDecoderStream();
      inputDone = port.readable.pipeTo(decoder.writable);
      inputStream = decoder.readable;

      let encoder = new TextEncoderStream();
      outputDone = encoder.readable.pipeTo(port.writable);
      outputStream = encoder.writable;

      // Read from the input stream and display the results
      reader = inputStream.getReader();
      readLoop();
      logMessage('Reading from input stream...', 'status');

      connected = true;
      connectButton.textContent = 'Disconnect';  // Update button text
      // Enable the tabs
      document.querySelectorAll('.tab-button').forEach(btn => btn.disabled = false);
    } catch (err) {
      logMessage('Error connecting: ' + err.message, 'error');
      connectButton.textContent = 'Connect';  // Revert button text if connection failed
    }
  }

  // If currently connected
  if (connected) {
        // Remove the overlays and enable interactions
        document.querySelectorAll('.tab-overlay').forEach(overlay => overlay.style.display = 'none');
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('disabled');
            tab.style.pointerEvents = "auto"; // Enable pointer events
        });

        writeToDevice(`version\n`);

        // Setup Periodic Requests
        const accelInterval = setInterval(() => {
          writeToDevice(`accel\n`);
        }, 200);

        const homeInterval = setInterval(() => {
          writeToDevice(`home\n`);
        }, 1000);

        const eligibleInterval = setInterval(() => {
          writeToDevice(`eligible\n`);
        }, 1000);

        const tackledInterval = setInterval(() => {
          writeToDevice(`tackled\n`);
        }, 1000);



  } else { // If currently disconnected
        // Show the overlays and disable interactions
        document.querySelectorAll('.tab-overlay').forEach(overlay => overlay.style.display = 'block');
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.add('disabled');
            tab.style.pointerEvents = "none"; // Disable pointer events
        });

        clearInterval(accelInterval);
        clearInterval(homeInterval);
        clearInterval(eligibleInterval);
        clearInterval(tackledInterval);
  }
});

let dataBuffer = '';

async function readLoop() {
  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      dataBuffer += value;  // Append data to buffer

      // Check if buffer contains a newline (indicating a complete message)
      let newlineIndex = dataBuffer.indexOf('\n');
      while (newlineIndex > -1) {
        let message = dataBuffer.substring(0, newlineIndex);  // Extract the complete message
        processMessage(message.trim());  // Process the message
        dataBuffer = dataBuffer.substring(newlineIndex + 1);  // Remove the processed message from the buffer
        newlineIndex = dataBuffer.indexOf('\n');  // Check again for another complete message
      }
    }

    if (done) {
      reader.releaseLock();
      break;
    }
  }
}

function processMessage(message) {
  logMessage(message, 'response');

  // Parse GET_ACCEL response
  if (message.startsWith('accel:')) {
      try {
          const parts = message.split(':');
          if (parts.length < 2) {
              throw new Error('Invalid response format');
          }

          const data = parts[1].split(',');
          if (data.length < 3) {
              throw new Error('Missing acceleration data');
          }

          const x = parseFloat(data[0]);
          const y = parseFloat(data[1]);
          const z = parseFloat(data[2]);

          document.getElementById('accelX').textContent = x;
          document.getElementById('accelY').textContent = y;
          document.getElementById('accelZ').textContent = z;

          if (isNaN(x) || isNaN(y) || isNaN(z)) {
              throw new Error('Invalid acceleration data');
          }

          // Now x, y, and z contain the acceleration data
          // You can use these values to update your UI
          console.log(`Acceleration - X: ${x}, Y: ${y}, Z: ${z}`);
      } catch (err) {
          logMessage('Error parsing response: ' + err.message, 'error');
      }
  }
  // Parse home: response
  else if (message.startsWith('home:')) {
      const status = parseInt(message.split(':')[1], 10);
      const displayStatus = (status === 1) ? 'Home' : 'Away';
      document.getElementById('homeAwayStatus').textContent = displayStatus;
  }
  // Parse eligible: response
  else if (message.startsWith('eligible:')) {
      const status = parseInt(message.split(':')[1], 10);
      const displayStatus = (status === 1) ? 'Eligible' : 'Ineligible';
      document.getElementById('eligibilityStatus').textContent = displayStatus;
  }
  else if (message.startsWith('tackled:')) {
      const status = parseInt(message.split(':')[1], 10);
      const displayStatus = (status === 1) ? 'Tackled' : 'Not Tackled';
      document.getElementById('tackledStatus').textContent = displayStatus;
  }
}


// Function to write to the device
async function writeToDevice(cmd) {
    const writer = outputStream.getWriter();
    writer.write(cmd);
    writer.releaseLock();
    logMessage(cmd, 'command');
}

document.getElementById('setHomeColorButton').addEventListener('click', async () => {
  const color = document.getElementById('homeColorPicker').value;

  // Convert color to RGB
  let rgb = hexToRgb(color);

  // Send command to set LED color
  await writeToDevice(`rgb:${rgb.r},${rgb.g},${rgb.b}\n`);
});

// document.getElementById('homeAwayToggle').addEventListener('change', async (event) => {
//   let status = event.target.checked ? 'Home' : 'Away';
//   document.getElementById('homeAwayStatus').textContent = status;
//   // Send serial command here with the status
//   if( status == 'Home' ) {
//     await writeToDevice('home:1\n');
//   } else {  
//     await writeToDevice('home:0\n');
//   }
// });

// document.getElementById('eligibilityToggle').addEventListener('change', async (event) => {
//   let status = event.target.checked ? 'Eligible' : 'Ineligible';
//   document.getElementById('eligibilityStatus').textContent = status;
//   // Send serial command here with the status
//   if( status == 'Eligible' ) {
//     await writeToDevice('eligible:1\n');
//   } else {  
//     await writeToDevice('eligible:0\n');
//   }
// });

function showTab(tabName, event) {
  // Get all tab content elements and hide them
  let tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(tc => tc.style.display = "none");

  // Deactivate all tab buttons
  let tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(btn => btn.classList.remove('active'));

  // Show the clicked tab content and activate the button
  document.getElementById(tabName).style.display = "block";
  event.currentTarget.classList.add('active');
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
