# Elevation Data Retrieval

This script retrieves elevation data for each point in your itinerary using the OpenTopography API.

## Setup

1. **Get an OpenTopography API Key:**
   - Visit https://portal.opentopography.org/
   - Sign up for a free account
   - Generate an API key

2. **Create a .env file:**
   ```bash
   # Create .env file in the project root
   echo "OPENTOPOGRAPHY_API_KEY=your_api_key_here" > .env
   ```

## Usage

Run the script to get elevation data for all points in your itinerary:

```bash
node open_itinerary.js
```

## Features

- **Rate Limiting:** Includes delays between requests to avoid API rate limits
- **Error Handling:** Gracefully handles failed requests and continues processing
- **Progress Tracking:** Shows progress as it processes each point
- **Results Export:** Saves all results to `elevation_results.json`
- **Batch Processing:** Includes an alternative batch processing function (if API supports it)

## Output

The script will:
1. Process each point in your itinerary
2. Display progress and any errors
3. Save results to `elevation_results.json`
4. Show a summary of successful and failed requests

## API Endpoint

The script uses the OpenTopography ASTER GDEM API:
- Endpoint: `https://portal.opentopography.org/API/asterGDEM`
- Parameters: `lat`, `lon`, `outputFormat`, `API_Key`

## Rate Limits

- Default delay between requests: 100ms
- You can adjust this by modifying the `delayMs` parameter in `getElevationsForItinerary()`

## Troubleshooting

- **API Key Error:** Make sure your `.env` file contains the correct API key
- **Rate Limiting:** If you get rate limit errors, increase the delay between requests
- **Network Issues:** Check your internet connection and try again

## Example Output

```
OpenTopography API Key loaded: Yes
Itinerary length: 500
Starting elevation requests for 500 points...
Processing point 1/500: (48.736092, 7.258085)
Processing point 2/500: (48.736153, 7.258303)
...

Elevation data retrieval completed:
- Successful: 495
- Failed: 5

Results saved to elevation_results.json

Sample elevation data:
1. (48.736092, 7.258085): 245.2m
2. (48.736153, 7.258303): 246.1m
...
``` 