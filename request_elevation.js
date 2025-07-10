// Load environment variables from .env file
require('dotenv').config();

let fs = require('fs');
const https = require('https');

let walkFile = fs.readFileSync('example2.json', 'utf8');

let walkData = JSON.parse(walkFile);
let itinerary = walkData.itinerary;

console.log("Itinerary length: ", itinerary.length);

// Function to get elevations using Open-Elevation API (supports batch)
async function getElevationsOpenElevationBatch(itinerary) {
    try {
        // Open-Elevation API supports batch requests
        const locations = itinerary.map(point => ({
            latitude: point.latitude,
            longitude: point.longitude
        }));
        
        const postData = JSON.stringify({ locations });
        
        console.log(`Making batch request to Open-Elevation for ${itinerary.length} points...`);
        
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.open-elevation.com',
                port: 443,
                path: '/api/v1/lookup',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };
            
            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const response = JSON.parse(data);
                            resolve(response);
                        } catch (error) {
                            reject(new Error(`Failed to parse Open-Elevation response: ${error.message}`));
                        }
                    } else {
                        reject(new Error(`Open-Elevation HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(new Error(`Open-Elevation request failed: ${error.message}`));
            });
            
            req.write(postData);
            req.end();
        });
    } catch (error) {
        console.error('Open-Elevation batch request failed:', error.message);
        throw error;
    }
}

// Function to process batch results and format them consistently
function processBatchResults(batchResponse, itinerary) {
    const results = [];
    
    try {
        // Open-Elevation response format
        const elevations = batchResponse.results || [];
        itinerary.forEach((point, index) => {
            const elevation = elevations[index];
            if (elevation?.elevation != null) {
                results.push({
                    latitude: point.latitude,
                    longitude: point.longitude,
                    elevation: elevation.elevation
                });
            }
        });
    } catch (error) {
        console.error('Error processing Open-Elevation batch results:', error.message);
        return [];
    }
    
    return results;
}

// Main function that uses only Open-Elevation
async function getElevationsOpenElevation(itinerary) {
    console.log(`Using Open-Elevation API for ${itinerary.length} points...`);
    
    try {
        console.log('Making request to Open-Elevation batch API...');
        const openElevationResponse = await getElevationsOpenElevationBatch(itinerary);
        const openElevationResults = processBatchResults(openElevationResponse, itinerary);
        
        if (openElevationResults.length > 0) {
            console.log('Open-Elevation batch processing successful!');
            return openElevationResults;
        } else {
            throw new Error('No successful elevation data received');
        }
    } catch (error) {
        console.error('Open-Elevation batch failed:', error.message);
        throw error;
    }
}

// Main execution function
async function main() {
    try {
        // Get elevations for all points using Open-Elevation
        const elevationResults = await getElevationsOpenElevation(itinerary);
        
        console.log(`\nElevation data retrieval completed:`);
        console.log(`- Total points: ${elevationResults.length}`);
        
        // Save results to file as simple list
        fs.writeFileSync('elevation_results.json', JSON.stringify(elevationResults, null, 2));
        console.log('\nResults saved to elevation_results.json');
        
        // Display some sample results
        if (elevationResults.length > 0) {
            console.log('\nSample elevation data:');
            elevationResults.slice(0, 5).forEach((result, index) => {
                console.log(`${index + 1}. (${result.latitude}, ${result.longitude}): ${result.elevation}m`);
            });
        }
        
    } catch (error) {
        console.error('Error in main execution:', error.message);
    }
}

// Run the main function
if (require.main === module) {
    main();
}

module.exports = {
    getElevationsOpenElevationBatch,
    getElevationsOpenElevation
};

