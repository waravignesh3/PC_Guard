package com.pcguard.agent.network;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pcguard.agent.config.AgentConfig;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class BackendClient {
  private static final Logger log = LoggerFactory.getLogger(BackendClient.class);
  private final AgentConfig c;
  private final ObjectMapper json;
  private volatile HttpClient http;

  public BackendClient(AgentConfig c, ObjectMapper json) {
    this.c = c;
    this.json = json;
    this.http = createHttpClient();
  }

  public boolean send(String path, Object body) {
    if (path != null && path.startsWith("/api/agent/")) {
      log.warn("Discarding a queued event for the retired pre-v1 API path: {}", path);
      return true;
    }
    try {
      byte[] payload = json.writeValueAsBytes(body);
      if (http == null) http = createHttpClient();
      if (http != null) {
        try {
          return complete(sendWithHttpClient(path, payload));
        } catch (Exception e) {
          if (!loopbackFailure(e)) throw e;
          log.warn("java.net.http client failed on loopback; retrying with HttpURLConnection: {}", e.getMessage());
        }
      }
      return complete(sendWithUrlConnection(path, payload));
    } catch (Exception e) {
      log.warn("Backend request failed for {}: {}", path, e.getMessage());
      return false;
    }
  }

  public boolean reachable() {
    try {
      if (http == null) http = createHttpClient();
      if (http != null) {
        try {
          return complete(reachableWithHttpClient());
        } catch (Exception e) {
          if (!loopbackFailure(e)) throw e;
          log.warn("java.net.http client failed on loopback; retrying with HttpURLConnection: {}", e.getMessage());
        }
      }
      return complete(reachableWithUrlConnection());
    } catch (Exception e) {
      log.warn("Backend reachability probe failed: {}", e.getMessage());
      return false;
    }
  }

  private int reachableWithHttpClient() throws Exception {
    HttpRequest req = HttpRequest.newBuilder(uri("/api/v1/health"))
        .timeout(Duration.ofMillis(c.millis("server.connect-timeout-ms")))
        .header("Accept", "application/json")
        .GET()
        .build();
    HttpResponse<Void> response = http.send(req, HttpResponse.BodyHandlers.discarding());
    return response.statusCode();
  }

  private int reachableWithUrlConnection() throws Exception {
    HttpURLConnection conn = (HttpURLConnection) uri("/api/v1/health").toURL().openConnection();
    try {
      conn.setConnectTimeout((int) c.millis("server.connect-timeout-ms"));
      conn.setReadTimeout((int) c.millis("server.connect-timeout-ms"));
      conn.setRequestMethod("GET");
      conn.setRequestProperty("Accept", "application/json");
      int status = conn.getResponseCode();
      InputStream error = conn.getErrorStream();
      if (error != null) error.close();
      return status;
    } finally {
      conn.disconnect();
    }
  }

  public boolean internetReachable() {
    if (!Boolean.parseBoolean(c.text("network.test.enabled"))) return true;
    try (java.net.Socket socket = new java.net.Socket()) {
      socket.connect(
          new java.net.InetSocketAddress(c.text("network.test.host"), c.integer("network.test.port")),
          c.integer("network.test.timeout-ms"));
      return true;
    } catch (Exception e) {
      return false;
    }
  }

  private HttpClient createHttpClient() {
    try {
      return HttpClient.newBuilder().connectTimeout(Duration.ofMillis(c.millis("server.connect-timeout-ms"))).build();
    } catch (RuntimeException e) {
      log.warn("HTTP client is unavailable; falling back to HttpURLConnection: {}", e.getMessage());
      return null;
    }
  }

  private int sendWithHttpClient(String path, byte[] payload) throws Exception {
    HttpRequest.Builder b = HttpRequest.newBuilder(uri(path))
        .timeout(Duration.ofMillis(c.millis("server.connect-timeout-ms")))
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofByteArray(payload));
    if (c.apiKey() != null) b.header("Authorization", "Bearer " + c.apiKey());
    HttpResponse<Void> response = http.send(b.build(), HttpResponse.BodyHandlers.discarding());
    return response.statusCode();
  }

  private int sendWithUrlConnection(String path, byte[] payload) throws Exception {
    HttpURLConnection conn = (HttpURLConnection) uri(path).toURL().openConnection();
    try {
      conn.setConnectTimeout((int) c.millis("server.connect-timeout-ms"));
      conn.setReadTimeout((int) c.millis("server.connect-timeout-ms"));
      conn.setRequestMethod("POST");
      conn.setDoOutput(true);
      conn.setRequestProperty("Content-Type", "application/json");
      if (c.apiKey() != null) conn.setRequestProperty("Authorization", "Bearer " + c.apiKey());
      try (OutputStream os = conn.getOutputStream()) {
        os.write(payload);
      }
      int status = conn.getResponseCode();
      InputStream error = conn.getErrorStream();
      if (error != null) error.close();
      return status;
    } finally {
      conn.disconnect();
    }
  }

  private URI uri(String path) {
    String base = c.text("server.base-url");
    if (base != null && base.contains("://localhost")) base = base.replace("://localhost", "://127.0.0.1");
    return URI.create(base + path);
  }

  private boolean complete(int status) {
    boolean ok = status >= 200 && status < 300;
    if (!ok) log.warn("Backend responded {} for an agent request", status);
    return ok;
  }

  private static boolean loopbackFailure(Throwable e) {
    while (e != null) {
      String message = e.getMessage();
      if (message != null && message.toLowerCase().contains("loopback")) return true;
      e = e.getCause();
    }
    return false;
  }
}
