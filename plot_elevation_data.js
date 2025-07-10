// plot elevation data from elevation_results.json using Plotly

const fs = require('fs');

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

// Create the plot data
const trace = {
    x: distances,
    y: elevations,
    type: 'scatter',
    mode: 'lines+markers',
    name: 'Elevation Profile',
    line: {
        color: '#1f77b4',
        width: 2
    },
    marker: {
        size: 4,
        color: '#1f77b4'
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
    hovermode: 'closest'
};

const config = {
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d']
};

// Save the plot as HTML
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
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
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
        var data = ${JSON.stringify([trace])};
        var layout = ${JSON.stringify(layout)};
        var config = ${JSON.stringify(config)};
        Plotly.newPlot('plot', data, layout, config);
    </script>
</body>
</html>`;

fs.writeFileSync('elevation_profile.html', htmlContent);
console.log('Elevation profile saved as elevation_profile.html');
console.log(`Total distance: ${cumulativeDistance.toFixed(2)} km`);
console.log(`Elevation range: ${Math.min(...elevations)}m - ${Math.max(...elevations)}m`);
console.log(`Elevation gain: ${Math.max(...elevations) - Math.min(...elevations)}m`);

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