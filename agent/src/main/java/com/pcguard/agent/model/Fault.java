package com.pcguard.agent.model;

import java.time.Instant;
import com.pcguard.agent.model.Enums.*;

public record Fault(String computerId, String hostname, Instant detectedAt, String faultCode,
                    FaultCategory category, String component, String metric, Double currentValue,
                    Double threshold, FaultSeverity severity, FaultState state, String message,
                    String recommendedAction) {
    public String key() { return faultCode + ":" + component; }
}
