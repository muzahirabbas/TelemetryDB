# Telemetry DB ("The Hunter V3")

A robust telemetry and diagnostics collection system built on Cloudflare Workers and D1 Database. This project serves a lightweight "System Diagnostics" page that performs client-side fingerprinting and geolocation tracking, while simultaneously capturing server-side network intelligence.

## Features

*   **Server-Side Intelligence**: Instantly captures IP address, City, Country, Region, ISP, and rough coordinates via Cloudflare's edge network headers (`request.cf`) before any client script runs.
*   **Client-Side Fingerprinting**: Collects detailed hardware specifications:
    *   User Agent
    *   CPU Cores (`navigator.hardwareConcurrency`)
    *   Device Memory (`navigator.deviceMemory`)
    *   Screen Resolution
    *   GPU Renderer (WebGL unmasked renderer)
*   **High-Precision GPS**: Requests high-accuracy geolocation from the client device.
*   **Resilient Exfiltration**: Uses `navigator.sendBeacon` (with `fetch` `keepalive` fallback) to ensure data is successfully transmitted even if the user closes the tab immediately.
*   **Adaptive Storage Strategy**:
    *   Primary metrics (IP, City, Country) go into structured SQL columns.
    *   Rich metadata (ISP, Region) is packed into generic columns (`timing_data`) to maintain schema compatibility without migrations.
    *   GPS data attempts to update precise columns (`precise_lat`, `precise_lon`) but falls back to appending to text fields if necessary.

## Tech Stack

*   **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/)
*   **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)
*   **Language**: JavaScript / TypeScript
*   **Testing**: Vitest

## Prerequisites

*   Node.js (v18 or later recommended)
*   npm
*   [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed globally or locally.

## Setup & Installation

1.  **Clone the repository** (if applicable) and navigate to the directory:
    ```bash
    cd telemetry-db
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Cloudflare Login**:
    Ensure you are logged into your Cloudflare account via Wrangler:
    ```bash
    npx wrangler login
    ```

## Database Configuration

This project uses a D1 database named `telemetry-db`.

1.  **Create the D1 Database** (if you haven't already):
    ```bash
    npx wrangler d1 create telemetry-db
    ```
    *Note: Copy the `database_id` output by this command and update your `wrangler.jsonc` file if it differs from the existing one.*

2.  **Apply the Schema**:
    Initialize the database tables using the `schema.sql` file.

    *   **For Local Development**:
        ```bash
        npx wrangler d1 execute telemetry-db --local --file=./schema.sql
        ```

    *   **For Production**:
        ```bash
        npx wrangler d1 execute telemetry-db --remote --file=./schema.sql
        ```

## Development

To start the local development server:

```bash
npm run dev
```
This will start the worker on `http://localhost:8787` (or similar). Accessing this URL in your browser will simulate a visit and trigger the data collection.

## Deployment

To deploy your worker to the Cloudflare global network:

```bash
npm run deploy
```

## Testing

Run the test suite using Vitest:

```bash
npm test
```

## Project Structure

*   `src/index.js`: Main worker logic. Handles HTTP requests, serves the HTML payload, and processes report data.
*   `schema.sql`: SQL schema for the `visits` table.
*   `wrangler.jsonc`: Cloudflare Workers configuration file (routes, bindings, etc.).
*   `test/`: Contains unit/integration tests.

## API & Data Flow

1.  **GET /**:
    *   Server generates a UUID (`visitId`).
    *   Captures Server-Side info (IP, Geo, ISP) and inserts a new row into D1 `visits`.
    *   Returns an HTML page containing the client-side collection scripts.

2.  **POST /report**:
    *   Receives JSON payloads from the client.
    *   **Type `gps`**: Updates `precise_lat` and `precise_lon` (or appends to `timing_data`).
    *   **Type `specs`**: Updates `user_agent` with the full fingerprint JSON object.

## Database Schema (`visits`)

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key (Auto-increment) |
| `uuid` | TEXT | Unique Session ID |
| `ip` | TEXT | Client IP Address |
| `user_agent` | TEXT | Browser UA (initially) or Full Hardware Fingerprint (after update) |
| `city` | TEXT | City (from Cloudflare) |
| `country` | TEXT | Country (from Cloudflare) |
| `precise_lat` | REAL | GPS Latitude |
| `precise_lon` | REAL | GPS Longitude |
| `timing_data` | TEXT | Used for generic metadata (ISP, Region, backup GPS data) |
| `image_data` | TEXT | Reserved for future use |
| `timestamp` | TEXT | ISO Timestamp of the visit |

## License

Private.
