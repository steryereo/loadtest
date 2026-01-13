# k6 Load Tester - API Endpoint Comparison

A load testing script using k6 to compare the performance of two API endpoints with HTTP basic authentication. Each endpoint is tested in an isolated scenario for accurate comparison.

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

Edit the `loadStages` array in `loadtest.js` to customize:

- Number of virtual users
- Test duration
- Ramp-up/ramp-down patterns

Example for a quick test:

```javascript
const loadStages = [
  { duration: "10s", target: 5 },
  { duration: "20s", target: 5 },
  { duration: "10s", target: 0 },
];
```

## Test Configuration

The default test runs for **3 minutes**:

- **30s**: Ramp up to 10 users
- **2m**: Steady state at 10 users
- **30s**: Ramp down to 0 users

Each endpoint is tested in a separate isolated scenario running in parallel, ensuring accurate comparison without interference.

## Output

The script generates:

1. **Console output**: Real-time metrics and a comparison summary
2. **summary.json**: JSON file with performance comparison data

## Metrics Tracked

- **Requests**: Total number of requests made
- **Avg Response Time**: Average response time
- **Median**: Median response time
- **Min**: Minimum response time
- **Max**: Maximum response time
- **Comparison**: Automatically identifies the faster endpoint with statistical significance

## Thresholds

The script includes performance thresholds:

- P95 response time < 1500ms
- Error rate < 10%

Threshold violations are reported but don't stop the test.

## Customization

### Change Endpoint Names

Edit the `name` field in `ENDPOINT1` and `ENDPOINT2` objects:

```javascript
const ENDPOINT1 = {
  id: "endpoint1",
  name: "Your Custom Name",
  url: __ENV.ENDPOINT1_URL || "URL_HERE",
};
```

### Change HTTP Method

To test POST endpoints, modify the `testEndpoint` function:

```javascript
const response = http.post(
  endpoint.url,
  JSON.stringify({ key: "value" }),
  params
);
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
══════════════════════════════════════════════════════════════
PERFORMANCE COMPARISON
══════════════════════════════════════════════════════════════
 Test: https://api1.example.com/endpoint
   Requests:        146
   Avg Response Time:     717.58ms
   Median:     700.65ms
   Min:     623.73ms
   Max:    1064.61ms
══════════════════════════════════════════════════════════════
 Baseline: https://api2.example.com/endpoint
   Requests:        146
   Avg Response Time:     715.42ms
   Median:     693.35ms
   Min:     599.53ms
   Max:    1043.17ms
══════════════════════════════════════════════════════════════
 Comparison:
   Avg Difference:          2.16ms (0.3%)
══════════════════════════════════════════════════════════════
 Winner: Baseline (marginally faster, within variance)
 Reason: Only 0.3% difference - results may vary between runs
══════════════════════════════════════════════════════════════
```
