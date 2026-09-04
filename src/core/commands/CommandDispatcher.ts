import { CommandType, EditorCommand, CommandInput } from './CommandTypes';

export type CommandHandler<T = any> = (command: EditorCommand<T>) => void | Promise<void>;

/**
 * CommandDispatcher
 * Central command bus for the Lumina PDF Editor.
 * Decouples toolbars, sidebars, shortcuts, and inspectors from business logic and modal state.
 */
export class CommandDispatcher {
  private handlers: Map<CommandType, Set<CommandHandler>> = new Map();
  private middlewares: Array<(command: EditorCommand) => boolean | void> = [];
  private executingCommands: Set<CommandType> = new Set();

  /**
   * Check whether any handlers are registered for a specific command type.
   */
  public hasHandler(type: CommandType): boolean {
    const set = this.handlers.get(type);
    return !!set && set.size > 0;
  }

  /**
   * Register a handler for a specific command type.
   * Returns an unsubscribe cleanup function.
   */
  public register<T = any>(type: CommandType, handler: CommandHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    const set = this.handlers.get(type)!;
    set.add(handler as CommandHandler);

    return () => {
      this.unregister(type, handler as CommandHandler);
    };
  }

  /**
   * Register multiple command handlers at once.
   * Returns a cleanup function that unregisters all.
   */
  public registerMany(bindings: Partial<Record<CommandType, CommandHandler>>): () => void {
    const unregisterFns: Array<() => void> = [];
    for (const [type, handler] of Object.entries(bindings || {})) {
      if (handler) {
        unregisterFns.push(this.register(type as CommandType, handler));
      }
    }
    return () => {
      unregisterFns.forEach((fn) => fn());
    };
  }

  /**
   * Unregister a previously registered handler.
   */
  public unregister(type: CommandType, handler: CommandHandler): void {
    const set = this.handlers.get(type);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(type);
      }
    }
  }

  /**
   * Add middleware for command interception, logging, or validation.
   */
  public use(middleware: (command: EditorCommand) => boolean | void): () => void {
    this.middlewares.push(middleware);
    return () => {
      this.middlewares = this.middlewares.filter((m) => m !== middleware);
    };
  }

  /**
   * Dispatch a command to all registered handlers.
   */
  public dispatch<T = any>(input: CommandInput<T>): void {
    const command: EditorCommand<T> = typeof input === 'string'
      ? { type: input, metadata: { timestamp: Date.now() } }
      : {
          ...input,
          metadata: {
            timestamp: Date.now(),
            ...input.metadata,
          },
        };

    // Re-entrancy / recursion guard: prevent circular cascade of the same command
    if (this.executingCommands.has(command.type)) {
      console.warn(`[CommandDispatcher] Recursion guard: ${command.type} is already executing. Suppressed re-entrant dispatch.`);
      return;
    }

    // Run middlewares
    for (const middleware of this.middlewares) {
      if (middleware(command) === false) {
        return; // Middleware aborted command
      }
    }

    const set = this.handlers.get(command.type);
    if (set && set.size > 0) {
      this.executingCommands.add(command.type);
      try {
        set.forEach((handler) => {
          try {
            handler(command);
          } catch (err) {
            console.error(`[CommandDispatcher] Handler failed for ${command.type}:`, err);
          }
        });
      } finally {
        this.executingCommands.delete(command.type);
      }
    } else {
      console.warn(`[CommandDispatcher] No handler registered for command: ${command.type}`);
    }
  }

  /**
   * Clear all registered handlers.
   */
  public clear(): void {
    this.handlers.clear();
    this.middlewares = [];
  }
}

/** Global singleton instance */
export const commandDispatcher = new CommandDispatcher();
