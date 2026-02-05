import * as net from 'net';

/**
 * Auto-detect available port
 */
export class PortDetector {
  /**
   * Find available port in range
   */
  static async findAvailablePort(
    startPort: number,
    endPort: number,
    host: string = '127.0.0.1'
  ): Promise<number> {
    // Try default port first
    if (await this.isPortAvailable(startPort, host)) {
      return startPort;
    }

    // Scan range
    for (let port = startPort + 1; port <= endPort; port++) {
      if (await this.isPortAvailable(port, host)) {
        return port;
      }
    }

    throw new Error(
      `No available ports found in range ${startPort}-${endPort}`
    );
  }

  /**
   * Check if port is available
   */
  static async isPortAvailable(
    port: number,
    host: string = '127.0.0.1'
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(false);
        }
      });

      server.once('listening', () => {
        server.close();
        resolve(true);
      });

      server.listen(port, host);
    });
  }

  /**
   * Validate port number
   */
  static validatePort(port: number): boolean {
    return Number.isInteger(port) && port >= 1024 && port <= 65535;
  }
}
