import http from "k6/http";
import { sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import encoding from "k6/encoding";

const ENDPOINT1 = {
  id: "endpoint1",
  name: "Test",
  url: __ENV.ENDPOINT1_URL || "URL_HERE",
};

const ENDPOINT2 = {
  id: "endpoint2",
  name: "Baseline",
  url: __ENV.ENDPOINT2_URL || "URL_HERE",
};

const HTTP_USERNAME = __ENV.HTTP_USERNAME || "USERNAME_HERE";
const HTTP_PASSWORD = __ENV.HTTP_PASSWORD || "PASSWORD_HERE";

const authHeader = {
  headers: {
    Authorization: `Basic ${encoding.b64encode(
      `${HTTP_USERNAME}:${HTTP_PASSWORD}`
    )}`,
  },
};

const endpoint1ResponseTime = new Trend("endpoint1_response_time");
const endpoint1ErrorRate = new Rate("endpoint1_errors");
const endpoint2ResponseTime = new Trend("endpoint2_response_time");
const endpoint2ErrorRate = new Rate("endpoint2_errors");

const loadStages = [
  { duration: "30s", target: 10 },
  { duration: "2m", target: 10 },
  { duration: "30s", target: 0 },
];

const thresholds = {
  http_req_duration: ["p(95)<1500"],
  http_req_failed: ["rate<0.1"],
  "http_req_duration{endpoint:endpoint1}": ["p(95)<1500"],
  "http_req_failed{endpoint:endpoint1}": ["rate<0.1"],
  "http_req_duration{endpoint:endpoint2}": ["p(95)<1500"],
  "http_req_failed{endpoint:endpoint2}": ["rate<0.1"],
};

export const options = {
  scenarios: {
    endpoint1_test: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: loadStages,
      exec: "testEndpoint1",
      tags: { scenario: "endpoint1" },
    },
    endpoint2_test: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: loadStages,
      exec: "testEndpoint2",
      tags: { scenario: "endpoint2" },
    },
  },
  thresholds,
};

function testEndpoint(endpoint, responseTimeMetric, errorRateMetric) {
  const params = {
    headers: authHeader.headers,
    tags: { endpoint: endpoint.id, name: endpoint.name },
    timeout: "30s",
  };
  const response = http.get(endpoint.url, params);
  const statusOk = response.status === 200;

  responseTimeMetric.add(response.timings.duration);
  errorRateMetric.add(!statusOk);

  sleep(1);
}

export function testEndpoint1() {
  testEndpoint(ENDPOINT1, endpoint1ResponseTime, endpoint1ErrorRate);
}

export function testEndpoint2() {
  testEndpoint(ENDPOINT2, endpoint2ResponseTime, endpoint2ErrorRate);
}

function getEndpointMetrics(data, endpointId) {
  const metricName = `${endpointId}_response_time`;
  const errorMetricName = `${endpointId}_errors`;

  const trendValues = data.metrics[metricName]?.values || {};

  // Get request count from Rate metric (passes + fails)
  const errorMetric = data.metrics[errorMetricName];
  let requestCount = 0;
  if (errorMetric?.values) {
    const passes = errorMetric.values.passes || 0;
    const fails = errorMetric.values.fails || 0;
    requestCount = passes + fails;
  }

  const median = trendValues.med || trendValues["p(50)"] || 0;

  return {
    requests: requestCount,
    avg: trendValues.avg || 0,
    median: median,
    min: trendValues.min || 0,
    max: trendValues.max || 0,
  };
}

function formatEndpointData(endpoint, metrics) {
  return {
    url: endpoint.url,
    requests: metrics.requests,
    avgResponseTime: metrics.avg.toFixed(2) + "ms",
    medianResponseTime: metrics.median.toFixed(2) + "ms",
    minResponseTime: metrics.min.toFixed(2) + "ms",
    maxResponseTime: metrics.max.toFixed(2) + "ms",
  };
}

function scoreEndpoint(metrics) {
  return metrics.avg * 0.7 + metrics.median * 0.3;
}

function determineWinner(endpoint1, endpoint2, metrics1, metrics2) {
  const score1 = scoreEndpoint(metrics1);
  const score2 = scoreEndpoint(metrics2);

  const best =
    score1 < score2
      ? { endpoint: endpoint1, metrics: metrics1 }
      : { endpoint: endpoint2, metrics: metrics2 };
  const second =
    score1 < score2
      ? { endpoint: endpoint2, metrics: metrics2 }
      : { endpoint: endpoint1, metrics: metrics1 };

  const avgDiff = Math.abs(best.metrics.avg - second.metrics.avg);
  const avgDiffPercentNum =
    (avgDiff / Math.max(best.metrics.avg, second.metrics.avg)) * 100;
  const avgDiffPercent = avgDiffPercentNum.toFixed(1);

  const isClearWinner =
    best.metrics.avg < second.metrics.avg &&
    best.metrics.median < second.metrics.median &&
    avgDiffPercentNum > 2;

  let winner = best.endpoint.name;
  let winnerReason = "";

  if (isClearWinner) {
    const improvementPercent = (
      (second.metrics.avg / best.metrics.avg - 1) *
      100
    ).toFixed(1);
    winnerReason = `Faster avg (${improvementPercent}% faster) and median, statistically significant`;
  } else if (best.metrics.avg < second.metrics.avg) {
    if (avgDiffPercentNum < 2) {
      winner = `${best.endpoint.name} (marginally faster, within variance)`;
      winnerReason = `Only ${avgDiffPercent}% difference - results may vary between runs`;
    } else {
      winner = `${best.endpoint.name} (faster avg)`;
      winnerReason = `${avgDiffPercent}% faster on average`;
    }
  } else {
    winnerReason =
      "Very similar performance - differences may be due to variance";
  }

  return {
    winner,
    winnerReason,
    avgDiff,
    avgDiffPercent,
  };
}

function formatMetric(value, decimals = 2) {
  return value.toFixed(decimals).padStart(10);
}

function formatSummaryLine(label, value, suffix = "") {
  const formattedValue =
    typeof value === "number" && Number.isInteger(value)
      ? value.toString().padStart(10)
      : formatMetric(value);
  return `   ${label}: ${formattedValue}${suffix}                          `;
}

export function handleSummary(data) {
  const metrics1 = getEndpointMetrics(data, "endpoint1");
  const metrics2 = getEndpointMetrics(data, "endpoint2");

  const { winner, winnerReason, avgDiff, avgDiffPercent } = determineWinner(
    ENDPOINT1,
    ENDPOINT2,
    metrics1,
    metrics2
  );

  const comparison = {
    endpoint1: formatEndpointData(ENDPOINT1, metrics1),
    endpoint2: formatEndpointData(ENDPOINT2, metrics2),
    comparison: {
      avgDifference: avgDiff.toFixed(2) + "ms",
      avgDifferencePercent: avgDiffPercent + "%",
    },
    winner: winner,
    winnerReason: winnerReason,
  };

  const formatEndpointSummary = (endpoint, metrics) =>
    ` ${endpoint.name}: ${endpoint.url}
${formatSummaryLine("Requests", metrics.requests, "")}
${formatSummaryLine("Avg Response Time", metrics.avg, "ms")}
${formatSummaryLine("Median", metrics.median, "ms")}
${formatSummaryLine("Min", metrics.min, "ms")}
${formatSummaryLine("Max", metrics.max, "ms")}`;

  const endpoint1Summary = formatEndpointSummary(ENDPOINT1, metrics1);
  const endpoint2Summary = formatEndpointSummary(ENDPOINT2, metrics2);

  const summaryText = `
══════════════════════════════════════════════════════════════
PERFORMANCE COMPARISON
══════════════════════════════════════════════════════════════
${endpoint1Summary}
══════════════════════════════════════════════════════════════
${endpoint2Summary}
══════════════════════════════════════════════════════════════
 Comparison:
   Avg Difference:    ${formatMetric(avgDiff)}ms (${avgDiffPercent}%)
══════════════════════════════════════════════════════════════
 Winner: ${winner.padEnd(47)}
 Reason: ${winnerReason.padEnd(47)}
══════════════════════════════════════════════════════════════
`;

  console.log(summaryText);

  return {
    "summary.json": JSON.stringify(comparison, null, 2),
  };
}
