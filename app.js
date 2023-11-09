let port;
let reader;
let inputDone;
let outputDone;
let inputStream;
let outputStream;

let connected = false;

let accelInterval, homeInterval, eligibleInterval, tackledInterval;

let start_time = Date.now()

function logMessage(message, type) {
  const log = document.getElementById('log');
  const span = document.createElement('span');
  
  // Set the color based on the type
  if (type === 'status') {
      span.style.color = '#FA7D09';
  } else if (type === 'command') {
      span.style.color = '#9DB2BF';
  } else if (type === 'response') {
      span.style.color = '#526D82';
  } else if (type === 'error') {
    span.style.color = '#FF4301';
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

    } catch (err) {
      logMessage('Error connecting: ' + err.message, 'error');
      connectButton.textContent = 'Connect';  // Revert button text if connection failed
    }
  }

  // If currently connected
  if (connected) {

        writeToDevice(`v\n`);

        // Setup Periodic Requests
        accelInterval = setInterval(() => {
          writeToDevice(`a\n`);
        }, 500);

        accelInterval = setInterval(() => {
          writeToDevice(`r\n`);
        }, 250);

        homeInterval = setInterval(() => {
          writeToDevice(`h\n`);
        }, 1000);

        eligibleInterval = setInterval(() => {
          writeToDevice(`e\n`);
        }, 1000);

        tackledInterval = setInterval(() => {
          writeToDevice(`t\n`);
        }, 1000);

  } else { // If currently disconnected
        document.getElementById('version').textContent = 'Unknown';
        document.getElementById('tackledStatus').textContent = 'Unknown';
        document.getElementById('eligibilityStatus').textContent = 'Unknown';
        document.getElementById('homeAwayStatus').textContent = 'Unknown';
        document.getElementById('accelX').textContent = 'Unknown';
        document.getElementById('accelY').textContent = 'Unknown';
        document.getElementById('accelZ').textContent = 'Unknown';

        clearInterval(accelInterval);
        clearInterval(homeInterval);
        clearInterval(eligibleInterval);
        clearInterval(tackledInterval);
  }
  // Clear the chart data on connect or disconnect
  start_time = Date.now()
  accelData.labels = [];
  accelData.datasets.forEach(dataset => dataset.data = []);
  accelChart.update();
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
  if (message.startsWith('a:')) {
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

      } catch (err) {
          logMessage('Error parsing response: ' + err.message, 'error');
      }
  }
  // Parse get accel range response
  if (message.startsWith('r:')) {
      try {
          const parts = message.split(':');
          if (parts.length < 2) {
              throw new Error('Invalid response format');
          }

          const data = parts[1].split(',');
          if (data.length < 4) {
              throw new Error('Missing acceleration data');
          }

          const xmin = parseFloat(data[0]);
          const xmax = parseFloat(data[1]);
          const ymin = parseFloat(data[2]);
          const ymax = parseFloat(data[3]);

          if (isNaN(xmin) || isNaN(xmax) || isNaN(ymin) || isNaN(ymax)) {
              throw new Error('Invalid acceleration data');
          }

          addDataToAreaChart(xmin, xmax, ymin, ymax)
      } catch (err) {
          logMessage('Error parsing response: ' + err.message, 'error');
      }
  }
  // Parse home: response
  else if (message.startsWith('h:')) {
      const status = parseInt(message.split(':')[1], 10);
      const displayStatus = (status === 1) ? 'Home' : 'Away';
      document.getElementById('homeAwayStatus').textContent = displayStatus;
  }
  // Parse eligible: response
  else if (message.startsWith('e:')) {
      const status = parseInt(message.split(':')[1], 10);
      const displayStatus = (status === 1) ? 'Eligible' : 'Ineligible';
      document.getElementById('eligibilityStatus').textContent = displayStatus;
  }
  else if (message.startsWith('t:')) {
      const status = parseInt(message.split(':')[1], 10);
      const displayStatus = (status === 1) ? 'Tackled' : 'Not Tackled';
      document.getElementById('tackledStatus').textContent = displayStatus;
  }
  // Parse version: response
  else if (message.startsWith('v:')) {
    document.getElementById('version').textContent = message.split(':')[1];
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
  await writeToDevice(`l:${rgb.r},${rgb.g},${rgb.b}\n`);
});

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  let accelAreaData = {
    labels: [],  // This will hold the timestamps or data points count
    datasets: [
        {
            label: 'X Acceleration',
            data: [],
            fill: '+1',  // Fill to next dataset
            backgroundColor: 'rgba(40, 71, 92, 0.5)',  // Semi-transparent fill
            borderColor: '#28475C',
            pointRadius: 0, // Removes the point markers
        },
        {
            label: 'X Min',
            data: [],
            fill: false,  // No fill for this dataset
            borderColor: '#28475C',
            pointRadius: 0,
        },
        {
            label: 'Y Acceleration',
            data: [],
            fill: '+1',  // Fill to next dataset
            backgroundColor: 'rgba(47, 136, 134, 0.5)',
            borderColor: '#2F8886',
            pointRadius: 0,
        },
        {
            label: 'Y Min',
            data: [],
            fill: false,
            borderColor: '#2F8886',
            pointRadius: 0,
        }
    ]
};

let areaConfig = {
    type: 'line',
    data: accelAreaData,
    options: {
        scales: {
            x: {
                type: 'linear',
                position: 'bottom',
                title: {
                    display: true,
                    text: 'milliseconds'
                }
            },
            y: {
                beginAtZero: false,
                title: {
                    display: true,
                    text: '(0.001*g)'
                },
                suggestedMin: -2000, // Suggested minimum value for the scale
                suggestedMax: 2000,  // Suggested maximum value for the scale
            }
        },
        elements: {
            line: {
                tension: 0.4 // Smoothes the line
            }
        },
        animation: {
            duration: 0 // general animation time
        },
        responsiveAnimationDuration: 0, // animation duration after a resize
        plugins: {
            filler: {
                propagate: true
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            },
            legend: {
              labels: {
                filter: function(legendItem, chartData) {
                  // Only display the legend for datasets labeled 'X Acceleration' and 'Y Acceleration'
                  return legendItem.text === 'X Acceleration' || legendItem.text === 'Y Acceleration';
                }
              }
            }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        }
    }
};

let accelAreaChart = new Chart(
    document.getElementById('accelChart'),
    areaConfig
);


document.getElementById('clearChart').addEventListener('click', () => {
    accelAreaData.labels = [];
    accelAreaData.datasets.forEach(dataset => dataset.data = []);
    accelAreaChart.update();
});

// When you receive acceleration range data, you can update the chart like this:
function addDataToAreaChart(xMin, xMax, yMin, yMax) {
  if (accelAreaData.labels.length > 100) { // Assuming 10 data points per second for 10 seconds
      accelAreaData.labels.shift();  // remove the first label
      accelAreaData.datasets.forEach(dataset => dataset.data.shift());  // remove the first data point from each dataset
  }
  const currentTime = Date.now() - start_time;

  accelAreaData.labels.push(currentTime);  // Add current time as a label
  accelAreaData.datasets[0].data.push(xMax);
  accelAreaData.datasets[1].data.push(xMin);
  accelAreaData.datasets[2].data.push(yMax);
  accelAreaData.datasets[3].data.push(yMin);
  
  accelAreaChart.update();
}
