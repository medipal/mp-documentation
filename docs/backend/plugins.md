# Plugin System

::: info
This section is under development.
:::

The backend supports a plugin architecture that allows extending functionality without modifying core code.

## Plugin Structure

Plugins are self-contained modules that register routes, services, and event handlers with the application.

## Plugin Lifecycle

Plugins are discovered and loaded at application startup. Each plugin can define initialisation and teardown hooks.

## Available Plugins

Refer to the plugin management documentation for a list of available plugins and their configuration options.
