# Project Structure

::: info
This section is under development.
:::

An overview of the `mp-server` directory layout and how the codebase is organised.

## Top-Level Directories

The server source code is organised into modules by domain, with shared utilities and infrastructure in dedicated packages.

## Module Structure

Each domain module typically contains routes, services, repositories, and schemas following a consistent pattern.

## Configuration

Application configuration is loaded from environment variables and `.env` files using Pydantic settings.
