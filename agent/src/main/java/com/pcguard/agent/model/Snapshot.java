package com.pcguard.agent.model;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record Snapshot(Instant timestamp, Map<String, Object> identity, Map<String, Object> cpu,
                       Map<String, Object> memory, List<Map<String, Object>> storage,
                       List<Map<String, Object>> network, List<Map<String, Object>> gpu,
                       Map<String, Object> sensors, Map<String, Object> battery,
                       List<Map<String, Object>> processes, long uptimeSeconds) {}
