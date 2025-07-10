// plot elevation data from elevation_results.json using Plotly and save as PNG

const fs = require('fs');
const puppeteer = require('puppeteer');

// Read and parse the elevation data
let elevationData = JSON.parse(fs.readFileSync('elevation_results_2.json', 'utf8'));

// Function to calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
}

// Calculate cumulative distances and extract elevations
let cumulativeDistance = 0;
let distances = [0]; // Start at 0
let elevations = [elevationData.elevationData[0].elevation];

for (let i = 1; i < elevationData.elevationData.length; i++) {
    const prev = elevationData.elevationData[i-1];
    const curr = elevationData.elevationData[i];
    
    const distance = calculateDistance(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
    );
    
    cumulativeDistance += distance;
    distances.push(cumulativeDistance);
    elevations.push(curr.elevation);
}

// Moving average smoothing function
function movingAverage(arr, windowSize) {
    const result = [];
    for (let i = 0; i < arr.length; i++) {
        let start = Math.max(0, i - Math.floor(windowSize / 2));
        let end = Math.min(arr.length, i + Math.ceil(windowSize / 2));
        let window = arr.slice(start, end);
        let avg = window.reduce((sum, val) => sum + val, 0) / window.length;
        result.push(avg);
    }
    return result;
}

const windowSize = 10; // You can adjust this for more/less smoothing
const elevationsSmoothed = movingAverage(elevations, windowSize);

// Create the plot data (original and smoothed)
const trace = {
    x: distances,
    y: elevations,
    type: 'scatter',
    mode: 'lines+markers',
    name: 'Original Elevation',
    line: {
        color: '#1f77b4',
        width: 2,
        dash: 'dot'
    },
    marker: {
        size: 4,
        color: '#1f77b4'
    }
};

const traceSmoothed = {
    x: distances,
    y: elevationsSmoothed,
    type: 'scatter',
    mode: 'lines',
    name: 'Smoothed Elevation',
    line: {
        color: '#ff7f0e',
        width: 3
    }
};

const layout = {
    title: 'Elevation Profile vs Distance',
    xaxis: {
        title: 'Distance (km)',
        showgrid: true,
        gridcolor: '#f0f0f0'
    },
    yaxis: {
        title: 'Elevation (m)',
        showgrid: true,
        gridcolor: '#f0f0f0'
    },
    plot_bgcolor: 'white',
    paper_bgcolor: 'white',
    hovermode: 'closest',
    width: 1200,
    height: 600
};

const config = {
    displayModeBar: false,
    displaylogo: false
};

// Create HTML content
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Elevation Profile</title>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: white;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
        }
        .stats {
            display: flex;
            justify-content: space-around;
            margin-bottom: 20px;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 5px;
        }
        .stat-item {
            text-align: center;
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #1f77b4;
        }
        .stat-label {
            font-size: 14px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Elevation Profile</h1>
        <div class="stats">
            <div class="stat-item">
                <div class="stat-value">${cumulativeDistance.toFixed(2)}</div>
                <div class="stat-label">Total Distance (km)</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${Math.min(...elevations)}</div>
                <div class="stat-label">Min Elevation (m)</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${Math.max(...elevations)}</div>
                <div class="stat-label">Max Elevation (m)</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${(Math.max(...elevations) - Math.min(...elevations)).toFixed(0)}</div>
                <div class="stat-label">Elevation Gain (m)</div>
            </div>
        </div>
        <div id="plot"></div>
    </div>
    <script>
        var data = ${JSON.stringify([trace, traceSmoothed])};
        var layout = ${JSON.stringify(layout)};
        var config = ${JSON.stringify(config)};
        Plotly.newPlot('plot', data, layout, config);
    </script>
</body>
</html>`;

async function generatePNG() {
    try {
        // Write HTML file temporarily
        fs.writeFileSync('temp_elevation_plot.html', htmlContent);
        
        // Launch browser
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Set viewport for consistent sizing
        await page.setViewport({ width: 1280, height: 800 });
        
        // Load the HTML file
        await page.goto(`file://${process.cwd()}/temp_elevation_plot.html`);
        
        // Wait for Plotly to render by checking if the plot element exists and has content
        await page.waitForFunction(() => {
            const plotElement = document.getElementById('plot');
            return plotElement && plotElement.children.length > 0;
        }, { timeout: 10000 });
        
        // Additional wait to ensure rendering is complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Take screenshot
        await page.screenshot({
            path: 'elevation_profile.png',
            fullPage: true,
            type: 'png'
        });
        
        await browser.close();
        
        // Clean up temporary HTML file
        fs.unlinkSync('temp_elevation_plot.html');
        
        console.log('Elevation profile saved as elevation_profile.png');
        console.log(`Total distance: ${cumulativeDistance.toFixed(2)} km`);
        console.log(`Elevation range: ${Math.min(...elevations)}m - ${Math.max(...elevations)}m`);
        console.log(`Elevation gain: ${Math.max(...elevations) - Math.min(...elevations)}m`);
        
    } catch (error) {
        console.error('Error generating PNG:', error);
    }
}

// Create a simple console output for quick visualization
console.log('\nElevation Profile Summary:');
console.log('Distance (km) | Elevation (m)');
console.log('-------------|-------------');
for (let i = 0; i < Math.min(distances.length, 10); i++) {
    console.log(`${distances[i].toFixed(2).padStart(12)} | ${elevations[i].toString().padStart(12)}`);
}
if (distances.length > 10) {
    console.log('...');
    console.log(`${distances[distances.length-1].toFixed(2).padStart(12)} | ${elevations[elevations.length-1].toString().padStart(12)}`);
}

// Generate the PNG
generatePNG();