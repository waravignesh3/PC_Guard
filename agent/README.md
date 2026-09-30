# PC Guard Agent

A lightweight Java 25 agent for Windows-first laboratory monitoring. It uses OSHI to collect hardware and operating-system telemetry, evaluates configurable health rules, and delivers state transitions to a Spring Boot backend over HTTP. It is independent of the backend: unsent telemetry and fault events are persisted under `data/pending-events` and retried later.

## Run

Requirements: Java 25 and Maven. From this directory:

```powershell
# If Maven is installed and on PATH
mvn clean package

# This repository also has a Maven wrapper with the backend project
& ..\backend\mvnw.cmd -f .\pom.xml clean package

java --enable-native-access=ALL-UNNAMED -jar target\pc-guard-agent-1.0.0.jar
```

The `--enable-native-access=ALL-UNNAMED` flag suppresses the Java 25 warning emitted by OSHI's JNA native system-information bridge. It is not an error.

The executable jar includes OSHI, Jackson, SLF4J, and Logback. Set `PC_GUARD_API_KEY` to send an optional bearer token. Configure the backend and all thresholds in `src/main/resources/application.properties` (environment variables with upper-case underscore names override properties, for example `SERVER_BASE_URL`).

## Design

`OshiCollector` takes isolated best-effort snapshots. `ThresholdDetector` contains reusable rules. `FaultStateService` confirms consecutive readings, suppresses duplicate active events, and emits a matching `RECOVERED` event only after consecutive normal samples. `BackendClient` uses Java `HttpClient`; `OfflineQueue` writes each failed event atomically before retry.

Configured backend endpoints are `/api/agent/register`, `/api/agent/heartbeat`, `/api/agent/telemetry`, `/api/agent/faults`, and `/api/agent/faults/recovered`. The implementation currently sends heartbeats, telemetry, and fault events; registration can be called by enabling it in a future deployment bootstrap without changing transport code.

Example telemetry:

```json
{"computerId":"hardware-or-persisted-id","hostname":"LAB-PC-01","timestamp":"2026-09-27T04:30:00Z","cpu":{"usagePercent":34.2},"memory":{"usagePercent":61.5},"storage":[{"mount":"C:\\","usagePercent":72.0}],"activeFaults":[]}
```

Example fault:

```json
{"faultCode":"HIGH_CPU_USAGE","category":"CPU","component":"CPU","metric":"usagePercent","currentValue":96.1,"threshold":95.0,"severity":"CRITICAL","state":"ACTIVE","message":"CPU usage has remained elevated.","recommendedAction":"Review running processes and workload."}
```

## Practical limitations

Software cannot reliably diagnose a physically failed fan, damaged cable, failing display, or disk SMART condition when the operating system/firmware does not expose a sensor. OSHI values may be unavailable without elevated rights or vendor drivers. In those cases the agent leaves the measurement `null`/unknown and does not claim it is healthy. The agent does not perform repair actions or terminate processes.

## Backend integration

Implement the configured POST endpoints to accept JSON payloads and return any 2xx response after durable acceptance. Use `computerId` as the idempotency identity and `(faultCode, component, state, detectedAt)` to deduplicate retries. Deploy a shared HTTPS `server.base-url` and set `PC_GUARD_API_KEY` through the machine environment rather than a properties file.

## Tests

`mvn test` tests CPU/RAM/disk/temperature threshold classification, confirmation and recovery transitions, JSON serialization, and the offline queue. OSHI collectors are intentionally not unit-tested against a real lab computer.
