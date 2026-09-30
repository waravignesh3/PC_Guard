# PC Guard

PC Guard monitors Windows lab computers with an OSHI Java agent, persists its telemetry through a Spring Boot API into PostgreSQL, and presents live status in a Vite/React dashboard.

## Architecture

`Windows agent → REST /api/v1 → Spring Boot → PostgreSQL → SSE /api/v1/events → React dashboard`

## Configure

Copy `.env.example` values into your shell or local environment. Do not commit secrets. The agent reads `SERVER_BASE_URL` and `PC_GUARD_API_KEY` from the environment (defaults to `http://localhost:8080`). The frontend uses `VITE_API_BASE_URL`.

## Start on Windows PowerShell

```powershell
cd D:\Java\PC_Guard
$env:DB_HOST = 'localhost'
$env:DB_PORT = '5432'
$env:DB_NAME = 'pc_guard'
$env:DB_USERNAME = 'postgres'
$env:DB_PASSWORD = '<your local PostgreSQL password>'

# PostgreSQL is the existing native Windows service. Verify it first:
& 'C:\Program Files\PostgreSQL\17\bin\pg_isready.exe'

cd .\backend
.\mvnw.cmd spring-boot:run

cd ..\frontend
npm run dev

cd ..\agent
& ..\backend\mvnw.cmd -f .\pom.xml clean package
java --enable-native-access=ALL-UNNAMED -jar target\pc-guard-agent-1.0.0.jar
```

Check `http://localhost:8080/actuator/health` before starting the agent. For agent authentication, set the same non-empty `AGENT_API_KEY` in the backend environment and `PC_GUARD_API_KEY` in the agent environment.

## APIs

- `POST /api/v1/agents/register`
- `POST /api/v1/agents/{agentId}/heartbeat`
- `POST /api/v1/agents/{agentId}/telemetry`
- `GET /api/v1/computers`, `/api/v1/computers/{id}`, `/api/v1/computers/{id}/telemetry`
- `GET /api/v1/computers/{id}/faults`, `/api/v1/computers/{id}/reports`
- `GET /api/v1/faults`, `/api/v1/reports`, `/api/v1/dashboard/summary`, `/api/v1/events`, `/api/v1/health`

## Schema

Flyway creates `computers`, `hardware_inventory`, `telemetry`, `heartbeats`, `faults`, and `reports`, with indexes for agent lookups and timestamped monitoring queries.

## Verification

```powershell
cd D:\Java\PC_Guard\backend; .\mvnw.cmd test
cd D:\Java\PC_Guard\agent; & ..\backend\mvnw.cmd -f .\pom.xml test
cd D:\Java\PC_Guard\frontend; npm run build
```

The backend test uses H2 and does not require your PostgreSQL credentials. End-to-end verification requires the existing native PostgreSQL service and `DB_PASSWORD`; without them the backend correctly remains unavailable and the agent queues events locally.
