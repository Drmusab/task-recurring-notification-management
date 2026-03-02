/**
 * MountService — Boot-Sequence-Aware UI Mounting (§9)
 *
 * Controls Svelte component lifecycle: mount after boot phase 7,
 * unmount before shutdown phase 3.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Mounts Svelte components into SiYuan DOM containers
 *   ✔ Tracks all mounted instances for cleanup
 *   ✔ Lifecycle-aware (start/stop)
 *   ❌ No task mutations
 *   ❌ No SiYuan API calls
 */

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface MountPoint {
  readonly id: string;
  readonly containerId: string;
  readonly component: unknown; // Svelte component constructor
  readonly props?: Record<string, unknown>;
}

interface MountedInstance {
  readonly id: string;
  readonly container: HTMLElement;
  readonly instance: { $destroy(): void };
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class MountService {
  private mounted: Map<string, MountedInstance> = new Map();
  private active = false;

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    this.active = true;
  }

  stop(): void {
    this.unmountAll();
    this.active = false;
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Mount a Svelte component into a container element.
   *
   * @param mountPoint - Mount point configuration
   * @returns true if mounted successfully, false otherwise
   */
  mount(mountPoint: MountPoint): boolean {
    if (!this.active) return false;

    // Check if already mounted
    if (this.mounted.has(mountPoint.id)) {
      this.unmount(mountPoint.id);
    }

    const container = document.getElementById(mountPoint.containerId);
    if (!container) return false;

    try {
      // Svelte 5 mount API
      const ComponentClass = mountPoint.component as new (options: {
        target: HTMLElement;
        props?: Record<string, unknown>;
      }) => { $destroy(): void };

      const instance = new ComponentClass({
        target: container,
        props: mountPoint.props,
      });

      this.mounted.set(mountPoint.id, {
        id: mountPoint.id,
        container,
        instance,
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Unmount a specific component by mount point ID.
   */
  unmount(id: string): boolean {
    const mountedInstance = this.mounted.get(id);
    if (!mountedInstance) return false;

    try {
      mountedInstance.instance.$destroy();
    } catch {
      // Component may already be destroyed
    }

    this.mounted.delete(id);
    return true;
  }

  /**
   * Unmount all mounted components.
   */
  unmountAll(): void {
    for (const [id] of this.mounted) {
      this.unmount(id);
    }
  }

  /**
   * Check if a mount point is currently mounted.
   */
  isMounted(id: string): boolean {
    return this.mounted.has(id);
  }

  /**
   * Get count of mounted components.
   */
  getMountedCount(): number {
    return this.mounted.size;
  }

  /**
   * Get all mount point IDs currently mounted.
   */
  getMountedIds(): string[] {
    return Array.from(this.mounted.keys());
  }
}
