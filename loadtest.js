import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import encoding from 'k6/encoding';

// Custom metrics for each endpoint
const endpoint1ResponseTime = new Trend('endpoint1_response_time');
const endpoint2ResponseTime = new Trend('endpoint2_response_time');
const endpoint1ErrorRate = new Rate('endpoint1_errors');
const endpoint2ErrorRate = new Rate('endpoint2_errors');

// Configuration - can be overridden via environment variables or k6 options
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m', target: 20 },   // Stay at 20 users
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.1'],    // Error rate should be less than 10%
  },
};

// Get configuration from environment variables or use defaults
const ENDPOINT1_URL = __ENV.ENDPOINT1_URL || 'https://api1.example.com/endpoint';
const ENDPOINT2_URL = __ENV.ENDPOINT2_URL || 'https://api2.example.com/endpoint';
const HTTP_USERNAME = __ENV.HTTP_USERNAME || 'username';
const HTTP_PASSWORD = __ENV.HTTP_PASSWORD || 'password';

// Create HTTP basic auth header
const authHeader = {
  headers: {
    'Authorization': `Basic ${encoding.b64encode(`${HTTP_USERNAME}:${HTTP_PASSWORD}`)}`,
  },
};

export default function () {
  // Test Endpoint 1
  const response1 = http.get(ENDPOINT1_URL, authHeader);
  const endpoint1Success = check(response1, {
    'endpoint1 status is 200': (r) => r.status === 200,
    'endpoint1 response time < 500ms': (r) => r.timings.duration < 500,
  });

  endpoint1ResponseTime.add(response1.timings.duration);
  endpoint1ErrorRate.add(!endpoint1Success);

  // Test Endpoint 2
  const response2 = http.get(ENDPOINT2_URL, authHeader);
  const endpoint2Success = check(response2, {
    'endpoint2 status is 200': (r) => r.status === 200,
    'endpoint2 response time < 500ms': (r) => r.timings.duration < 500,
  });

  endpoint2ResponseTime.add(response2.timings.duration);
  endpoint2ErrorRate.add(!endpoint2Success);

  // Small sleep between requests to simulate real user behavior
  sleep(1);
}

// Summary function to display comparison
export function handleSummary(data) {
  const endpoint1Avg = data.metrics.endpoint1_response_time?.values?.avg || 0;
  const endpoint2Avg = data.metrics.endpoint2_response_time?.values?.avg || 0;
  const endpoint1P95 = data.metrics.endpoint1_response_time?.values?.['p(95)'] || 0;
  const endpoint2P95 = data.metrics.endpoint2_response_time?.values?.['p(95)'] || 0;
  const endpoint1Errors = data.metrics.endpoint1_errors?.values?.rate || 0;
  const endpoint2Errors = data.metrics.endpoint2_errors?.values?.rate || 0;

  const comparison = {
    endpoint1: {
      url: ENDPOINT1_URL,
      avgResponseTime: endpoint1Avg.toFixed(2) + 'ms',
      p95ResponseTime: endpoint1P95.toFixed(2) + 'ms',
      errorRate: (endpoint1Errors * 100).toFixed(2) + '%',
    },
    endpoint2: {
      url: ENDPOINT2_URL,
      avgResponseTime: endpoint2Avg.toFixed(2) + 'ms',
      p95ResponseTime: endpoint2P95.toFixed(2) + 'ms',
      errorRate: (endpoint2Errors * 100).toFixed(2) + '%',
    },
    winner: endpoint1Avg < endpoint2Avg ? 'Endpoint 1' : 'Endpoint 2',
  };

  // Generate text summary
  const summaryText = `
╔══════════════════════════════════════════════════════════════╗
║                    PERFORMANCE COMPARISON                    ║
╠══════════════════════════════════════════════════════════════╣
║ Endpoint 1: ${ENDPOINT1_URL.substring(0, 47).padEnd(47)} ║
║   Avg Response Time: ${endpoint1Avg.toFixed(2).padStart(10)}ms                          ║
║   P95 Response Time: ${endpoint1P95.toFixed(2).padStart(10)}ms                          ║
║   Error Rate:        ${(endpoint1Errors * 100).toFixed(2).padStart(10)}%                          ║
╠══════════════════════════════════════════════════════════════╣
║ Endpoint 2: ${ENDPOINT2_URL.substring(0, 47).padEnd(47)} ║
║   Avg Response Time: ${endpoint2Avg.toFixed(2).padStart(10)}ms                          ║
║   P95 Response Time: ${endpoint2P95.toFixed(2).padStart(10)}ms                          ║
║   Error Rate:        ${(endpoint2Errors * 100).toFixed(2).padStart(10)}%                          ║
╠══════════════════════════════════════════════════════════════╣
║ Winner: ${(endpoint1Avg < endpoint2Avg ? 'Endpoint 1 (faster)' : 'Endpoint 2 (faster)').padEnd(47)} ║
╚══════════════════════════════════════════════════════════════╝
`;

  console.log(summaryText);

  return {
    'summary.json': JSON.stringify(comparison, null, 2),
  };
}
