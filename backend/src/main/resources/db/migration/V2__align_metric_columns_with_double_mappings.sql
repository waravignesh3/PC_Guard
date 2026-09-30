-- Hibernate maps Java Double to PostgreSQL double precision. V1 used NUMERIC,
-- so existing databases need this forward-only migration before ddl-auto=validate.
alter table telemetry alter column cpu_usage type double precision using cpu_usage::double precision;
alter table telemetry alter column cpu_temperature type double precision using cpu_temperature::double precision;
alter table telemetry alter column ram_usage type double precision using ram_usage::double precision;
alter table telemetry alter column storage_usage type double precision using storage_usage::double precision;
alter table telemetry alter column gpu_usage type double precision using gpu_usage::double precision;
alter table telemetry alter column gpu_temperature type double precision using gpu_temperature::double precision;
alter table faults alter column current_value type double precision using current_value::double precision;
alter table faults alter column threshold type double precision using threshold::double precision;
