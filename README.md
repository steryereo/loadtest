# k6 Load Tester - API Endpoint Comparison

A simple load testing script using k6 to compare the performance of two API endpoints with HTTP basic authentication.

## Prerequisites

Install k6:

- **macOS**: `brew install k6`
- **Linux**: Follow [k6 installation guide](https://grafana.com/docs/k6/latest/set-up/install-k6/)
- **Windows**: Download from [k6 releases](https://github.com/grafana/k6/releases)

## Usage

### Basic Usage

Set environment variables and run the test:

```bash
export ENDPOINT1_URL="https://api1.example.com/endpoint"
export ENDPOINT2_URL="https://api2.example.com/endpoint"
export HTTP_USERNAME="your-username"
export HTTP_PASSWORD="your-password"

k6 run loadtest.js
```

### One-liner

```bash
ENDPOINT1_URL="https://api1.example.com/endpoint" \
ENDPOINT2_URL="https://api2.example.com/endpoint" \
HTTP_USERNAME="your-username" \
HTTP_PASSWORD="your-password" \
k6 run loadtest.js
```

### Custom Load Profile

Edit the `options` object in `loadtest.js` to customize:

- Number of virtual users
- Test duration
- Ramp-up/ramp-down patterns
- Performance thresholds

Example for a quick test:

```javascript
export const options = {
  stages: [
    { duration: "10s", target: 5 },
    { duration: "20s", target: 5 },
    { duration: "10s", target: 0 },
  ],
};
```

## Output

The script generates:

1. **Console output**: Real-time metrics and a comparison summary
2. **summary.json**: JSON file with performance comparison data

## Metrics Tracked

- **Response Times**: Average and 95th percentile for each endpoint
- **Error Rates**: Percentage of failed requests
- **HTTP Status Codes**: Success/failure rates
- **Comparison**: Automatically identifies the faster endpoint

## Customization

### Change HTTP Method

To test POST endpoints, modify the `http.get()` calls:

```javascript
const response1 = http.post(
  ENDPOINT1_URL,
  JSON.stringify({ key: "value" }),
  authHeader
);
```

### Add Request Body

```javascript
const payload = JSON.stringify({ key: "value" });
const response1 = http.post(ENDPOINT1_URL, payload, {
  ...authHeader,
  headers: {
    ...authHeader.headers,
    "Content-Type": "application/json",
  },
});
```

### Adjust Authentication

For different auth methods, modify the `authHeader` object:

```javascript
// Bearer token
const authHeader = {
  headers: {
    Authorization: `Bearer ${__ENV.API_TOKEN}`,
  },
};
```

## Example Output

```
╔══════════════════════════════════════════════════════════════╗
║                    PERFORMANCE COMPARISON                    ║
╠══════════════════════════════════════════════════════════════╣
║ Endpoint 1: https://api1.example.com/endpoint               ║
║   Avg Response Time:     125.50ms                          ║
║   P95 Response Time:     250.30ms                          ║
║   Error Rate:              0.00%                          ║
╠══════════════════════════════════════════════════════════════╣
║ Endpoint 2: https://api2.example.com/endpoint               ║
║   Avg Response Time:     180.75ms                          ║
║   P95 Response Time:     320.10ms                          ║
║   Error Rate:              2.50%                          ║
╠══════════════════════════════════════════════════════════════╣
║ Winner: Endpoint 1 (faster)                                 ║
╚══════════════════════════════════════════════════════════════╝
```
