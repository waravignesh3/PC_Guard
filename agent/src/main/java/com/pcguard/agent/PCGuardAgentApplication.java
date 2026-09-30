package com.pcguard.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.pcguard.agent.collector.OshiCollector;
import com.pcguard.agent.config.AgentConfig;
import com.pcguard.agent.detector.FaultDetector;
import com.pcguard.agent.detector.ThresholdDetector;
import com.pcguard.agent.model.Snapshot;
import com.pcguard.agent.network.BackendClient;
import com.pcguard.agent.service.ConsoleDashboard;
import com.pcguard.agent.service.FaultStateService;
import com.pcguard.agent.service.IdentityService;
import com.pcguard.agent.service.OfflineQueue;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class PCGuardAgentApplication {
  private static final Logger log = LoggerFactory.getLogger(PCGuardAgentApplication.class);

  public static void main(String[] args) throws Exception {
    if (System.getProperty("oshi.os.windows.hkeyperfdata") == null) {
      System.setProperty("oshi.os.windows.hkeyperfdata", "false");
    }
    if (System.getProperty("java.net.preferIPv4Stack") == null) {
      System.setProperty("java.net.preferIPv4Stack", "true");
    }
    AgentConfig config = AgentConfig.load();
    ObjectMapper json = new ObjectMapper().findAndRegisterModules().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    IdentityService identity = new IdentityService(config, json);
    OshiCollector collector = new OshiCollector(Boolean.parseBoolean(config.text("monitor.process.enabled")));
    FaultDetector detector = new ThresholdDetector(config);
    FaultStateService states = new FaultStateService(config.integer("monitor.confirmation.samples"));
    OfflineQueue queue = new OfflineQueue(config.dataDirectory(), json);
    int retired = queue.archiveRetiredApiEvents();
    if (retired > 0) log.warn("Archived {} queued events for retired pre-v1 API paths.", retired);
    BackendClient backend = new BackendClient(config, json);
    ScheduledExecutorService executor = Executors.newScheduledThreadPool(2);
    final Snapshot[] last = {null};
    boolean reachable = backend.reachable();
    final boolean[] backendOnline = {reachable};

    Runnable collect = () -> {
      try {
        Snapshot snapshot = collector.collect(identity.identity());
        last[0] = snapshot;
        states.transitions(detector.detect(snapshot));
      } catch (Exception e) {
        log.error("Collection cycle failed; monitoring will continue", e);
      }
    };
    Runnable heartbeat = () -> {
      try {
        queue.flush(event -> backend.send((String) event.get("path"), event.get("payload")));
        Snapshot s = last[0];
        if (s == null) return;
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("agentVersion", config.text("agent.version"));
        body.put("timestamp", Instant.now());
        body.put("status", "RUNNING");
        String heartbeatPath = path(config, "server.heartbeat-path", identity.id());
        boolean sent = backend.send(heartbeatPath, body);
        if (sent) {
          backendOnline[0] = true;
        } else {
          backendOnline[0] = backend.reachable();
          if (!backendOnline[0]) {
            queue.enqueue(Map.of("path", heartbeatPath, "payload", body));
          }
        }
      } catch (Exception e) {
        backendOnline[0] = false;
        log.warn("Heartbeat failed: {}", e.getMessage());
      }
    };
    Runnable telemetry = () -> {
      Snapshot s = last[0];
      if (s == null) return;
      Map<String, Object> b = new LinkedHashMap<>();
      b.put("timestamp", s.timestamp());
      b.put("cpu", s.cpu());
      b.put("memory", s.memory());
      b.put("storage", s.storage());
      b.put("network", s.network());
      b.put("gpu", s.gpu());
      b.put("temperature", s.sensors());
      b.put("uptime", s.uptimeSeconds());
      String telemetryPath = path(config, "server.telemetry-path", identity.id());
      if (backend.send(telemetryPath, b)) {
        backendOnline[0] = true;
      } else {
        if (!backend.reachable()) {
          try {
            queue.enqueue(Map.of("path", telemetryPath, "payload", b));
          } catch (Exception e) {
            log.warn("Unable to queue telemetry: {}", e.getMessage());
          }
        }
      }
    };
    Runnable display = () -> {
      Snapshot s = last[0];
      if (s != null) log.info(ConsoleDashboard.render(config.text("agent.version"), s, states.activeFaults(), backendOnline[0]));
    };

    Runtime.getRuntime().addShutdownHook(new Thread(() -> {
      log.info("PC Guard Agent shutting down...");
      executor.shutdown();
      try {
        executor.awaitTermination(5, TimeUnit.SECONDS);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
      log.info("PC Guard Agent stopped.");
    }));

    log.info(
        "PC Guard Agent {} started\nComputer: {}\nAgent ID: {}\nOS: {}\nBackend: {}\nMonitoring started.",
        config.text("agent.version"),
        identity.hostname(),
        identity.id(),
        identity.identity().get("osName"),
        backendOnline[0] ? "ONLINE" : "OFFLINE");

    Map<String, Object> registration = registration(identity);
    if (backend.send(config.text("server.register-path"), registration)) {
      backendOnline[0] = true;
    } else {
      backendOnline[0] = backend.reachable();
      if (!backendOnline[0]) {
        try {
          queue.enqueue(Map.of("path", config.text("server.register-path"), "payload", registration));
        } catch (Exception e) {
          log.warn("Unable to queue registration: {}", e.getMessage());
        }
      }
    }

    executor.scheduleWithFixedDelay(collect, 0, config.millis("monitor.sample.interval-ms"), TimeUnit.MILLISECONDS);
    executor.scheduleWithFixedDelay(heartbeat, 5_000, config.millis("monitor.heartbeat.interval-ms"), TimeUnit.MILLISECONDS);
    executor.scheduleWithFixedDelay(telemetry, 10_000, config.millis("monitor.telemetry.interval-ms"), TimeUnit.MILLISECONDS);
    executor.scheduleWithFixedDelay(display, 5_000, 10_000, TimeUnit.MILLISECONDS);
  }

  private static String path(AgentConfig config, String key, String agentId) {
    return config.text(key).replace("{agentId}", agentId);
  }

  private static Map<String, Object> registration(IdentityService identity) {
    Map<String, Object> i = identity.identity();
    return Map.of(
        "agentId", identity.id(),
        "hostname", identity.hostname(),
        "os", i.get("osName"),
        "osVersion", i.get("osVersion"),
        "architecture", i.get("architecture"),
        "agentVersion", i.get("agentVersion"));
  }
}
