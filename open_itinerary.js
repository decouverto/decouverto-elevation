// Load environment variables from .env file
require('dotenv').config();

let fs = require('fs');

// Access the OpenTopography API key from environment variables
const OPENTOPOGRAPHY_API_KEY = process.env.OPENTOPOGRAPHY_API_KEY;

// Log the API key (remove this in production)
console.log('OpenTopography API Key loaded:', OPENTOPOGRAPHY_API_KEY ? 'Yes' : 'No');

let walkFile = fs.readFileSync('example.json', 'utf8');

let walkData = JSON.parse(walkFile);
let itinerary = walkData.itinerary;

console.log("Itinerary length: ", itinerary.length);

