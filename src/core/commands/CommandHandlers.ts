import { useEffect, useCallback } from 'react';
import { commandDispatcher, CommandHandler } from './CommandDispatcher';
import { CommandType, EditorCommand, CommandInput } from './CommandTypes';

/**
 * Custom React hook to dispatch commands from any component.
 */
export function useCommandDispatcher() {
  const dispatch = useCallback(<T = any>(input: CommandInput<T>) => {
    commandDispatcher.dispatch(input);
  }, []);

  return { dispatch, dispatcher: commandDispatcher };
}

/**
 * Custom React hook to bind a handler to a specific command during a component's lifecycle.
 */
export function useCommandHandler<T = any>(type: CommandType, handler: CommandHandler<T>) {
  useEffect(() => {
    const unregister = commandDispatcher.register<T>(type, handler);
    return unregister;
  }, [type, handler]);
}

/**
 * Custom React hook to register multiple command handlers at once.
 */
export function useCommandBindings(bindings: Partial<Record<CommandType, CommandHandler>>) {
  useEffect(() => {
    const unregister = commandDispatcher.registerMany(bindings);
    return unregister;
  }, [bindings]);
}
