// Load environment variables from .env file
require('dotenv').config();

let fs = require('fs');
const https = require('https');

// Access the OpenTopography API key from environment variables
const OPENTOPOGRAPHY_API_KEY = process.env.OPENTOPOGRAPHY_API_KEY;

// Log the API key (remove this in production)
console.log('OpenTopography API Key loaded:', OPENTOPOGRAPHY_API_KEY ? 'Yes' : 'No');

let walkFile = fs.readFileSync('example.json', 'utf8');

let walkData = JSON.parse(walkFile);
let itinerary = walkData.itinerary;

console.log("Itinerary length: ", itinerary.length);

// Function to make HTTP request to OpenTopography API
function makeOpenTopographyRequest(lat, lon) {
    return new Promise((resolve, reject) => {
        const url = `https://portal.opentopography.org/API/asterGDEM?lat=${lat}&lon=${lon}&outputFormat=GTiff&API_Key=${OPENTOPOGRAPHY_API_KEY}`;
        
        https.get(url, (res) => {
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
                        reject(new Error(`Failed to parse response: ${error.message}`));
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        }).on('error', (error) => {
            reject(new Error(`Request failed: ${error.message}`));
        });
    });
}

// Function to get elevation for a single point
async function getElevationForPoint(point) {
    try {
        const response = await makeOpenTopographyRequest(point.latitude, point.longitude);
        
        // Extract elevation from response
        // The exact field depends on the API response format
        // You may need to adjust this based on the actual response structure
        const elevation = response.elevation || response.data?.elevation || response.value;
        
        return {
            latitude: point.latitude,
            longitude: point.longitude,
            elevation: elevation,
            success: true
        };
    } catch (error) {
        console.error(`Error getting elevation for point (${point.latitude}, ${point.longitude}):`, error.message);
        return {
            latitude: point.latitude,
            longitude: point.longitude,
            elevation: null,
            success: false,
            error: error.message
        };
    }
}

// Function to get elevations for all points with rate limiting
async function getElevationsForItinerary(itinerary, delayMs = 100) {
    const results = [];
    
    console.log(`Starting elevation requests for ${itinerary.length} points...`);
    
    for (let i = 0; i < itinerary.length; i++) {
        const point = itinerary[i];
        console.log(`Processing point ${i + 1}/${itinerary.length}: (${point.latitude}, ${point.longitude})`);
        
        const result = await getElevationForPoint(point);
        results.push(result);
        
        // Add delay between requests to avoid rate limiting
        if (i < itinerary.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    
    return results;
}

// NEW: Function to get elevations using USGS Elevation Point Query Service (supports batch)
async function getElevationsUSGSBatch(itinerary) {
    try {
        // USGS Elevation Point Query Service supports batch requests
        const coordinates = itinerary.map(point => `${point.longitude},${point.latitude}`).join(',');
        const url = `https://nationalmap.gov/epqs/pqs.php?x=${coordinates}&units=Meters&output=json`;
        
        console.log(`Making batch request to USGS for ${itinerary.length} points...`);
        
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
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
                            reject(new Error(`Failed to parse USGS response: ${error.message}`));
                        }
                    } else {
                        reject(new Error(`USGS HTTP ${res.statusCode}: ${data}`));
                    }
                });
            }).on('error', (error) => {
                reject(new Error(`USGS request failed: ${error.message}`));
            });
        });
    } catch (error) {
        console.error('USGS batch elevation request failed:', error.message);
        throw error;
    }
}

// NEW: Function to get elevations using Open-Elevation API (supports batch)
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

// NEW: Function to process batch results and format them consistently
function processBatchResults(batchResponse, itinerary, source) {
    const results = [];
    
    try {
        if (source === 'usgs') {
            // USGS response format
            const elevations = batchResponse.Elevation_Query_Results?.Elevation || [];
            itinerary.forEach((point, index) => {
                const elevation = elevations[index];
                results.push({
                    latitude: point.latitude,
                    longitude: point.longitude,
                    elevation: elevation?.Elevation || null,
                    success: elevation?.Elevation != null,
                    error: elevation?.Elevation == null ? 'No elevation data' : null
                });
            });
        } else if (source === 'open-elevation') {
            // Open-Elevation response format
            const elevations = batchResponse.results || [];
            itinerary.forEach((point, index) => {
                const elevation = elevations[index];
                results.push({
                    latitude: point.latitude,
                    longitude: point.longitude,
                    elevation: elevation?.elevation || null,
                    success: elevation?.elevation != null,
                    error: elevation?.elevation == null ? 'No elevation data' : null
                });
            });
        }
    } catch (error) {
        console.error(`Error processing ${source} batch results:`, error.message);
        // Fallback to individual requests if batch processing fails
        return null;
    }
    
    return results;
}

// NEW: Main function that tries batch processing first, then falls back to individual requests
async function getElevationsEfficient(itinerary) {
    console.log(`Attempting efficient batch processing for ${itinerary.length} points...`);
    
    // Try USGS batch first (free, no API key required)
    try {
        console.log('Trying USGS batch API...');
        const usgsResponse = await getElevationsUSGSBatch(itinerary);
        const usgsResults = processBatchResults(usgsResponse, itinerary, 'usgs');
        
        if (usgsResults && usgsResults.some(r => r.success)) {
            console.log('USGS batch processing successful!');
            return usgsResults;
        }
    } catch (error) {
        console.log('USGS batch failed, trying Open-Elevation...');
    }
    
    // Try Open-Elevation batch
    try {
        console.log('Trying Open-Elevation batch API...');
        const openElevationResponse = await getElevationsOpenElevationBatch(itinerary);
        const openElevationResults = processBatchResults(openElevationResponse, itinerary, 'open-elevation');
        
        if (openElevationResults && openElevationResults.some(r => r.success)) {
            console.log('Open-Elevation batch processing successful!');
            return openElevationResults;
        }
    } catch (error) {
        console.log('Open-Elevation batch failed, falling back to individual requests...');
    }
    
    // Fallback to individual requests with OpenTopography
    console.log('Falling back to individual OpenTopography requests...');
    return await getElevationsForItinerary(itinerary);
}

// Alternative function using batch processing (if the API supports it)
async function getElevationsBatch(itinerary) {
    try {
        // Create a batch request URL with all coordinates
        const coordinates = itinerary.map(point => `${point.latitude},${point.longitude}`).join('|');
        const url = `https://portal.opentopography.org/API/asterGDEM?lat=${coordinates}&outputFormat=GTiff&API_Key=${OPENTOPOGRAPHY_API_KEY}`;
        
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
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
                            reject(new Error(`Failed to parse batch response: ${error.message}`));
                        }
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            }).on('error', (error) => {
                reject(new Error(`Batch request failed: ${error.message}`));
            });
        });
    } catch (error) {
        console.error('Batch elevation request failed:', error.message);
        throw error;
    }
}

// Main execution function
async function main() {
    if (!OPENTOPOGRAPHY_API_KEY) {
        console.error('Error: OPENTOPOGRAPHY_API_KEY not found in environment variables');
        console.log('Please add your OpenTopography API key to the .env file');
        return;
    }
    
    try {
        // Get elevations for all points using efficient batch processing
        const elevationResults = await getElevationsEfficient(itinerary);
        
        // Filter successful results
        const successfulResults = elevationResults.filter(result => result.success);
        const failedResults = elevationResults.filter(result => !result.success);
        
        console.log(`\nElevation data retrieval completed:`);
        console.log(`- Successful: ${successfulResults.length}`);
        console.log(`- Failed: ${failedResults.length}`);
        
        // Save results to file
        const outputData = {
            timestamp: new Date().toISOString(),
            totalPoints: itinerary.length,
            successfulRequests: successfulResults.length,
            failedRequests: failedResults.length,
            elevationData: elevationResults
        };
        
        fs.writeFileSync('elevation_results.json', JSON.stringify(outputData, null, 2));
        console.log('\nResults saved to elevation_results.json');
        
        // Display some sample results
        if (successfulResults.length > 0) {
            console.log('\nSample elevation data:');
            successfulResults.slice(0, 5).forEach((result, index) => {
                console.log(`${index + 1}. (${result.latitude}, ${result.longitude}): ${result.elevation}m`);
            });
        }
        
        if (failedResults.length > 0) {
            console.log('\nFailed requests:');
            failedResults.slice(0, 5).forEach((result, index) => {
                console.log(`${index + 1}. (${result.latitude}, ${result.longitude}): ${result.error}`);
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
    getElevationForPoint,
    getElevationsForItinerary,
    getElevationsBatch,
    getElevationsUSGSBatch,
    getElevationsOpenElevationBatch,
    getElevationsEfficient
};

