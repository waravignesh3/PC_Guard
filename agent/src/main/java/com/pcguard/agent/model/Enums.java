package com.pcguard.agent.model;

public final class Enums {
    private Enums() {}
    public enum FaultSeverity { INFO, WARNING, CRITICAL, UNKNOWN }
    public enum FaultCategory { CPU, MEMORY, STORAGE, GPU, TEMPERATURE, NETWORK, BATTERY, PROCESS, OS, SYSTEM, AGENT }
    public enum FaultState { ACTIVE, RECOVERED }
}
