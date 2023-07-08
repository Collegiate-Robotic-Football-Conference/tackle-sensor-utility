let port;
let reader;
let inputDone;
let outputDone;
let inputStream;
let outputStream;

function logMessage(message, type) {
  const log = document.getElementById('log');
  const span = document.createElement('span');
  
  // Set the color based on the type
  if (type === 'status') {
      span.style.color = 'gray';
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


// Button event to connect to the device
document.getElementById('connect-button').addEventListener('click', async () => {
  try {
    port = await navigator.serial.requestPort();
    logMessage('Requesting port ' + port + '...', 'status');

    await port.open({ baudRate: 9600 });
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
  } catch (err) {
    logMessage('Error: ' + err.message, 'error');
  }
});


// Function to handle incoming data
async function readLoop() {
  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      logMessage('Received: ' + value, 'response');

      // Parse GET_ACCEL response
      if (value.startsWith('OK:GET_ACCEL')) {
        try {
          const parts = value.split(':');
          if (parts.length < 3) {
            throw new Error('Invalid response format');
          }

          const data = parts[2].split(',');
          if (data.length < 3) {
            throw new Error('Missing acceleration data');
          }

          const x = parseFloat(data[0].split('=')[1]);
          const y = parseFloat(data[1].split('=')[1]);
          const z = parseFloat(data[2].split('=')[1]);

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
    }
    if (done) {
      reader.releaseLock();
      break;
    }
  }
}


// Function to write to the device
async function writeToDevice(cmd) {
    const writer = outputStream.getWriter();
    writer.write(cmd);
    writer.releaseLock();
    logMessage(cmd, 'command');
}

document.getElementById('setColorButton').addEventListener('click', async () => {
    let color = document.getElementById('colorPicker').value;
    
    // Convert color to RGB
    let rgb = hexToRgb(color);
    
    // Send command to set LED color
    await writeToDevice(`SET_LED:${rgb.r},${rgb.g},${rgb.b}\n`);
});

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
