package com.pcguard.agent.config;

import java.io.*; import java.nio.file.*; import java.util.*;

public final class AgentConfig {
    private final Properties values = new Properties();
    public static AgentConfig load() throws IOException { AgentConfig c = new AgentConfig(); try (InputStream in = AgentConfig.class.getResourceAsStream("/application.properties")) { c.values.load(Objects.requireNonNull(in)); } return c; }
    public String text(String key) { String env = System.getenv(key.toUpperCase(Locale.ROOT).replace('.', '_').replace('-', '_')); return env != null && !env.isBlank() ? env : values.getProperty(key); }
    public int integer(String key) { return Integer.parseInt(text(key)); }
    public long millis(String key) { return Long.parseLong(text(key)); }
    public double number(String key) { return Double.parseDouble(text(key)); }
    public Path dataDirectory() { return Paths.get(text("agent.data-directory")); }
    public String apiKey() {
        for (String name : new String[] {"AGENT_API_KEY", "PC_GUARD_API_KEY"}) {
            String key = System.getenv(name);
            if (key != null && !key.isBlank()) return key;
        }
        String configured = values.getProperty("server.api-key");
        return configured == null || configured.isBlank() ? null : configured;
    }
}
