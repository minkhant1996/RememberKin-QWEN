/**
 * Load Test Script
 *
 * Tests API performance under load.
 * Run with: npx ts-node load-test.ts
 *
 * Options (via environment variables):
 * - CONCURRENT_USERS: Number of concurrent users (default: 10)
 * - REQUESTS_PER_USER: Requests per user (default: 10)
 * - API_URL: Base API URL (default: http://localhost:6100/api/v1)
 */

const API_URL = process.env.API_URL || 'http://localhost:6100/api/v1';
const CONCURRENT_USERS = parseInt(process.env.CONCURRENT_USERS || '10');
const REQUESTS_PER_USER = parseInt(process.env.REQUESTS_PER_USER || '10');

interface RequestResult {
  endpoint: string;
  status: number;
  duration: number;
  error?: string;
}

interface TestSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  p99Latency: number;
  requestsPerSecond: number;
}

class LoadTester {
  private token: string = '';
  private results: RequestResult[] = [];

  async setup(): Promise<void> {
    const email = `load-test-${Date.now()}@example.com`;

    // Register user
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'testpassword123',
        name: 'Load Test User',
      }),
    });
    const data = await response.json();
    this.token = data.token;

    // Create family
    await fetch(`${API_URL}/family`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ name: 'Load Test Family' }),
    });
  }

  async makeRequest(endpoint: string, method = 'GET'): Promise<RequestResult> {
    const start = Date.now();
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
      });
      return {
        endpoint,
        status: response.status,
        duration: Date.now() - start,
      };
    } catch (error: any) {
      return {
        endpoint,
        status: 0,
        duration: Date.now() - start,
        error: error.message,
      };
    }
  }

  async runUserSimulation(): Promise<void> {
    const endpoints = [
      '/family',
      '/family/tree',
      '/members',
      '/stories',
      '/events',
      '/memories',
    ];

    for (let i = 0; i < REQUESTS_PER_USER; i++) {
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      const result = await this.makeRequest(endpoint);
      this.results.push(result);
    }
  }

  async run(): Promise<void> {
    console.log('=========================================');
    console.log('  Rememberkin - Load Test');
    console.log('=========================================\n');

    console.log(`Configuration:`);
    console.log(`  API URL: ${API_URL}`);
    console.log(`  Concurrent Users: ${CONCURRENT_USERS}`);
    console.log(`  Requests per User: ${REQUESTS_PER_USER}`);
    console.log(`  Total Requests: ${CONCURRENT_USERS * REQUESTS_PER_USER}`);
    console.log('');

    // Setup
    console.log('Setting up test user...');
    await this.setup();
    console.log('Setup complete!\n');

    // Run load test
    console.log('Running load test...');
    const startTime = Date.now();

    const userPromises: Promise<void>[] = [];
    for (let i = 0; i < CONCURRENT_USERS; i++) {
      userPromises.push(this.runUserSimulation());
    }
    await Promise.all(userPromises);

    const totalDuration = Date.now() - startTime;

    // Calculate summary
    const summary = this.calculateSummary(totalDuration);
    this.printSummary(summary);
  }

  calculateSummary(totalDuration: number): TestSummary {
    const successful = this.results.filter((r) => r.status >= 200 && r.status < 400);
    const failed = this.results.filter((r) => r.status < 200 || r.status >= 400);
    const latencies = this.results.map((r) => r.duration).sort((a, b) => a - b);

    const avgLatency =
      latencies.reduce((sum, l) => sum + l, 0) / latencies.length;

    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);

    return {
      totalRequests: this.results.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      avgLatency: Math.round(avgLatency),
      minLatency: latencies[0] || 0,
      maxLatency: latencies[latencies.length - 1] || 0,
      p95Latency: latencies[p95Index] || 0,
      p99Latency: latencies[p99Index] || 0,
      requestsPerSecond: Math.round(
        (this.results.length / totalDuration) * 1000
      ),
    };
  }

  printSummary(summary: TestSummary): void {
    console.log('\n=========================================');
    console.log('  Results');
    console.log('=========================================\n');

    console.log('Requests:');
    console.log(`  Total:      ${summary.totalRequests}`);
    console.log(`  Successful: ${summary.successfulRequests}`);
    console.log(`  Failed:     ${summary.failedRequests}`);
    console.log(
      `  Success %:  ${(
        (summary.successfulRequests / summary.totalRequests) *
        100
      ).toFixed(1)}%`
    );
    console.log('');

    console.log('Latency (ms):');
    console.log(`  Average: ${summary.avgLatency}`);
    console.log(`  Min:     ${summary.minLatency}`);
    console.log(`  Max:     ${summary.maxLatency}`);
    console.log(`  P95:     ${summary.p95Latency}`);
    console.log(`  P99:     ${summary.p99Latency}`);
    console.log('');

    console.log('Throughput:');
    console.log(`  Requests/sec: ${summary.requestsPerSecond}`);
    console.log('');

    // Print endpoint breakdown
    console.log('By Endpoint:');
    const byEndpoint = new Map<string, RequestResult[]>();
    this.results.forEach((r) => {
      if (!byEndpoint.has(r.endpoint)) {
        byEndpoint.set(r.endpoint, []);
      }
      byEndpoint.get(r.endpoint)!.push(r);
    });

    byEndpoint.forEach((results, endpoint) => {
      const avg =
        results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const success = results.filter(
        (r) => r.status >= 200 && r.status < 400
      ).length;
      console.log(
        `  ${endpoint}: avg=${Math.round(avg)}ms, success=${success}/${results.length}`
      );
    });

    // Performance assessment
    console.log('\n-----------------------------------------');
    if (summary.avgLatency < 100 && summary.p95Latency < 200) {
      console.log('Performance: EXCELLENT');
    } else if (summary.avgLatency < 200 && summary.p95Latency < 500) {
      console.log('Performance: GOOD');
    } else if (summary.avgLatency < 500 && summary.p95Latency < 1000) {
      console.log('Performance: ACCEPTABLE');
    } else {
      console.log('Performance: NEEDS IMPROVEMENT');
    }

    if (summary.failedRequests > 0) {
      console.log(`Warning: ${summary.failedRequests} requests failed!`);
    }
  }
}

const tester = new LoadTester();
tester.run().catch(console.error);
