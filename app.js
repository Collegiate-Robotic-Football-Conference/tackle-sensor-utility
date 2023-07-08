let port;
let reader;
let inputDone;
let outputDone;
let inputStream;
let outputStream;

// Button event to connect to the device
document.getElementById('connect-button').addEventListener('click', async () => {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
  
    let decoder = new TextDecoderStream();
    inputDone = port.readable.pipeTo(decoder.writable);
    inputStream = decoder.readable;
  
    let encoder = new TextEncoderStream();
    outputDone = encoder.readable.pipeTo(port.writable);
    outputStream = encoder.writable;
  
    // Read from the input stream and display the results
    reader = inputStream.getReader();
    readLoop();
  });

// Function to handle incoming data
async function readLoop() {
    while (true) {
      const { value, done } = await reader.read();
      if (value) {
        // log incoming data
        console.log(value);
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
